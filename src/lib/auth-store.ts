import { useEffect, useState } from "react";
import { WARD_RENAMES } from "./hai-store";
import { sbAll, sbReplaceAll } from "./supabase";

/**
 * Client-side auth for the demo app (no backend).
 * Users + session live in localStorage.
 *
 * NOTE: by request, the plaintext password is also stored (`password`) so an
 * admin can view/share department credentials. This is convenient for a local,
 * single-facility tool but is NOT secure — never use this pattern with a real
 * backend or sensitive deployment.
 */

export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  emoji: string;
  isAdmin: boolean;
  passHash: string;
  password?: string; // plaintext, kept so admins can view credentials (demo only)
}

export interface NewUser {
  username: string;
  name: string;
  role: string;
  emoji: string;
  password: string;
  isAdmin: boolean;
}

const USERS_KEY   = "hai-users-v1";
const SESSION_KEY = "hai-session-v1";
const EVENT       = "hai-auth-changed";

// ── simple string hash (djb2) — demo only, not cryptographically secure ──
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function readUsers(): User[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); } catch { return []; }
}
function writeUsers(u: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(u));
  window.dispatchEvent(new Event(EVENT));
  void sbReplaceAll("users", u);
}

/** Pull users from Supabase into the local cache (no write-back). */
export async function pullUsers() {
  const rows = await sbAll<User>("users");
  if (rows) {
    localStorage.setItem(USERS_KEY, JSON.stringify(rows));
    window.dispatchEvent(new Event(EVENT));
  }
}
function setSession(id: string | null) {
  if (id) localStorage.setItem(SESSION_KEY, id);
  else localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(EVENT));
}

/** Seed a default account on first run, and migrate older records. */
export function seedUsersIfEmpty() {
  const existing = readUsers();
  if (existing.length === 0) {
    writeUsers([
      { id: crypto.randomUUID(), username: "admin",  name: "พรริชา",   role: "พยาบาลควบคุมการติดเชื้อ", emoji: "👩‍⚕️", isAdmin: true,  passHash: hash("1234"), password: "1234" },
      { id: crypto.randomUUID(), username: "doctor", name: "ดร. สมศรี", role: "แพทย์ที่ปรึกษา",          emoji: "👨‍⚕️", isAdmin: false, passHash: hash("1234"), password: "1234" },
    ]);
    return;
  }
  // Backfill fields added after initial release + apply ward renames
  const needsMigration = existing.some((u) =>
    typeof u.isAdmin !== "boolean" || (u.password === undefined && u.passHash === hash("1234")) || !!WARD_RENAMES[u.role]);
  if (needsMigration) {
    const migrated = existing.map((u) => ({
      ...u,
      isAdmin: u.isAdmin ?? u.username === "admin",
      // recover the known default password where it still applies (so admin can view it)
      password: u.password ?? (u.passHash === hash("1234") ? "1234" : undefined),
      role: WARD_RENAMES[u.role] ?? u.role,
    }));
    writeUsers(migrated);
  }
}

/** Attempt login. Returns the user on success, or null. */
export function login(username: string, password: string): User | null {
  const user = readUsers().find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  if (!user || user.passHash !== hash(password)) return null;
  setSession(user.id);
  return user;
}

export function logout() {
  setSession(null);
}

// ── user management (admin only — UI gates access) ─────────────────────────

type Result = { ok: true } | { ok: false; error: string };

export function createUser(u: NewUser): Result {
  const users = readUsers();
  const username = u.username.trim();
  if (!username) return { ok: false, error: "กรุณากรอกชื่อผู้ใช้" };
  if (users.some((x) => x.username.toLowerCase() === username.toLowerCase()))
    return { ok: false, error: "ชื่อผู้ใช้นี้มีอยู่แล้ว" };
  if (u.password.length < 4) return { ok: false, error: "รหัสผ่านต้องยาวอย่างน้อย 4 ตัวอักษร" };

  users.push({
    id: crypto.randomUUID(),
    username,
    name: u.name.trim() || username,
    role: u.role.trim(),
    emoji: u.emoji || "🧑‍⚕️",
    isAdmin: u.isAdmin,
    passHash: hash(u.password),
    password: u.password,
  });
  writeUsers(users);
  return { ok: true };
}

export function updateUser(
  id: string,
  patch: Partial<{ name: string; role: string; emoji: string; isAdmin: boolean; password: string }>,
): Result {
  const users = readUsers();
  const u = users.find((x) => x.id === id);
  if (!u) return { ok: false, error: "ไม่พบผู้ใช้" };

  // keep at least one admin
  if (patch.isAdmin === false && u.isAdmin && users.filter((x) => x.isAdmin).length <= 1)
    return { ok: false, error: "ต้องมีแอดมินอย่างน้อย 1 คน" };

  if (patch.password !== undefined && patch.password !== "" && patch.password.length < 4)
    return { ok: false, error: "รหัสผ่านต้องยาวอย่างน้อย 4 ตัวอักษร" };

  if (patch.name   !== undefined) u.name  = patch.name.trim() || u.name;
  if (patch.role   !== undefined) u.role  = patch.role.trim();
  if (patch.emoji  !== undefined) u.emoji = patch.emoji || u.emoji;
  if (patch.isAdmin !== undefined) u.isAdmin = patch.isAdmin;
  if (patch.password) { u.passHash = hash(patch.password); u.password = patch.password; }

  writeUsers(users);
  return { ok: true };
}

// ── one account per ward (admin convenience) ───────────────────────────────

/** Readable random password (no ambiguous chars). */
function generatePassword(len = 6): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  const a = new Uint32Array(len);
  crypto.getRandomValues(a);
  for (let i = 0; i < len; i++) s += chars[a[i] % chars.length];
  return s;
}

/**
 * Create one (non-admin) account per ward that doesn't already have one.
 * Username = ward; role = ward; password is generated and stored as plaintext
 * so the admin can view/share it. Returns how many were created.
 */
export function generateWardAccounts(wards: string[]): { created: number } {
  const users = readUsers();
  const taken = new Set(users.map((u) => u.username.toLowerCase()));
  const haveWard = new Set(users.filter((u) => !u.isAdmin).map((u) => u.role));

  let created = 0;
  wards.forEach((ward) => {
    if (haveWard.has(ward) || taken.has(ward.toLowerCase())) return; // skip existing
    const pw = generatePassword();
    users.push({
      id: crypto.randomUUID(),
      username: ward,
      name: ward,
      role: ward,
      emoji: "🧑‍⚕️",
      isAdmin: false,
      passHash: hash(pw),
      password: pw,
    });
    taken.add(ward.toLowerCase());
    haveWard.add(ward);
    created += 1;
  });

  if (created > 0) writeUsers(users);
  return { created };
}

export function deleteUser(id: string): Result {
  const users = readUsers();
  const u = users.find((x) => x.id === id);
  if (!u) return { ok: false, error: "ไม่พบผู้ใช้" };
  if (u.isAdmin && users.filter((x) => x.isAdmin).length <= 1)
    return { ok: false, error: "ไม่สามารถลบแอดมินคนสุดท้ายได้" };
  writeUsers(users.filter((x) => x.id !== id));
  return { ok: true };
}

/** Reactive list of all users. */
export function useUsers(): User[] {
  const [users, setUsers] = useState<User[]>(() => readUsers());
  useEffect(() => {
    const sync = () => setUsers(readUsers());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return users;
}

function currentUser(): User | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  return readUsers().find((u) => u.id === id) ?? null;
}

/** Reactive hook: current user + ready flag (false until hydrated on client). */
export function useAuth(): { user: User | null; ready: boolean } {
  const [user, setUser]   = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setUser(currentUser());
    sync();
    setReady(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync); // sync across tabs
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { user, ready };
}
