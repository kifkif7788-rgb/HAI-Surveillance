import { useEffect, useState } from "react";
import { WARD_RENAMES } from "./hai-store";
import { sbAll, sbUpsert, sbDelete, sbReplaceAll } from "./supabase";

/**
 * Monthly denominator data (admin-entered) used as the basis for
 * infection-rate calculations: patient-days, discharges, total patients.
 * One record per month, stored in localStorage.
 */

export interface MonthlyStat {
  id: string;
  ward: string;           // แผนก / หอผู้ป่วย (เจ้าของข้อมูล)
  month: string;          // "yyyy-mm" (CE)
  patientDays: number;    // จำนวนวันนอน
  discharged: number;     // จำนวนผู้ป่วยจำหน่าย
  totalPatients: number;  // จำนวนผู้ป่วยทั้งหมด
  ventilatorDays: number; // วันใช้เครื่องช่วยหายใจ (สำหรับ VAP rate)
  centralLineDays: number; // วันคาสายสวนหลอดเลือดดำส่วนกลาง (สำหรับ CLABSI rate)
  catheterDays: number;   // วันคาสายสวนปัสสาวะ (สำหรับ CAUTI rate)
}

const KEY   = "hai-monthly-v1";
const EVENT = "hai-monthly-changed";

function read(): MonthlyStat[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || "[]") as MonthlyStat[];
    // Backfill device-day fields added after initial release
    return rows.map((r) => ({
      ...r,
      ward: r.ward ?? "",
      ventilatorDays: r.ventilatorDays ?? 0,
      centralLineDays: r.centralLineDays ?? 0,
      catheterDays: r.catheterDays ?? 0,
    }));
  } catch { return []; }
}
function write(rows: MonthlyStat[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event(EVENT));
}

/** Pull monthly stats from Supabase into the local cache. */
export async function pullMonthly() {
  const rows = await sbAll<MonthlyStat>("monthly");
  if (rows) write(rows);
}

type Result = { ok: true } | { ok: false; error: string };

/** Create or update a monthly record. Month is unique across records. */
export function upsertMonthlyStat(stat: MonthlyStat): Result {
  if (!stat.ward) return { ok: false, error: "กรุณาเลือกแผนก" };
  if (!stat.month) return { ok: false, error: "กรุณาเลือกเดือน" };
  if ([stat.patientDays, stat.discharged, stat.totalPatients, stat.ventilatorDays, stat.centralLineDays, stat.catheterDays]
        .some((n) => !Number.isFinite(n) || n < 0))
    return { ok: false, error: "จำนวนต้องเป็นค่าไม่ติดลบ" };

  const rows = read();
  if (rows.some((r) => r.ward === stat.ward && r.month === stat.month && r.id !== stat.id))
    return { ok: false, error: "มีข้อมูลของแผนกนี้ในเดือนนี้อยู่แล้ว" };

  const idx = rows.findIndex((r) => r.id === stat.id);
  if (idx >= 0) rows[idx] = stat; else rows.push(stat);
  write(rows);
  void sbUpsert("monthly", stat);
  return { ok: true };
}

export function deleteMonthlyStat(id: string) {
  write(read().filter((r) => r.id !== id));
  void sbDelete("monthly", id);
}

/** Apply backward-compatible ward renames to monthly records (idempotent). */
export function migrateMonthlyWards() {
  const rows = read();
  let changed = false;
  const next = rows.map((r) => {
    const renamed = WARD_RENAMES[r.ward];
    if (renamed) { changed = true; return { ...r, ward: renamed }; }
    return r;
  });
  if (changed) { write(next); void sbReplaceAll("monthly", next); }
}

export function useMonthlyStats(): MonthlyStat[] {
  const [rows, setRows] = useState<MonthlyStat[]>(() => read());
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
