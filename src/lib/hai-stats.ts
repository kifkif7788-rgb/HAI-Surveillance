import type { PatientRecord } from "./hai-types";
import { evaluate } from "./rule-engine";
import type { MonthlyStat } from "./monthly-store";
import type { ORMonthlyStat } from "./or-store";

/**
 * Map a stored result label (rule-engine output) → report category key.
 * Order matters: "no infection" and community (CI) are checked before the
 * specific infection types so substrings (e.g. "VAP" inside "ไม่มีการติดเชื้อ VAP/HAP/CAP",
 * or "UTI" inside "CAUTI") don't cause mis-bucketing.
 */
export function categorize(result?: string): string {
  if (!result) return "NONE";
  if (result.includes("ไม่มีการติดเชื้อ") || result.includes("ไม่สามารถสรุป") || result.includes("ยังไม่ได้เลือก")) return "NONE";
  if (result.startsWith("CI")) return "CI";
  if (result.includes("VAP")) return "VAP";
  if (result.includes("HAP")) return "HAP";
  if (result.includes("CLABSI")) return "CLABSI";
  if (result.includes("2'BSI")) return "2'BSI";
  if (result.includes("BSI")) return "BSI";
  if (result.includes("CAUTI")) return "CAUTI";
  if (result.includes("UTI")) return "UTI";
  if (result.includes("GI")) return "GI";
  if (result.includes("SSI")) return "SSI";
  return "NONE";
}

/** Hospital-acquired infection categories (excludes community CI and NONE). */
const HAI_KEYS = new Set(["VAP", "HAP", "GI", "UTI", "CLABSI", "BSI", "2'BSI", "CAUTI", "SSI"]);

export function isHAI(result?: string): boolean {
  return HAI_KEYS.has(categorize(result));
}

/**
 * Return ALL category keys for a record. One patient with multiple infection
 * sites (e.g. VAP + CLABSI) contributes to each relevant category bucket.
 * Uses evaluate() so every site is evaluated, not just the first stored label.
 * Falls back to [categorize(r.result)] when evaluate yields no HAI/CI results.
 */
export function categorizeAll(r: PatientRecord): string[] {
  const results = evaluate(r);
  const cats = results.map((x) => categorize(x.label)).filter((c) => c !== "NONE");
  if (cats.length === 0) return ["NONE"];
  return [...new Set(cats)];
}

export interface MonthlyRate {
  month: string;        // "yyyy-mm"
  infections: number;   // HAI count that month
  patientDays: number;
  discharged: number;
  totalPatients: number;
  ratePer1000: number;  // infections / patient-days × 1000
  // device-associated
  ventilatorDays: number; centralLineDays: number; catheterDays: number;
  vap: number;    clabsi: number;    cauti: number;
  vapRate: number; clabsiRate: number; cautiRate: number; // per 1,000 device-days
}

const rate = (n: number, d: number) => (d > 0 ? (n / d) * 1000 : 0);

/**
 * Join HAI infection counts (by DOE month) with monthly denominator data.
 * Only months that have a denominator record are returned (rate needs a divisor).
 * Device-associated rates use the matching device-days as denominator.
 * Sorted by month ascending.
 */
export function computeMonthlyRates(records: PatientRecord[], stats: MonthlyStat[]): MonthlyRate[] {
  const haiByMonth = new Map<string, number>();
  const catByMonth = new Map<string, { VAP: number; CLABSI: number; CAUTI: number }>();

  records.forEach((r) => {
    const ym = (r.doeDate || r.createdAt || "").slice(0, 7);
    if (!ym) return;
    const cat = categorize(r.result);
    if (HAI_KEYS.has(cat)) haiByMonth.set(ym, (haiByMonth.get(ym) ?? 0) + 1);
    if (cat === "VAP" || cat === "CLABSI" || cat === "CAUTI") {
      const m = catByMonth.get(ym) ?? { VAP: 0, CLABSI: 0, CAUTI: 0 };
      m[cat] += 1;
      catByMonth.set(ym, m);
    }
  });

  // denominators may now be split across wards → aggregate per month
  const denomByMonth = new Map<string, { patientDays: number; discharged: number; totalPatients: number; ventilatorDays: number; centralLineDays: number; catheterDays: number }>();
  stats.forEach((s) => {
    const a = denomByMonth.get(s.month) ?? { patientDays: 0, discharged: 0, totalPatients: 0, ventilatorDays: 0, centralLineDays: 0, catheterDays: 0 };
    a.patientDays     += s.patientDays;
    a.discharged      += s.discharged;
    a.totalPatients   += s.totalPatients;
    a.ventilatorDays  += s.ventilatorDays;
    a.centralLineDays += s.centralLineDays;
    a.catheterDays    += s.catheterDays;
    denomByMonth.set(s.month, a);
  });

  return [...denomByMonth.entries()]
    .map(([month, d]) => {
      const infections = haiByMonth.get(month) ?? 0;
      const c = catByMonth.get(month) ?? { VAP: 0, CLABSI: 0, CAUTI: 0 };
      return {
        month,
        infections,
        patientDays: d.patientDays,
        discharged: d.discharged,
        totalPatients: d.totalPatients,
        ratePer1000: rate(infections, d.patientDays),
        ventilatorDays: d.ventilatorDays,
        centralLineDays: d.centralLineDays,
        catheterDays: d.catheterDays,
        vap: c.VAP, clabsi: c.CLABSI, cauti: c.CAUTI,
        vapRate:    rate(c.VAP, d.ventilatorDays),
        clabsiRate: rate(c.CLABSI, d.centralLineDays),
        cautiRate:  rate(c.CAUTI, d.catheterDays),
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function overallRate(rates: MonthlyRate[]): { infections: number; patientDays: number; ratePer1000: number } {
  const infections  = rates.reduce((s, r) => s + r.infections, 0);
  const patientDays = rates.reduce((s, r) => s + r.patientDays, 0);
  return { infections, patientDays, ratePer1000: rate(infections, patientDays) };
}

// ── SSI rate: SSI cases ÷ surgical wounds × 100 (facility-wide) ─────────────

export interface SSIMonth { month: string; ssi: number; wounds: number; ratePct: number; }

/** Join SSI case counts (by DOE month) with OR surgical-wound totals per month. */
export function computeSSIRates(records: PatientRecord[], orStats: ORMonthlyStat[]): SSIMonth[] {
  const ssiByMonth = new Map<string, number>();
  records.forEach((r) => {
    if (categorize(r.result) !== "SSI") return;
    const ym = (r.doeDate || r.createdAt || "").slice(0, 7);
    if (ym) ssiByMonth.set(ym, (ssiByMonth.get(ym) ?? 0) + 1);
  });

  const woundsByMonth = new Map<string, number>();
  orStats.forEach((s) => {
    // ใช้เฉพาะ OR IPD เป็นตัวหาร SSI (ไม่รวม OR OPD)
    if (s.dept !== "OR IPD") return;
    // NW = ไม่มีแผลผ่าตัด → excluded from the SSI denominator (actual wounds only)
    const w = s.cw + s.ccw + s.cow + s.dw;
    woundsByMonth.set(s.month, (woundsByMonth.get(s.month) ?? 0) + w);
  });

  return [...woundsByMonth.entries()]
    .map(([month, wounds]) => {
      const ssi = ssiByMonth.get(month) ?? 0;
      return { month, ssi, wounds, ratePct: wounds > 0 ? (ssi / wounds) * 100 : 0 };
    })
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function overallSSIRate(rows: SSIMonth[]): { ssi: number; wounds: number; ratePct: number } {
  const ssi    = rows.reduce((s, r) => s + r.ssi, 0);
  const wounds = rows.reduce((s, r) => s + r.wounds, 0);
  return { ssi, wounds, ratePct: wounds > 0 ? (ssi / wounds) * 100 : 0 };
}

/** Device-associated infection rate + device utilization ratio (DUR) per device type. */
export interface DeviceStat {
  label: string;        // ชื่ออุปกรณ์ (ไทย)
  infection: string;    // ชนิดการติดเชื้อ
  infections: number;
  deviceDays: number;
  ratePer1000: number;  // infections / device-days × 1000
  dur: number;          // device-days / patient-days
}

export function deviceSummary(rates: MonthlyRate[]): { patientDays: number; devices: DeviceStat[] } {
  const sum = (f: (r: MonthlyRate) => number) => rates.reduce((s, r) => s + f(r), 0);
  const patientDays = sum((r) => r.patientDays);
  const mk = (label: string, infection: string, infections: number, deviceDays: number): DeviceStat => ({
    label, infection, infections, deviceDays,
    ratePer1000: deviceDays > 0 ? (infections / deviceDays) * 1000 : 0,
    dur: patientDays > 0 ? deviceDays / patientDays : 0,
  });
  return {
    patientDays,
    devices: [
      mk("เครื่องช่วยหายใจ (Ventilator)",        "VAP",    sum((r) => r.vap),    sum((r) => r.ventilatorDays)),
      mk("สายสวนหลอดเลือดดำส่วนกลาง (Central line)", "CLABSI", sum((r) => r.clabsi), sum((r) => r.centralLineDays)),
      mk("สายสวนปัสสาวะ (Urinary catheter)",      "CAUTI",  sum((r) => r.cauti),  sum((r) => r.catheterDays)),
    ],
  };
}

export interface DeviceRate { label: string; infections: number; deviceDays: number; ratePer1000: number; }

/** Overall device-associated rates (summed across all months with data). */
export function overallDeviceRates(rates: MonthlyRate[]): DeviceRate[] {
  const sum = (f: (r: MonthlyRate) => number) => rates.reduce((s, r) => s + f(r), 0);
  const vap = sum((r) => r.vap),       ventDays = sum((r) => r.ventilatorDays);
  const cla = sum((r) => r.clabsi),    lineDays = sum((r) => r.centralLineDays);
  const cau = sum((r) => r.cauti),     cathDays = sum((r) => r.catheterDays);
  return [
    { label: "VAP / 1,000 vent-days",    infections: vap, deviceDays: ventDays, ratePer1000: rate(vap, ventDays) },
    { label: "CLABSI / 1,000 line-days", infections: cla, deviceDays: lineDays, ratePer1000: rate(cla, lineDays) },
    { label: "CAUTI / 1,000 cath-days",  infections: cau, deviceDays: cathDays, ratePer1000: rate(cau, cathDays) },
  ];
}
