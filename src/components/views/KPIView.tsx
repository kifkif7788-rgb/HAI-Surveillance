import { useState, useMemo } from "react";
import { useRecords } from "@/lib/hai-store";
import { useMonthlyStats } from "@/lib/monthly-store";
import { useORStats } from "@/lib/or-store";
import { computeMonthlyRates, overallRate, deviceSummary, computeSSIRates, overallSSIRate, categorizeAll } from "@/lib/hai-stats";
import { evaluate } from "@/lib/rule-engine";
import { statWard } from "@/lib/ward-store";
import { setKPIValue, useManualKPIs } from "@/lib/kpi-store";
import { cn } from "@/lib/utils";
import type { PatientRecord } from "@/lib/hai-types";
import type { MonthlyStat } from "@/lib/monthly-store";

// ── ประวัติปี 64-68 (CE 2021-2025) ──────────────────────────────────────────
const HIST_LABELS = ["64", "65", "66", "67", "68"];

type HistKey =
  | "overall" | "clabsi" | "vap" | "cauti"
  | "nicu" | "picu" | "sicu" | "nsicu" | "pcicu"
  | "nb_med" | "nb_surg" | "dhf"
  | "ssi_ipd" | "ssi_clean" | "ssi_opd" | "amr"
  | "icwn" | "ic_ipd" | "ic_opd" | "ic_equip"
  | "outbreak_ward" | "flu_vaccine" | "staff_outbreak"
  | "water_contam";

const HIST: Record<HistKey, (number | null)[]> = {
  overall:       [4.84, 4.17, 2.27, 2.88, 3.38],
  clabsi:        [4.59, 4.38, 1.99, 3.52, 3.80],
  vap:           [9.88, 8.64, 2.20, 2.05, 1.40],
  cauti:         [5.90, 3.48, 1.93, 1.33, 2.38],
  nicu:          [8.99, 10.84, 4.44, 5.62, 7.48],
  picu:          [29.20, 23.64, 6.03, 10.47, 13.06],
  sicu:          [21.48, 18.88, 5.28, 5.21, 16.49],
  nsicu:         [13.26, 9.27, 7.46, 12.27, 8.67],
  pcicu:         [null, null, null, null, 9.26],
  nb_med:        [5.78, 5.16, 2.59, 2.62, 2.54],
  nb_surg:       [10.16, 6.56, 4.90, 8.41, 6.78],
  dhf:           [0.00, 0.00, 0.00, 0.00, 0.42],
  ssi_ipd:       [0.66, 0.50, 0.15, 0.36, 0.32],
  ssi_clean:     [0.06, 0.11, 0.09, 0.14, 0.19],
  ssi_opd:       [0.49, 0.00, 0.00, 0.00, 0.00],
  amr:           [1.73, 1.64, 0.79, 0.93, 1.41],
  icwn:          [80.35, 79.17, 76.88, 86.92, 79.04],
  ic_ipd:        [93.13, null, 98.93, 97.05, 97.49],
  ic_opd:        [94.24, null, 93.08, null, 93.98],
  ic_equip:      [100, null, 93.70, null, 100],
  outbreak_ward: [3, 9, 12, 11, 8],
  flu_vaccine:   [71.22, 70.82, 88.75, 94.38, 90],
  staff_outbreak:[0, 7, 1, 3, 4],
  water_contam:  [17.05, 16.03, 5.71, 8.87, null],
};

// ── Ward groupings ────────────────────────────────────────────────────────────
const NB_MED_WARDS  = ["NICU", "NIMCU 9", "NIMCU 10"];
const NB_SURG_WARDS = ["PCICU"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function filterByYear(records: PatientRecord[], stats: MonthlyStat[], orStats: ReturnType<typeof useORStats>, year: number) {
  const y = String(year);
  const recs = records.filter((r) => (r.doeDate || r.createdAt || "").startsWith(y));
  const sts  = stats.filter((s) => s.month.startsWith(y));
  const ors  = orStats.filter((s) => s.month.startsWith(y));
  return { recs, sts, ors };
}

function wardHAIRate(records: PatientRecord[], stats: MonthlyStat[], wards: string[]): number | null {
  const set = new Set(wards);
  const haiCount = records.filter((r) =>
    set.has(r.ward) && categorizeAll(r).some((c) => !["NONE", "CI"].includes(c))
  ).length;
  const pd = stats.reduce((sum, s) => {
    if (set.has(s.ward)) return sum + s.patientDays;
    if (wards.some((w) => statWard(w) === s.ward)) return sum + s.patientDays;
    return sum;
  }, 0);
  return pd > 0 ? (haiCount / pd) * 1000 : null;
}

function amrHAIRate(records: PatientRecord[], stats: MonthlyStat[]): number | null {
  const amrCount = records.filter((r) =>
    Object.values(r.mdroBySite ?? {}).some((arr) => arr.some(Boolean)) &&
    evaluate(r).some((x) => x.category === "HAI")
  ).length;
  const pd = stats.reduce((s, x) => s + x.patientDays, 0);
  return pd > 0 ? (amrCount / pd) * 1000 : null;
}

// ── Status indicator ─────────────────────────────────────────────────────────
type Direction = "lower" | "higher" | "equal";
function kpiStatus(value: number | null, target: number, dir: Direction): "met" | "near" | "miss" | "none" {
  if (value === null) return "none";
  if (dir === "lower")  return value <= target ? "met" : value <= target * 1.25 ? "near" : "miss";
  if (dir === "higher") return value >= target ? "met" : value >= target * 0.85 ? "near" : "miss";
  return value === target ? "met" : value >= target * 0.9 ? "near" : "miss";
}
const STATUS_CLS: Record<string, string> = {
  met:  "bg-mint text-mint-foreground",
  near: "bg-lemon text-lemon-foreground",
  miss: "bg-pink text-pink-foreground",
  none: "bg-muted text-muted-foreground",
};
const STATUS_ICON: Record<string, string> = { met: "🟢", near: "🟡", miss: "🔴", none: "—" };

// ── Shared styles ─────────────────────────────────────────────────────────────
const thCls = "p-2 text-xs font-semibold text-center border border-border/60 bg-sky/20 whitespace-nowrap";
const tdCls = "p-2 text-xs text-center border border-border/40 tabular-nums";
const tdLCls = "p-2 text-xs border border-border/40 font-medium";

// ── Main view ─────────────────────────────────────────────────────────────────
export function KPIView({ isAdmin = false }: { isAdmin?: boolean }) {
  const allRecords = useRecords();
  const allStats   = useMonthlyStats();
  const allOrStats = useORStats();
  const manualKPIs = useManualKPIs();

  const nowCE = new Date().getFullYear();
  const [viewYear, setViewYear] = useState(nowCE);

  const { recs, sts, ors } = useMemo(
    () => filterByYear(allRecords, allStats, allOrStats, viewYear),
    [allRecords, allStats, allOrStats, viewYear],
  );

  // ── computed KPIs ──
  const rates  = useMemo(() => computeMonthlyRates(recs, sts), [recs, sts]);
  const ov     = useMemo(() => overallRate(rates), [rates]);
  const { devices } = useMemo(() => deviceSummary(rates), [rates]);
  const d = (key: "VAP" | "CLABSI" | "CAUTI") => devices.find((x) => x.infection === key);

  const ssiRows = useMemo(() => computeSSIRates(recs, ors), [recs, ors]);
  const ssiOv   = useMemo(() => overallSSIRate(ssiRows), [ssiRows]);
  const ssiOvOPD = useMemo(() => {
    const opd = ors.filter((s) => s.dept === "OR OPD");
    return overallSSIRate(computeSSIRates(recs, opd));
  }, [recs, ors]);

  const overallRateVal = ov.patientDays > 0 ? ov.ratePer1000 : null;
  const vapRate   = d("VAP")?.ratePer1000 ?? null;
  const clabsiRate = d("CLABSI")?.ratePer1000 ?? null;
  const cautiRate  = d("CAUTI")?.ratePer1000 ?? null;
  const amrRate    = useMemo(() => amrHAIRate(recs, sts), [recs, sts]);

  const icuRates = useMemo(() => ({
    nicu:  wardHAIRate(recs, sts, ["NICU"]),
    picu:  wardHAIRate(recs, sts, ["PICU"]),
    sicu:  wardHAIRate(recs, sts, ["SICU"]),
    nsicu: wardHAIRate(recs, sts, ["NSICU"]),
    pcicu: wardHAIRate(recs, sts, ["PCICU"]),
  }), [recs, sts]);

  const excRates = useMemo(() => ({
    nb_med:  wardHAIRate(recs, sts, NB_MED_WARDS),
    nb_surg: wardHAIRate(recs, sts, NB_SURG_WARDS),
    dhf:     null as number | null, // no matching ward → manual
  }), [recs, sts]);

  // ── helpers for manual KPIs ──
  const hist  = (key: HistKey, i: number) => HIST[key]?.[i] ?? null;
  const manual = (key: string) => {
    const e = manualKPIs.find((m) => m.key === key && m.year === viewYear);
    return e?.value ?? null;
  };

  const yearOptions = [...new Set([
    ...Array.from({ length: 5 }, (_, i) => nowCE - 4 + i),
    nowCE,
  ])].sort((a, b) => b - a);

  const beYear = (ce: number) => ce + 543;
  const histIdx = (ce: number) => {
    const map: Record<number, number> = { 2021: 0, 2022: 1, 2023: 2, 2024: 3, 2025: 4 };
    return map[ce] ?? -1;
  };

  const selectCls = "px-3 py-1.5 rounded-xl border border-border bg-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring";

  // ── computed or historical value (based on year) ──
  const val = (
    computedVal: number | null,
    key: HistKey,
    ce: number,
    digits = 2,
  ): string => {
    const hi = histIdx(ce);
    const v = hi >= 0 ? hist(key, hi) : computedVal;
    return v !== null ? v.toFixed(digits) : "—";
  };

  // ── tag: computed vs manual ──
  const Computed = () => <span className="text-[9px] bg-sky/40 text-sky-foreground rounded px-1 ml-0.5">คำนวณ</span>;
  const Manual   = () => <span className="text-[9px] bg-lavender/40 text-lavender-foreground rounded px-1 ml-0.5">กรอก</span>;

  return (
    <div className="space-y-5">
      {/* Header + year filter */}
      <div className="card-soft p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-bold text-primary text-lg">📋 ตัวชี้วัดหลัก (KPI)</div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">📅 ปี พ.ศ.</span>
            <select value={viewYear} onChange={(e) => setViewYear(Number(e.target.value))} className={selectCls}>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{beYear(y)} {y === nowCE ? "(ปัจจุบัน)" : ""}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span>🟢 ผ่านเกณฑ์</span>
          <span>🟡 ใกล้เกณฑ์ (±20%)</span>
          <span>🔴 ไม่ผ่านเกณฑ์</span>
          <span><Computed /> = คำนวณจากข้อมูลในระบบ</span>
          <span><Manual /> = กรอกข้อมูลเอง</span>
        </div>
      </div>

      {/* KPI 1 — อัตราการติดเชื้อภาพรวม */}
      <KPISection title="1. อัตราการติดเชื้อภาพรวมของสถาบันฯ" process="แนวปฏิบัติ Infection Control">
        <KPITable
          cols={HIST_LABELS}
          rows={[{
            label: "อัตราการติดเชื้อภาพรวม",
            tag: <Computed />,
            target: "≤ 5",
            unit: "/1,000 วันนอน",
            dir: "lower",
            current: viewYear === nowCE ? overallRateVal : null,
            hist: HIST.overall,
            kpiKey: "overall",
          }]}
          viewYear={viewYear}
          nowCE={nowCE}
        />
      </KPISection>

      {/* KPI 2 — Device rates */}
      <KPISection title="2. อัตราการติดเชื้อเฉพาะตำแหน่ง" process="แนวปฏิบัติลดความเสี่ยงการติดเชื้อจากการดูแลรักษา">
        <KPITable
          cols={HIST_LABELS}
          rows={[
            { label: "CLABSI", tag: <Computed />, target: "≤ 7", unit: "/1,000 central line-days", dir: "lower", current: viewYear === nowCE ? clabsiRate : null, hist: HIST.clabsi, kpiKey: "clabsi" },
            { label: "VAP",    tag: <Computed />, target: "≤ 7", unit: "/1,000 ventilator-days",   dir: "lower", current: viewYear === nowCE ? vapRate   : null, hist: HIST.vap,    kpiKey: "vap"    },
            { label: "CAUTI",  tag: <Computed />, target: "≤ 4", unit: "/1,000 catheter-days",     dir: "lower", current: viewYear === nowCE ? cautiRate : null, hist: HIST.cauti,  kpiKey: "cauti"  },
          ]}
          viewYear={viewYear}
          nowCE={nowCE}
        />
      </KPISection>

      {/* KPI 3 — ICU rates */}
      <KPISection title="3. อัตราการติดเชื้อในกลุ่มเสี่ยง (ICU)" process="แนวปฏิบัติในการดูแลผู้ป่วยกลุ่มวิกฤต">
        <KPITable
          cols={HIST_LABELS}
          rows={[
            { label: "NICU",  tag: <Computed />, target: "≤ 11", unit: "/1,000 วันนอน", dir: "lower", current: viewYear === nowCE ? icuRates.nicu  : null, hist: HIST.nicu,  kpiKey: "nicu"  },
            { label: "PICU",  tag: <Computed />, target: "≤ 11", unit: "/1,000 วันนอน", dir: "lower", current: viewYear === nowCE ? icuRates.picu  : null, hist: HIST.picu,  kpiKey: "picu"  },
            { label: "SICU",  tag: <Computed />, target: "≤ 11", unit: "/1,000 วันนอน", dir: "lower", current: viewYear === nowCE ? icuRates.sicu  : null, hist: HIST.sicu,  kpiKey: "sicu"  },
            { label: "NSICU", tag: <Computed />, target: "≤ 11", unit: "/1,000 วันนอน", dir: "lower", current: viewYear === nowCE ? icuRates.nsicu : null, hist: HIST.nsicu, kpiKey: "nsicu" },
            { label: "PCICU", tag: <Computed />, target: "≤ 11", unit: "/1,000 วันนอน", dir: "lower", current: viewYear === nowCE ? icuRates.pcicu : null, hist: HIST.pcicu, kpiKey: "pcicu" },
          ]}
          viewYear={viewYear}
          nowCE={nowCE}
        />
      </KPISection>

      {/* KPI 4 — Excellence group */}
      <KPISection title="4. อัตราการติดเชื้อกลุ่ม Excellence" process="แนวปฏิบัติในการดูแลผู้ป่วยกลุ่มทารกแรกเกิดวิกฤต">
        <KPITable
          cols={HIST_LABELS}
          rows={[
            { label: "NB Med",    tag: <Computed />, target: "≤ 4", unit: "/1,000 วันนอน", dir: "lower", current: viewYear === nowCE ? excRates.nb_med  : null, hist: HIST.nb_med,  kpiKey: "nb_med"  },
            { label: "NB Surg",   tag: <Computed />, target: "≤ 7", unit: "/1,000 วันนอน", dir: "lower", current: viewYear === nowCE ? excRates.nb_surg : null, hist: HIST.nb_surg, kpiKey: "nb_surg" },
            { label: "ศูนย์ DHF", tag: <Manual />,   target: "≤ 1", unit: "/1,000 วันนอน", dir: "lower", current: manual("dhf"), hist: HIST.dhf, kpiKey: "dhf", manualKey: "dhf" },
          ]}
          viewYear={viewYear}
          nowCE={nowCE}
          isAdmin={isAdmin}
          onSave={setKPIValue}
        />
        <p className="text-[10px] text-muted-foreground mt-1">NB Med = NICU + NIMCU 9 + NIMCU 10 · NB Surg = PCICU</p>
      </KPISection>

      {/* KPI 5 — Surveillance efficiency */}
      <KPISection title="5. ประสิทธิภาพการเฝ้าระวัง" process="การสำรวจความชุกของการติดเชื้อในสถาบันฯ">
        <KPITable
          cols={HIST_LABELS}
          rows={[
            { label: "ครั้งที่ 1", tag: <Manual />, target: "≥ 80", unit: "%", dir: "higher",
              current: manual("surveillance_1"),
              hist: [89.74, 76.92, 80.00, 80.00, 78.57],
              kpiKey: "surveillance_1", manualKey: "surveillance_1" },
            { label: "ครั้งที่ 2", tag: <Manual />, target: "≥ 80", unit: "%", dir: "higher",
              current: manual("surveillance_2"),
              hist: [null, null, 84.21, 81.25, 87.00],
              kpiKey: "surveillance_2", manualKey: "surveillance_2" },
          ]}
          viewYear={viewYear}
          nowCE={nowCE}
          isAdmin={isAdmin}
          onSave={setKPIValue}
        />
      </KPISection>

      {/* KPI 6 — SSI */}
      <KPISection title="6. อัตราการติดเชื้อแผลผ่าตัด (SSI)" process="แนวทางปฏิบัติการป้องกันการติดเชื้อที่ตำแหน่งผ่าตัด">
        <KPITable
          cols={HIST_LABELS}
          rows={[
            { label: "SSI OR-IPD",      tag: <Computed />, target: "≤ 2", unit: "%", dir: "lower", current: viewYear === nowCE ? (ssiOv.wounds  > 0 ? ssiOv.ratePct   : null) : null, hist: HIST.ssi_ipd,   kpiKey: "ssi_ipd"   },
            { label: "SSI Clean Wound", tag: <Computed />, target: "≤ 1", unit: "%", dir: "lower", current: null,                                                                        hist: HIST.ssi_clean, kpiKey: "ssi_clean" },
            { label: "SSI OR-OPD",      tag: <Computed />, target: "≤ 2", unit: "%", dir: "lower", current: viewYear === nowCE ? (ssiOvOPD.wounds > 0 ? ssiOvOPD.ratePct : null) : null, hist: HIST.ssi_opd, kpiKey: "ssi_opd"   },
          ]}
          viewYear={viewYear}
          nowCE={nowCE}
        />
      </KPISection>

      {/* KPI 7 — AMR */}
      <KPISection title="7. อัตราการติดเชื้อดื้อยา" process="แนวปฏิบัติในการป้องกันการติดเชื้อดื้อยา">
        <KPITable
          cols={HIST_LABELS}
          rows={[{ label: "อัตราเชื้อดื้อยา (AMR)", tag: <Computed />, target: "≤ 3", unit: "/1,000 วันนอน", dir: "lower", current: viewYear === nowCE ? amrRate : null, hist: HIST.amr, kpiKey: "amr" }]}
          viewYear={viewYear}
          nowCE={nowCE}
        />
      </KPISection>

      {/* KPI 8 — ICWN */}
      <KPISection title="8. ผลการประเมินวัดความรู้และทักษะ ICWN" process="จัดอบรมให้ความรู้เรื่องการป้องกันและควบคุมการติดเชื้อแก่ ICWN">
        <KPITable
          cols={HIST_LABELS}
          rows={[{ label: "ผล ICWN", tag: <Manual />, target: "≥ 75", unit: "%", dir: "higher", current: manual("icwn"), hist: HIST.icwn, kpiKey: "icwn", manualKey: "icwn" }]}
          viewYear={viewYear}
          nowCE={nowCE}
          isAdmin={isAdmin}
          onSave={setKPIValue}
        />
      </KPISection>

      {/* KPI 9 — IC check */}
      <KPISection title="9. ผลการตรวจสอบระบบการป้องกันการติดเชื้อ" process="การตรวจสอบคุณภาพระบบการป้องกันและควบคุมการติดเชื้อ">
        <KPITable
          cols={HIST_LABELS}
          rows={[
            { label: "หอผู้ป่วยใน (IC-IPD)",    tag: <Manual />, target: "≥ 80",  unit: "%", dir: "higher", current: manual("ic_ipd"),   hist: HIST.ic_ipd,  kpiKey: "ic_ipd",   manualKey: "ic_ipd"   },
            { label: "หน่วยบริการผู้ป่วยนอก",    tag: <Manual />, target: "≥ 80",  unit: "%", dir: "higher", current: manual("ic_opd"),   hist: HIST.ic_opd,  kpiKey: "ic_opd",   manualKey: "ic_opd"   },
            { label: "เครื่องใช้กลาง",            tag: <Manual />, target: "= 100", unit: "%", dir: "equal",  current: manual("ic_equip"), hist: HIST.ic_equip, kpiKey: "ic_equip", manualKey: "ic_equip" },
          ]}
          viewYear={viewYear}
          nowCE={nowCE}
          isAdmin={isAdmin}
          onSave={setKPIValue}
        />
      </KPISection>

      {/* KPI 10 — Outbreak */}
      <KPISection title="10. จำนวนครั้งที่เกิดการแพร่กระจายเชื้อในหอผู้ป่วย" process="แนวทางการสอบสวนโรคและควบคุมการระบาด">
        <KPITable
          cols={HIST_LABELS}
          rows={[{ label: "การระบาดในหอผู้ป่วย", tag: <Manual />, target: "= 0", unit: "ครั้ง", dir: "equal", current: manual("outbreak_ward"), hist: HIST.outbreak_ward, kpiKey: "outbreak_ward", manualKey: "outbreak_ward", targetNum: 0 }]}
          viewYear={viewYear}
          nowCE={nowCE}
          isAdmin={isAdmin}
          onSave={setKPIValue}
        />
      </KPISection>

      {/* KPI 11 — Vaccine */}
      <KPISection title="11. การส่งเสริมภูมิคุ้มกัน" process="การส่งเสริมภูมิคุ้มกัน">
        <KPITable
          cols={HIST_LABELS}
          rows={[
            { label: "ประเมินภูมิคุ้มกันบุคลากรใหม่", tag: <Manual />, target: "= 100", unit: "%", dir: "equal", current: manual("staff_immunity"), hist: [100, 100, 100, 100, 100], kpiKey: "staff_immunity", manualKey: "staff_immunity" },
            { label: "วัคซีนไข้หวัดใหญ่",              tag: <Manual />, target: "≥ 90",  unit: "%", dir: "higher", current: manual("flu_vaccine"),    hist: HIST.flu_vaccine,       kpiKey: "flu_vaccine",    manualKey: "flu_vaccine"    },
          ]}
          viewYear={viewYear}
          nowCE={nowCE}
          isAdmin={isAdmin}
          onSave={setKPIValue}
        />
      </KPISection>

      {/* KPI 12 — Staff outbreak */}
      <KPISection title="12. การเฝ้าระวังการแพร่ระบาดของโรคติดเชื้อในบุคลากร" process="การเฝ้าระวังการแพร่ระบาดของโรคติดเชื้อในบุคลากร">
        <KPITable
          cols={HIST_LABELS}
          rows={[{ label: "การระบาดในบุคลากร", tag: <Manual />, target: "= 0", unit: "ครั้ง", dir: "equal", current: manual("staff_outbreak"), hist: HIST.staff_outbreak, kpiKey: "staff_outbreak", manualKey: "staff_outbreak", targetNum: 0 }]}
          viewYear={viewYear}
          nowCE={nowCE}
          isAdmin={isAdmin}
          onSave={setKPIValue}
        />
      </KPISection>

      {/* KPI 13 — Occupational exposure */}
      <KPISection title="13. การเฝ้าระวังการติดเชื้อจากการปฏิบัติงาน" process="การเฝ้าระวังการติดเชื้อจากการปฏิบัติงาน">
        <KPITable
          cols={HIST_LABELS}
          rows={[{ label: "เฝ้าระวังครบ 100%", tag: <Manual />, target: "= 100", unit: "%", dir: "equal", current: manual("occ_surveillance"), hist: [100, 100, 100, 100, 100], kpiKey: "occ_surveillance", manualKey: "occ_surveillance" }]}
          viewYear={viewYear}
          nowCE={nowCE}
          isAdmin={isAdmin}
          onSave={setKPIValue}
        />
      </KPISection>

      {/* KPI 14 — Water */}
      <KPISection title="14. การเฝ้าระวังการปนเปื้อนของน้ำดื่ม" process="การเฝ้าระวังสิ่งแวดล้อม">
        <KPITable
          cols={HIST_LABELS}
          rows={[{ label: "พบการปนเปื้อน", tag: <Manual />, target: "= 0", unit: "%", dir: "equal", current: manual("water_contam"), hist: HIST.water_contam, kpiKey: "water_contam", manualKey: "water_contam", targetNum: 0 }]}
          viewYear={viewYear}
          nowCE={nowCE}
          isAdmin={isAdmin}
          onSave={setKPIValue}
        />
      </KPISection>
    </div>
  );
}

// ── KPISection wrapper ────────────────────────────────────────────────────────
function KPISection({ title, process, children }: { title: string; process: string; children: React.ReactNode }) {
  return (
    <div className="card-soft p-5">
      <div className="mb-3">
        <div className="font-bold text-primary">{title}</div>
        <div className="text-[11px] text-muted-foreground">{process}</div>
      </div>
      {children}
    </div>
  );
}

// ── KPITable ──────────────────────────────────────────────────────────────────
interface KPIRow {
  label: string;
  tag: React.ReactNode;
  target: string;
  targetNum?: number;
  unit: string;
  dir: Direction;
  current: number | null;
  hist: (number | null)[];
  kpiKey: string;
  manualKey?: string;   // if set → show edit input
}

function KPITable({ cols, rows, viewYear, nowCE, isAdmin, onSave }: {
  cols: string[];
  rows: KPIRow[];
  viewYear: number;
  nowCE: number;
  isAdmin?: boolean;
  onSave?: (key: string, year: number, value: number) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const commit = (key: string) => {
    const n = parseFloat(editVal);
    if (!isNaN(n) && onSave) { onSave(key, viewYear, n); }
    setEditing(null);
  };

  const histIdx = (ce: number) => {
    const map: Record<number, number> = { 2021: 0, 2022: 1, 2023: 2, 2024: 3, 2025: 4 };
    return map[ce] ?? -1;
  };
  const hi = histIdx(viewYear);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[600px]">
        <thead>
          <tr>
            <th className={cn(thCls, "text-left")}>ตัวชี้วัด</th>
            <th className={thCls}>เป้าหมาย</th>
            <th className={cn(thCls, "bg-pink/20 min-w-[80px]")}>ปี {viewYear + 543}</th>
            <th className={thCls}>สถานะ</th>
            {cols.map((c) => <th key={c} className={thCls}>ปี {c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const displayVal = hi >= 0 ? (row.hist[hi] ?? null) : row.current;
            const tNum = row.targetNum ?? parseFloat(row.target.replace(/[^0-9.]/g, ""));
            const status = kpiStatus(displayVal, tNum, row.dir);
            const isEditing = editing === row.manualKey;

            return (
              <tr key={row.kpiKey} className="border-b border-border/40 hover:bg-sky/5">
                <td className={tdLCls}>
                  {row.label}{row.tag}
                  <span className="ml-1 text-muted-foreground">{row.unit}</span>
                </td>
                <td className={cn(tdCls, "font-semibold")}>{row.target}</td>
                <td className={cn(tdCls, "font-bold", STATUS_CLS[status])}>
                  {isEditing ? (
                    <div className="flex items-center gap-1 justify-center">
                      <input
                        autoFocus
                        type="number"
                        step="0.01"
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && commit(row.manualKey!)}
                        className="w-16 px-1 py-0.5 rounded border border-border text-xs text-foreground"
                      />
                      <button onClick={() => commit(row.manualKey!)} className="text-mint-foreground font-bold">✓</button>
                      <button onClick={() => setEditing(null)} className="text-pink-foreground">✕</button>
                    </div>
                  ) : (
                    <span
                      className={cn(row.manualKey && isAdmin && hi < 0 && "cursor-pointer underline-offset-2 hover:underline")}
                      onClick={() => {
                        if (row.manualKey && isAdmin && hi < 0) {
                          setEditing(row.manualKey);
                          setEditVal(row.current !== null ? String(row.current) : "");
                        }
                      }}
                    >
                      {displayVal !== null ? displayVal.toFixed(2) : (row.manualKey && isAdmin && hi < 0 ? "กรอก..." : "—")}
                    </span>
                  )}
                </td>
                <td className={tdCls}>{STATUS_ICON[status]}</td>
                {cols.map((_, i) => (
                  <td key={i} className={cn(tdCls, (() => {
                    const v = row.hist[i];
                    const s = kpiStatus(v ?? null, tNum, row.dir);
                    return s !== "none" ? STATUS_CLS[s] + " opacity-70" : "";
                  })())}>
                    {row.hist[i] !== null && row.hist[i] !== undefined ? row.hist[i]?.toFixed(2) : "—"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
