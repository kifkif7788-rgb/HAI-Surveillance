import { useEffect, useState } from "react";
import { DEFAULT_WARDS, DEFAULT_DEPARTMENTS, DEFAULT_ICU_WARDS } from "./hai-types";
import { sbAll, sbReplaceAll } from "./supabase";

/**
 * หอผู้ป่วยที่ใช้วันนอนร่วมกัน (shared denominator).
 * key = ชื่อหอในบันทึกผู้ป่วย, value = ชื่อหอที่ใช้ค้นหาใน monthly stats
 * เช่น ม.6ก ortho / ม.6ก observe ใช้วันนอนของ ม.6ก เดียวกัน
 */
export const WARD_STAT_ALIAS: Record<string, string> = {
  "ม.6ก ortho": "ม.6ก",
  "ม.6ก observe": "ม.6ก",
};

/** แปลงชื่อหอเป็นชื่อที่ใช้ค้นหาใน monthly stats (คืนค่าเดิมถ้าไม่มี alias) */
export function statWard(ward: string): string {
  return WARD_STAT_ALIAS[ward] ?? ward;
}

/**
 * Wards & departments — managed in-app and synced with Supabase
 * (two JSONB-per-row tables: `departments`, `wards`).
 *
 * localStorage is a synchronous cache; Supabase is the shared source of truth.
 *   - pull*()        : load from Supabase → cache (startup)
 *   - seedIfEmpty()  : seed defaults on first run (cache + Supabase)
 *   - mutations      : write cache + sbReplaceAll the whole (small) table
 *
 * Patient/monthly records store the ward *name* (string), so most of the app
 * keeps working with name lists; ids are used only to link a ward → department.
 */

export interface Department { id: string; name: string }
export interface Ward { id: string; name: string; departmentId: string; isICU: boolean }

const DEP_KEY = "hai-departments-v1";
const WARD_KEY = "hai-wards-v1";
const EVENT = "hai-wards-changed";

// ── default dataset (used to seed + as fallback before the cache is populated) ──
function buildDefaults(): { departments: Department[]; wards: Ward[] } {
  const departments: Department[] = DEFAULT_DEPARTMENTS.map((d) => ({ id: d.name, name: d.name }));
  const deptOfName: Record<string, string> = {};
  DEFAULT_DEPARTMENTS.forEach((d) => d.wards.forEach((w) => { deptOfName[w] = d.name; }));
  const icu = new Set(DEFAULT_ICU_WARDS);
  const wards: Ward[] = DEFAULT_WARDS.map((name) => ({
    id: name, name, departmentId: deptOfName[name] ?? "", isICU: icu.has(name),
  }));
  return { departments, wards };
}
const FALLBACK = buildDefaults();

function readDeps(): Department[] {
  if (typeof window === "undefined") return FALLBACK.departments;
  try {
    const s = localStorage.getItem(DEP_KEY);
    if (!s) return FALLBACK.departments;
    const parsed = JSON.parse(s) as Department[];
    return parsed.length ? parsed : FALLBACK.departments;
  } catch { return FALLBACK.departments; }
}
function readWards(): Ward[] {
  if (typeof window === "undefined") return FALLBACK.wards;
  try {
    const s = localStorage.getItem(WARD_KEY);
    if (!s) return FALLBACK.wards;
    const parsed = JSON.parse(s) as Ward[];
    return parsed.length ? parsed : FALLBACK.wards;
  } catch { return FALLBACK.wards; }
}
function writeDeps(rows: Department[], sync = true) {
  localStorage.setItem(DEP_KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event(EVENT));
  if (sync) void sbReplaceAll("departments", rows);
}
function writeWards(rows: Ward[], sync = true) {
  localStorage.setItem(WARD_KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event(EVENT));
  if (sync) void sbReplaceAll("wards", rows);
}

// ── synchronous accessors (read cache, fall back to defaults) ───────────────
export function getDepartments(): Department[] { return readDeps(); }
export function getWards(): Ward[] { return readWards(); }
export function wardNames(): string[] { return readWards().map((w) => w.name); }
export function icuWardNames(): string[] { return readWards().filter((w) => w.isICU).map((w) => w.name); }

/** หาแผนกจากชื่อหอผู้ป่วย; ถ้าไม่อยู่ในกลุ่มใด → "อื่นๆ" */
export function departmentOf(wardName: string): string {
  const w = readWards().find((x) => x.name === wardName);
  if (!w || !w.departmentId) return "อื่นๆ";
  return readDeps().find((d) => d.id === w.departmentId)?.name ?? "อื่นๆ";
}

/** กลุ่มแผนก → { name, wards: [ชื่อหอ] } (รูปแบบเดิมที่รายงาน/Dashboard ใช้) */
export function departmentGroups(): { name: string; wards: string[] }[] {
  const ws = readWards();
  return readDeps().map((d) => ({
    name: d.name,
    wards: ws.filter((w) => w.departmentId === d.id).map((w) => w.name),
  }));
}

// ── sync with Supabase ──────────────────────────────────────────────────────
export async function pullDepartments() {
  const rows = await sbAll<Department>("departments");
  if (rows && rows.length) writeDeps(rows, false);
}
export async function pullWards() {
  const rows = await sbAll<Ward>("wards");
  if (rows && rows.length) writeWards(rows, false);
}

/** Seed defaults into the local cache on first run (no Supabase write). */
export function seedWardsIfEmpty() {
  const { departments, wards } = buildDefaults();
  if (!localStorage.getItem(DEP_KEY)) writeDeps(departments, false);
  if (!localStorage.getItem(WARD_KEY)) writeWards(wards, false);
}

/**
 * Reconcile wards/departments with Supabase on startup:
 *   - remote has rows  → use remote (pull into cache)
 *   - remote is empty   → push the local cache up (handles tables created
 *     *after* the app first ran locally — local data would otherwise never sync)
 */
export async function syncWards() {
  seedWardsIfEmpty(); // materialize defaults locally if this is a fresh install
  const [remoteDeps, remoteWards] = await Promise.all([
    sbAll<Department>("departments"),
    sbAll<Ward>("wards"),
  ]);
  if (remoteDeps && remoteDeps.length) writeDeps(remoteDeps, false);
  else void sbReplaceAll("departments", readDeps());
  if (remoteWards && remoteWards.length) writeWards(remoteWards, false);
  else void sbReplaceAll("wards", readWards());
}

// ── mutations ────────────────────────────────────────────────────────────────
type Result = { ok: true } | { ok: false; error: string };

export function addDepartment(name: string): Result {
  const n = name.trim();
  if (!n) return { ok: false, error: "กรุณากรอกชื่อแผนก" };
  const deps = readDeps();
  if (deps.some((d) => d.name === n)) return { ok: false, error: "มีแผนกนี้อยู่แล้ว" };
  writeDeps([...deps, { id: crypto.randomUUID(), name: n }]);
  return { ok: true };
}

export function renameDepartment(id: string, name: string): Result {
  const n = name.trim();
  if (!n) return { ok: false, error: "กรุณากรอกชื่อแผนก" };
  const deps = readDeps();
  if (deps.some((d) => d.name === n && d.id !== id)) return { ok: false, error: "มีแผนกนี้อยู่แล้ว" };
  writeDeps(deps.map((d) => (d.id === id ? { ...d, name: n } : d)));
  return { ok: true };
}

export function deleteDepartment(id: string): Result {
  writeDeps(readDeps().filter((d) => d.id !== id));
  // detach wards that pointed to it
  const ws = readWards();
  if (ws.some((w) => w.departmentId === id))
    writeWards(ws.map((w) => (w.departmentId === id ? { ...w, departmentId: "" } : w)));
  return { ok: true };
}

export function addWard(w: { name: string; departmentId: string; isICU: boolean }): Result {
  const name = w.name.trim();
  if (!name) return { ok: false, error: "กรุณากรอกชื่อหอผู้ป่วย" };
  const ws = readWards();
  if (ws.some((x) => x.name === name)) return { ok: false, error: "มีหอผู้ป่วยนี้อยู่แล้ว" };
  writeWards([...ws, { id: crypto.randomUUID(), name, departmentId: w.departmentId, isICU: w.isICU }]);
  return { ok: true };
}

export function updateWard(
  id: string,
  patch: Partial<{ name: string; departmentId: string; isICU: boolean }>,
): Result {
  const ws = readWards();
  const cur = ws.find((x) => x.id === id);
  if (!cur) return { ok: false, error: "ไม่พบหอผู้ป่วย" };
  const name = patch.name !== undefined ? patch.name.trim() : cur.name;
  if (!name) return { ok: false, error: "กรุณากรอกชื่อหอผู้ป่วย" };
  if (ws.some((x) => x.name === name && x.id !== id)) return { ok: false, error: "มีหอผู้ป่วยนี้อยู่แล้ว" };
  writeWards(ws.map((x) => (x.id === id ? { ...x, ...patch, name } : x)));
  return { ok: true };
}

export function deleteWard(id: string): Result {
  writeWards(readWards().filter((w) => w.id !== id));
  return { ok: true };
}

// ── reactive hooks ────────────────────────────────────────────────────────────
export function useWards(): Ward[] {
  const [rows, setRows] = useState<Ward[]>(() => readWards());
  useEffect(() => {
    const sync = () => setRows(readWards());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return rows;
}

export function useDepartments(): Department[] {
  const [rows, setRows] = useState<Department[]>(() => readDeps());
  useEffect(() => {
    const sync = () => setRows(readDeps());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return rows;
}

/** Reactive list of ward names. */
export function useWardNames(): string[] {
  return useWards().map((w) => w.name);
}
