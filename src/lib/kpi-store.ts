import { useEffect, useState } from "react";
import { sbAll, sbReplaceAll } from "./supabase";

/** Manual KPI entry — one value per year per key */
export interface ManualKPIEntry {
  id: string;
  year: number;   // CE year (2025 = BE 2568)
  key: string;    // e.g. "surveillance_1", "icwn", "outbreak_ward"
  value: number;
  note?: string;
}

const KEY   = "hai-kpi-manual-v1";
const EVENT = "hai-kpi-changed";

function read(): ManualKPIEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(rows: ManualKPIEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event(EVENT));
  void sbReplaceAll("kpi_manual", rows);
}

export async function pullKPI() {
  const rows = await sbAll<ManualKPIEntry>("kpi_manual");
  if (rows && rows.length) {
    localStorage.setItem(KEY, JSON.stringify(rows));
    window.dispatchEvent(new Event(EVENT));
  }
}

export function getKPIValue(key: string, year: number): number | null {
  const e = read().find((r) => r.key === key && r.year === year);
  return e ? e.value : null;
}

export function setKPIValue(key: string, year: number, value: number, note?: string): void {
  const rows = read();
  const idx = rows.findIndex((r) => r.key === key && r.year === year);
  const entry: ManualKPIEntry = {
    id: idx >= 0 ? rows[idx].id : crypto.randomUUID(),
    year, key, value, note,
  };
  if (idx >= 0) rows[idx] = entry; else rows.push(entry);
  write(rows);
}

export function useManualKPIs(): ManualKPIEntry[] {
  const [rows, setRows] = useState<ManualKPIEntry[]>(() => read());
  useEffect(() => {
    const sync = () => setRows(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return rows;
}
