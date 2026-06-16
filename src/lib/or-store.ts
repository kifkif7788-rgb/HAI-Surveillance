import { useEffect, useState } from "react";
import { sbAll, sbUpsert, sbDelete } from "./supabase";

/**
 * Monthly operating-room (OR) data, recorded per OR department.
 * Surgical wound counts are split by wound class (NW / CW / CCW / CoW / DW)
 * — the denominator basis for surgical-site-infection (SSI) rates.
 */

export type ORDept = "OR IPD" | "OR OPD";
export const OR_DEPTS: ORDept[] = ["OR IPD", "OR OPD"];

/** Surgical wound classes (key, abbreviation, Thai hint). */
export const WOUND_CLASSES = [
  { key: "nw",  label: "NW",  hint: "ไม่มีแผลผ่าตัด (No wound) — ไม่นับเป็นตัวหาร SSI" },
  { key: "cw",  label: "CW",  hint: "แผลสะอาด (Clean)" },
  { key: "ccw", label: "CCW", hint: "แผลสะอาดกึ่งปนเปื้อน (Clean-contaminated)" },
  { key: "cow", label: "CoW", hint: "แผลปนเปื้อน (Contaminated)" },
  { key: "dw",  label: "DW",  hint: "แผลสกปรก/ติดเชื้อ (Dirty)" },
] as const;

export type WoundKey = (typeof WOUND_CLASSES)[number]["key"];

export interface ORMonthlyStat {
  id: string;
  dept: ORDept;
  month: string;       // "yyyy-mm" (CE)
  discharged: number;  // จำนวนผู้ป่วยจำหน่าย
  patientDays: number; // จำนวนวันนอน
  nw: number;
  cw: number;
  ccw: number;
  cow: number;
  dw: number;
}

const KEY   = "hai-or-monthly-v1";
const EVENT = "hai-or-monthly-changed";

function read(): ORMonthlyStat[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(rows: ORMonthlyStat[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event(EVENT));
}

/** Pull OR monthly stats from Supabase into the local cache. */
export async function pullOrStats() {
  const rows = await sbAll<ORMonthlyStat>("or_monthly");
  if (rows) write(rows);
}

type Result = { ok: true } | { ok: false; error: string };

/** Create or update an OR monthly record. Unique by dept + month. */
export function upsertORStat(stat: ORMonthlyStat): Result {
  if (!stat.dept) return { ok: false, error: "กรุณาเลือกแผนก OR" };
  if (!stat.month) return { ok: false, error: "กรุณาเลือกเดือน" };
  const nums = [stat.discharged, stat.patientDays, stat.nw, stat.cw, stat.ccw, stat.cow, stat.dw];
  if (nums.some((n) => !Number.isFinite(n) || n < 0))
    return { ok: false, error: "จำนวนต้องเป็นค่าไม่ติดลบ" };

  const rows = read();
  if (rows.some((r) => r.dept === stat.dept && r.month === stat.month && r.id !== stat.id))
    return { ok: false, error: "มีข้อมูลของแผนกนี้ในเดือนนี้อยู่แล้ว" };

  const idx = rows.findIndex((r) => r.id === stat.id);
  if (idx >= 0) rows[idx] = stat; else rows.push(stat);
  write(rows);
  void sbUpsert("or_monthly", stat);
  return { ok: true };
}

export function deleteORStat(id: string) {
  write(read().filter((r) => r.id !== id));
  void sbDelete("or_monthly", id);
}

export function useORStats(): ORMonthlyStat[] {
  const [rows, setRows] = useState<ORMonthlyStat[]>(() => read());
  useEffect(() => {
    const sync = () => setRows(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return rows;
}
