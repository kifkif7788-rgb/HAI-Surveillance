import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  useWards, useDepartments, addWard, updateWard, deleteWard,
  addDepartment, renameDepartment, deleteDepartment, type Ward, type Department,
  departmentGroups, statWard,
} from "@/lib/ward-store";
import { useMonthlyStats, type MonthlyStat } from "@/lib/monthly-store";
import { supabaseReady } from "@/lib/supabase";
import { useRecords } from "@/lib/hai-store";
import { useORStats, type ORMonthlyStat } from "@/lib/or-store";
import { categorize, categorizeAll, computeMonthlyRates, overallRate, deviceSummary, computeSSIRates, overallSSIRate } from "@/lib/hai-stats";
import { evaluate } from "@/lib/rule-engine";
import { PatientDetailDialog } from "@/components/PatientDetailDialog";
import { formatDateThai } from "@/components/ui/ThaiDatePicker";
import type { PatientRecord } from "@/lib/hai-types";
import { cn } from "@/lib/utils";

const TH_MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function monthLabelShort(ym: string): string {
  const [y, m] = ym.split("-");
  return `${TH_MONTHS_SHORT[Number(m) - 1]} ${Number(y) + 543}`;
}

/** Fixed report categories (ordered as requested). */
const CATEGORIES = [
  { key: "VAP",    label: "VAP",            desc: "ปอดอักเสบจากเครื่องช่วยหายใจ",   icon: "🫁", color: "pink" },
  { key: "HAP",    label: "HAP",            desc: "ปอดอักเสบในโรงพยาบาล",          icon: "🫁", color: "sky" },
  { key: "GI",     label: "GI",             desc: "ติดเชื้อระบบทางเดินอาหาร",       icon: "🍽️", color: "mint" },
  { key: "UTI",    label: "UTI",            desc: "ติดเชื้อทางเดินปัสสาวะ",         icon: "💧", color: "lavender" },
  { key: "CLABSI", label: "CLABSI",         desc: "ติดเชื้อกระแสเลือดจากสายสวน",    icon: "🩸", color: "pink" },
  { key: "BSI",    label: "BSI",            desc: "ติดเชื้อในกระแสเลือด",           icon: "🩸", color: "lemon" },
  { key: "2'BSI",  label: "2'BSI",          desc: "Secondary BSI — เชื้อมาจากแหล่งติดเชื้ออื่น", icon: "🩸", color: "lavender" },
  { key: "CAUTI",  label: "CAUTI",          desc: "ติดเชื้อทางเดินปัสสาวะจากสายสวน", icon: "💧", color: "lavender" },
  { key: "SSI",    label: "SSI",            desc: "ติดเชื้อแผลผ่าตัด",              icon: "🩹", color: "lemon" },
  { key: "CI",     label: "CI",             desc: "ติดเชื้อจากชุมชน",               icon: "🏡", color: "mint" },
  { key: "NONE",   label: "ไม่มีการติดเชื้อ", desc: "ไม่เข้าเกณฑ์การติดเชื้อ",        icon: "✅", color: "sky" },
] as const;

const COLOR: Record<string, string> = {
  pink:     "from-pink/50 to-pink/20 text-pink-foreground",
  sky:      "from-sky/50 to-sky/20 text-sky-foreground",
  mint:     "from-mint/50 to-mint/20 text-mint-foreground",
  lavender: "from-lavender/50 to-lavender/20 text-lavender-foreground",
  lemon:    "from-lemon/55 to-lemon/20 text-lemon-foreground",
};

export function ReportsView() {
  const allRecords = useRecords();
  const allStats   = useMonthlyStats();
  const allOrStats = useORStats();

  const [ward, setWard] = useState("");
  const [year, setYear] = useState("");
  const [mon,  setMon]  = useState("");
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [openRec, setOpenRec] = useState<PatientRecord | null>(null);

  const nowCE = new Date().getFullYear();
  const yearOptions = [...new Set([
    ...Array.from({ length: 7 }, (_, i) => String(nowCE - 4 + i)),
    ...allStats.map((s) => s.month.slice(0, 4)),
    ...allRecords.map((r) => (r.doeDate || r.createdAt || "").slice(0, 4)).filter(Boolean),
  ])].sort((a, b) => b.localeCompare(a));

  const matchPeriod = (ym: string) => {
    if (year && ym.slice(0, 4) !== year) return false;
    if (mon  && ym.slice(5, 7) !== mon)  return false;
    return true;
  };

  // filter ทุกข้อมูลจาก top-level
  // ward filter: ถ้าเลือก ม.6ก ให้รวม records ของ ม.6ก ortho + ม.6ก observe ด้วย
  const records = allRecords.filter((r) => {
    const ym = (r.doeDate || r.createdAt || "").slice(0, 7);
    if (!matchPeriod(ym)) return false;
    if (!ward) return true;
    return (r.ward || "— ไม่ระบุ —") === ward || statWard(r.ward) === ward;
  });
  const stats   = allStats.filter((s) =>
    matchPeriod(s.month) && (!ward || (s.ward || "— ไม่ระบุ —") === ward)
  );
  const orStats = allOrStats.filter((s) => matchPeriod(s.month));

  const wardOptions = [...new Set(allRecords.map((r) => r.ward || "— ไม่ระบุ —"))].sort();

  const counts: Record<string, number> = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0]));
  records.forEach((r) => {
    categorizeAll(r).forEach((cat) => { if (cat in counts) counts[cat] += 1; });
  });

  const total    = records.length;
  const infected = records.filter((r) => categorizeAll(r).some((c) => c !== "NONE")).length;

  const selectCls = "px-3 py-2 rounded-xl border border-border bg-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-5">
      {/* Summary header + filters */}
      <div className="card-soft p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-bold text-primary text-lg">📊 รายงานสรุปผลการประเมิน</div>
          <div className="flex gap-2 text-sm">
            <Stat label="ทั้งหมด" value={total} tone="bg-sky/40 text-sky-foreground" />
            <Stat label="ติดเชื้อ" value={infected} tone="bg-pink/40 text-pink-foreground" />
            <Stat label="ไม่ติดเชื้อ" value={counts.NONE} tone="bg-mint/40 text-mint-foreground" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">📅</span>
          <select value={mon}  onChange={(e) => setMon(e.target.value)}  className={selectCls}>
            <option value="">ทุกเดือน</option>
            {TH_MONTHS_SHORT.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(e.target.value)} className={selectCls}>
            <option value="">ทุกปี</option>
            {yearOptions.map((y) => <option key={y} value={y}>{Number(y) + 543}</option>)}
          </select>
          <span className="text-sm font-semibold text-muted-foreground ml-2">🏥</span>
          <select value={ward} onChange={(e) => setWard(e.target.value)} className={selectCls}>
            <option value="">ทุกหอผู้ป่วย</option>
            {wardOptions.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          {(ward || year || mon) && (
            <button onClick={() => { setWard(""); setYear(""); setMon(""); }}
              className="text-xs text-pink-foreground font-medium px-2.5 py-1 rounded-lg hover:bg-pink/20 transition-colors">
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {/* Category breakdown */}
      <div className="card-soft p-5">
        <div className="font-bold text-primary mb-4">แยกตามประเภทการติดเชื้อ</div>
        {total === 0 ? (
          <div className="text-muted-foreground text-center py-8">ยังไม่มีข้อมูล 🐰</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
            {CATEGORIES.map((c) => {
              const v   = counts[c.key];
              const pct = total ? Math.round((v / total) * 100) : 0;
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={v === 0}
                  onClick={() => setOpenCat(c.key)}
                  className={cn(
                    "text-left rounded-2xl p-4 bg-gradient-to-br border border-white/60 transition-all",
                    COLOR[c.color],
                    v === 0 ? "opacity-50 cursor-default" : "hover:scale-[1.03] hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] cursor-pointer"
                  )}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-2xl">{c.icon}</span>
                    <span className="text-3xl font-extrabold tabular-nums text-foreground">{v}</span>
                  </div>
                  <div className="mt-2 font-bold text-sm text-foreground">{c.label}</div>
                  <div className="text-[11px] text-foreground/60 leading-tight">{c.desc}</div>
                  <div className="text-[10px] font-semibold mt-1.5 opacity-80">{pct}% ของผู้ป่วยทั้งหมด</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <WardInfectionTable records={records} stats={stats} />
      <AntibioticDischargeSection records={records} stats={stats} />
      <NiAmrWorksheetSection records={records} />
      <BsiAmrMortalitySection records={records} stats={stats} />
      <RateSection records={records} stats={stats} ward={ward} />
      <DeviceSummarySection records={records} stats={stats} ward={ward} />
      <SSISection records={records} orStats={orStats} />

      {/* Category → patient list dialog */}
      <CategoryListDialog
        catKey={openCat}
        records={records}
        wardLabel={ward || "ทุกแผนก"}
        onClose={() => setOpenCat(null)}
        onSelect={(r) => { setOpenCat(null); setOpenRec(r); }}
      />

      {/* Individual patient detail */}
      <PatientDetailDialog
        open={openRec !== null}
        onOpenChange={(o) => { if (!o) setOpenRec(null); }}
        record={openRec}
      />
    </div>
  );
}

/** Bar color by antibiotic count: more drugs → warmer tone. */
const ABX_BAR: Record<number, string> = {
  0: "bg-mint-foreground/70",
  1: "bg-sky-foreground/70",
  2: "bg-lavender-foreground/70",
  3: "bg-lemon-foreground/70",
  4: "bg-orange-soft-foreground/70",
};
const abxBar = (n: number) => ABX_BAR[n] ?? "bg-pink-foreground/70";

export function AntibioticSection({ records }: { records: PatientRecord[] }) {
  // distribution: antibioticCount → patient count (+ unspecified bucket)
  const dist = new Map<number, number>();
  let unspecified = 0;
  records.forEach((r) => {
    const a = r.antibioticCount;
    if (a === "" || a == null) unspecified += 1;
    else dist.set(a, (dist.get(a) ?? 0) + 1);
  });

  const total   = records.length;
  const recorded = total - unspecified;
  const maxN    = dist.size ? Math.max(...dist.keys()) : 0;
  const peak    = Math.max(1, ...dist.values());           // for bar scaling
  const rows    = Array.from({ length: maxN + 1 }, (_, n) => ({ n, count: dist.get(n) ?? 0 }));

  // average antibiotics per patient (recorded only)
  const sum = [...dist.entries()].reduce((s, [n, c]) => s + n * c, 0);
  const avg = recorded > 0 ? sum / recorded : 0;

  return (
    <div className="card-soft p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="font-bold text-primary">การได้รับยาฆ่าเชื้อ 💊</div>
        {recorded > 0 && (
          <div className="text-xs text-muted-foreground">
            เฉลี่ย <span className="font-bold text-foreground">{avg.toFixed(1)}</span> ชนิด/ราย ·
            บันทึกแล้ว {recorded.toLocaleString()} ราย{unspecified > 0 && ` · ไม่ได้ระบุ ${unspecified.toLocaleString()} ราย`}
          </div>
        )}
      </div>

      {recorded === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">ยังไม่มีข้อมูลการได้รับยาฆ่าเชื้อ 🐰</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map(({ n, count }) => {
            const pct = total ? Math.round((count / total) * 100) : 0;
            return (
              <div key={n} className="flex items-center gap-3">
                <div className="w-24 shrink-0 text-xs font-semibold text-foreground/70 text-right">
                  {n === 0 ? "ไม่ได้รับยา" : `${n} ชนิด`}
                </div>
                <div className="flex-1 h-6 rounded-lg bg-muted/60 overflow-hidden">
                  <div
                    className={cn("h-full rounded-lg transition-all", abxBar(n))}
                    style={{ width: `${(count / peak) * 100}%` }}
                  />
                </div>
                <div className="w-20 shrink-0 text-xs tabular-nums text-foreground/70">
                  <span className="font-bold text-foreground">{count}</span> ราย ({pct}%)
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MdroSection({ records }: { records: PatientRecord[] }) {
  // นับจำนวนผู้ป่วย (distinct) ที่พบเชื้อดื้อยาแต่ละชนิด
  const counts = new Map<string, number>();
  let patientsWithMdro = 0;
  records.forEach((r) => {
    const set = new Set<string>();
    Object.values(r.mdroBySite ?? {}).forEach((arr) => arr.forEach((o) => { const t = o.trim(); if (t) set.add(t); }));
    if (set.size) patientsWithMdro += 1;
    set.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
  });
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const peak = Math.max(1, ...counts.values());

  return (
    <div className="card-soft p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="font-bold text-primary">เชื้อดื้อยา (MDRO) ⚠️</div>
        {patientsWithMdro > 0 && (
          <div className="text-xs text-muted-foreground">พบในผู้ป่วย {patientsWithMdro.toLocaleString()} ราย</div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">ยังไม่มีข้อมูลเชื้อดื้อยา 🐰</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map(([name, count]) => (
            <div key={name} className="flex items-center gap-3">
              <div className="w-44 shrink-0 text-xs font-semibold text-foreground/70 truncate" title={name}>{name}</div>
              <div className="flex-1 h-6 rounded-lg bg-muted/60 overflow-hidden">
                <div className="h-full rounded-lg bg-pink-foreground/60" style={{ width: `${(count / peak) * 100}%` }} />
              </div>
              <div className="w-16 shrink-0 text-xs tabular-nums text-foreground/70 text-right">
                <span className="font-bold text-foreground">{count}</span> ราย
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ตาราง 4.4.1 HAI AMR Worksheet ─────────────────────────────────────────

// คอลัมน์คงที่ตามประเภทการติดเชื้อ (shared กับ Dashboard)
export const HAI_COLS: { key: string; label: string }[] = [
  { key: "VAP",   label: "VAP"   },
  { key: "HAP",   label: "HAP"   },
  { key: "UTI",   label: "UTI"   },
  { key: "BSI",   label: "BSI"   },
  { key: "2'BSI", label: "2'BSI" },
  { key: "SSI",   label: "SSI"   },
  { key: "GI",    label: "GI"    },
];

// แปลง record + site → HAI type key
export function recordSiteToHaiType(r: PatientRecord, site: string): string {
  if (site === "10.1") return r.result?.includes("VAP") ? "VAP" : "HAP";
  if (site === "10.2") return "UTI";
  if (site === "10.3") return r.result?.includes("2'BSI") ? "2'BSI" : "BSI";
  if (site === "10.4") return "SSI";
  if (site === "10.5") return "GI";
  return site;
}

function NiAmrWorksheetSection({ records }: { records: PatientRecord[] }) {
  // กรองเฉพาะ HAI + มี organism
  const haiWithOrg = records.filter(
    (r) => (r.result ?? "").includes("HAI") && r.organismsBySite && Object.keys(r.organismsBySite).length > 0,
  );

  // สร้าง map: organism → { haiType → { count, mdro[] } }
  type CellData = { count: number; mdro: string[] };
  const orgMap = new Map<string, Map<string, CellData>>();

  haiWithOrg.forEach((r) => {
    const org = r.organismsBySite ?? {};
    const mdro = r.mdroBySite ?? {};
    Object.entries(org).forEach(([site, orgs]) => {
      const haiType = recordSiteToHaiType(r, site);
      orgs.forEach((name) => {
        const n = name.trim(); if (!n) return;
        if (!orgMap.has(n)) orgMap.set(n, new Map());
        const typeMap = orgMap.get(n)!;
        if (!typeMap.has(haiType)) typeMap.set(haiType, { count: 0, mdro: [] });
        const cell = typeMap.get(haiType)!;
        cell.count += 1;
        (mdro[site] ?? []).forEach((m) => { if (m.trim() && !cell.mdro.includes(m.trim())) cell.mdro.push(m.trim()); });
      });
    });
  });

  if (orgMap.size === 0) return null;

  const rows = [...orgMap.entries()].map(([org, typeMap]) => {
    const total = [...typeMap.values()].reduce((s, c) => s + c.count, 0);
    const hasMdro = [...typeMap.values()].some((c) => c.mdro.length > 0);
    return { org, typeMap, total, hasMdro };
  }).sort((a, b) => b.total - a.total);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const mdroTotal  = rows.filter((r) => r.hasMdro).reduce((s, r) => s + r.total, 0);
  let allOrgCount = 0;
  haiWithOrg.forEach((r) => Object.values(r.organismsBySite ?? {}).forEach((arr) => { allOrgCount += arr.filter(Boolean).length; }));

  const thCls = "px-3 py-2 font-semibold text-center border border-border/60 bg-sky/20 text-xs";
  const tdCls = "px-3 py-2 text-center border border-border/40 text-sm";

  return (
    <div className="card-soft p-5">
      <div className="font-bold text-primary mb-3">
        เชื้อจุลชีพที่เป็นสาเหตุ HAI AMR NOSOCOMIAL INFECTIONS WORKSHEET
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className={cn(thCls, "text-left w-52")}>PATHOGENS</th>
              {HAI_COLS.map((c) => (
                <th key={c.key} className={thCls}>{c.label}</th>
              ))}
              <th className={thCls}>Total</th>
              <th className={thCls}>คิดเป็นร้อยละ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ org, typeMap, total }) => (
              <tr key={org} className="hover:bg-sky/5">
                <td className={cn(tdCls, "text-left font-medium")}>{org}</td>
                {HAI_COLS.map((c) => {
                  const cell = typeMap.get(c.key);
                  if (!cell) return <td key={c.key} className={tdCls}>0</td>;
                  return (
                    <td key={c.key} className={tdCls}>
                      {cell.count}
                      {cell.mdro.length > 0 && (
                        <span className="ml-1 text-xs text-pink-foreground font-semibold">
                          ({cell.mdro.join("/")})
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className={cn(tdCls, "font-bold")}>{total}</td>
                <td className={tdCls}>{grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(2) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-sky/10 font-bold">
              <td className={cn(tdCls, "text-left")}>รวม</td>
              {HAI_COLS.map((c) => {
                const sum = rows.reduce((acc, r) => acc + (r.typeMap.get(c.key)?.count ?? 0), 0);
                return <td key={c.key} className={tdCls}>{sum}</td>;
              })}
              <td className={tdCls}>{grandTotal}</td>
              <td className={tdCls}>100.00</td>
            </tr>
            <tr className="text-xs text-muted-foreground">
              <td colSpan={HAI_COLS.length + 3} className="px-3 py-2 border border-border/40">
                สัดส่วนเชื้อดื้อยา/เชื้อที่พบทั้งหมด —
                เชื้อที่พบทั้งหมด = {allOrgCount} &nbsp;|&nbsp;
                เชื้อดื้อยา = {mdroTotal} &nbsp;|&nbsp;
                คิดเป็น {allOrgCount > 0 ? ((mdroTotal / allOrgCount) * 100).toFixed(2) : "0.00"}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── ตาราง 4.5 BSI AMR Mortality Rate ───────────────────────────────────────

function BsiAmrMortalitySection({ records, stats }: { records: PatientRecord[]; stats: MonthlyStat[] }) {
  const allStats = stats;
  const depts = departmentGroups();

  // กรองเฉพาะ BSI HAI + มี MDRO ที่ site 10.3
  const bsiAmrRecords = records.filter(
    (r) =>
      (r.result ?? "").includes("HAI") &&
      r.sites?.includes("10.3") &&
      (r.mdroBySite?.["10.3"]?.filter(Boolean).length ?? 0) > 0,
  );

  const rows = depts.map((d) => {
    const wardSet = new Set(d.wards);
    const deptStats = allStats.filter((s) => wardSet.has(s.ward));
    const discharged  = deptStats.reduce((s, x) => s + (x.discharged ?? 0), 0);
    const patientDays = deptStats.reduce((s, x) => s + (x.patientDays ?? 0), 0);
    const bsiAmr  = bsiAmrRecords.filter((r) => wardSet.has(r.ward));
    const bsiCnt  = bsiAmr.length;
    const deadCnt = bsiAmr.filter((r) => r.outcome === "deceased").length;
    const rate    = patientDays > 0 ? ((bsiCnt / patientDays) * 1000) : 0;
    const deathRate = discharged > 0 ? ((deadCnt / discharged) * 100) : 0;
    return { dept: d.name, discharged, patientDays, bsiCnt, deadCnt, rate, deathRate };
  });

  const tot = {
    discharged:  rows.reduce((s, r) => s + r.discharged, 0),
    patientDays: rows.reduce((s, r) => s + r.patientDays, 0),
    bsiCnt:      rows.reduce((s, r) => s + r.bsiCnt, 0),
    deadCnt:     rows.reduce((s, r) => s + r.deadCnt, 0),
  };
  const totRate     = tot.patientDays > 0 ? ((tot.bsiCnt / tot.patientDays) * 1000) : 0;
  const totDeathRate = tot.discharged > 0 ? ((tot.deadCnt / tot.discharged) * 100) : 0;

  const thCls = "px-3 py-2 font-semibold text-center border border-border/60 bg-lemon/30 text-xs leading-snug";
  const tdCls = "px-3 py-2 text-center border border-border/40 text-sm";
  const fmt2 = (n: number) => n.toFixed(2);

  return (
    <div className="card-soft p-5">
      <div className="font-bold text-primary mb-3">
        Blood Stream Infection Mortality Rate by AMR
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className={cn(thCls, "text-left w-40")} rowSpan={2}>DEPARTMENT</th>
              <th className={thCls}>จำนวน<br/>จำหน่าย</th>
              <th className={thCls}>จำนวน<br/>วันนอน</th>
              <th className={thCls}>จำนวน BSI<br/>จากเชื้อดื้อยา</th>
              <th className={thCls}>จำนวนการตาย<br/>จากเชื้อดื้อยา</th>
              <th className={thCls}>อัตราติดเชื้อ<br/>/1,000 วันนอน</th>
              <th className={thCls}>อัตราตายจาก BSI<br/>ติดเชื้อดื้อยา (%)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dept} className="hover:bg-lemon/5">
                <td className={cn(tdCls, "text-left font-medium")}>{r.dept}</td>
                <td className={tdCls}>{r.discharged.toLocaleString()}</td>
                <td className={tdCls}>{r.patientDays.toLocaleString()}</td>
                <td className={tdCls}>{r.bsiCnt}</td>
                <td className={tdCls}>{r.deadCnt}</td>
                <td className={tdCls}>{fmt2(r.rate)}</td>
                <td className={tdCls}>{fmt2(r.deathRate)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-lemon/20 font-bold">
              <td className={cn(tdCls, "text-left")}>รวม</td>
              <td className={tdCls}>{tot.discharged.toLocaleString()}</td>
              <td className={tdCls}>{tot.patientDays.toLocaleString()}</td>
              <td className={tdCls}>{tot.bsiCnt}</td>
              <td className={tdCls}>{tot.deadCnt}</td>
              <td className={tdCls}>{fmt2(totRate)}</td>
              <td className={tdCls}>{fmt2(totDeathRate)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        หมายเหตุ: อัตราตาย คิดเป็นร้อยละต่อผู้ป่วยจำหน่าย
      </p>
    </div>
  );
}

function AntibioticDischargeSection({ records, stats }: { records: PatientRecord[]; stats: MonthlyStat[] }) {
  const discharged = stats.reduce((a, s) => a + s.discharged, 0);

  // จำนวนผู้ป่วยที่ได้รับยา จำแนกตามจำนวนชนิด (≥9 รวมเป็นกลุ่มเดียว)
  const byN = new Map<number, number>(); // n (1..8) → count
  let ge9 = 0;
  records.forEach((r) => {
    const a = r.antibioticCount;
    if (a === "" || a == null || a < 1) return;
    if (a >= 9) ge9 += 1; else byN.set(a, (byN.get(a) ?? 0) + 1);
  });
  const n = (k: number) => byN.get(k) ?? 0;
  const receivedTotal = ge9 + [1, 2, 3, 4, 5, 6, 7, 8].reduce((a, k) => a + n(k), 0);
  const total = Math.max(discharged, receivedTotal);          // ผู้ป่วยจำหน่ายทั้งหมด
  const notReceived = total - receivedTotal;                  // ไม่ได้รับยา = จำหน่าย − ได้รับยา

  // เรียงจากมากไปน้อย: ≥9, 8, …, 1, ไม่ได้รับยา + คำนวณความถี่สะสม
  const ordered = [
    { label: "≥ 9 ชนิด", count: ge9 },
    ...[8, 7, 6, 5, 4, 3, 2, 1].map((k) => ({ label: `${k} ชนิด`, count: n(k) })),
    { label: "ไม่ได้รับยา", count: notReceived },
  ];
  let cum = 0;
  const rows = ordered.map((r) => { cum += r.count; return { ...r, cum, pct: total > 0 ? (r.count / total) * 100 : 0, cumPct: total > 0 ? (cum / total) * 100 : 0 }; });

  return (
    <div className="card-soft p-5">
      <div className="font-bold text-primary mb-1">จำนวนและร้อยละของผู้ป่วยจำหน่ายที่เคยได้รับยาปฏิชีวนะ 💊</div>
      <div className="text-[11px] text-muted-foreground mb-3">จำแนกตามชนิดของยาปฏิชีวนะที่ได้รับ</div>

      {total === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">
          ยังไม่มีข้อมูล — เพิ่มจำนวนผู้ป่วยจำหน่ายได้ที่เมนู "ข้อมูลรายเดือน" 🐰
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="text-muted-foreground bg-lemon/30">
                <th rowSpan={2} className="p-2.5 text-left rounded-tl-xl align-bottom">จำนวนชนิดที่ได้รับ</th>
                <th colSpan={2} className="p-2 text-center border-b border-white/60">ความถี่ (Frequency)</th>
                <th colSpan={2} className="p-2 text-center rounded-tr-xl">ความถี่สะสม (Cumulative)</th>
              </tr>
              <tr className="text-muted-foreground bg-lemon/20 text-xs">
                <th className="p-2 text-right">จำนวน (ราย)</th>
                <th className="p-2 text-right">ร้อยละ</th>
                <th className="p-2 text-right">จำนวนรวม</th>
                <th className="p-2 text-right">ร้อยละ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-border/40 hover:bg-lemon/10">
                  <td className="p-2.5 font-medium text-foreground whitespace-nowrap">{r.label}</td>
                  <td className="p-2.5 text-right tabular-nums">{r.count.toLocaleString()}</td>
                  <td className="p-2.5 text-right tabular-nums">{r.pct.toFixed(2)}</td>
                  <td className="p-2.5 text-right tabular-nums text-foreground/70">{r.cum.toLocaleString()}</td>
                  <td className="p-2.5 text-right tabular-nums text-foreground/70">{r.cumPct.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-primary/10 font-bold border-t-2 border-primary/30">
                <td className="p-2.5 rounded-bl-xl text-primary">รวม</td>
                <td className="p-2.5 text-right tabular-nums">{total.toLocaleString()}</td>
                <td className="p-2.5 text-right tabular-nums text-primary">100.00</td>
                <td className="p-2.5 text-right tabular-nums" />
                <td className="p-2.5 rounded-br-xl" />
              </tr>
            </tfoot>
          </table>
          <div className="text-[11px] text-muted-foreground mt-2">
            ฐาน = ผู้ป่วยจำหน่ายทั้งหมด {total.toLocaleString()} ราย · ไม่ได้รับยา = จำหน่าย − ผู้ที่ได้รับยา ({receivedTotal.toLocaleString()})
          </div>
        </div>
      )}
    </div>
  );
}

function WardInfectionTable({ records, stats }: { records: PatientRecord[]; stats: MonthlyStat[] }) {
  const recs  = records;
  const mstat = stats;

  type Row = { ward: string; patients: number; infections: number; patientDays: number; totalPatients: number };
  const map = new Map<string, Row>();
  const get = (ward: string) => {
    const key = ward || "— ไม่ระบุ —";
    let row = map.get(key);
    if (!row) { row = { ward: key, patients: 0, infections: 0, patientDays: 0, totalPatients: 0 }; map.set(key, row); }
    return row;
  };
  mstat.forEach((s) => { const row = get(s.ward); row.patientDays += s.patientDays; row.totalPatients += s.totalPatients; });
  recs.forEach((r) => {
    const haiCount = evaluate(r).filter((x) => x.category === "HAI").length;
    if (haiCount === 0) return;
    // ใช้ alias ward เพื่อ lookup patientDays (เช่น ม.6ก ortho → ม.6ก)
    const row = get(statWard(r.ward));
    row.patients += 1;
    row.infections += haiCount;
  });

  const rows = [...map.values()]
    .map((r) => ({
      ...r,
      rate: r.totalPatients > 0 ? (r.infections / r.totalPatients) * 100 : null,
      per1000: r.patientDays > 0 ? (r.infections / r.patientDays) * 1000 : null,
    }))
    .filter((r) => r.infections > 0 || r.totalPatients > 0)
    .sort((a, b) => b.infections - a.infections || a.ward.localeCompare(b.ward));

  const t = rows.reduce((a, r) => ({
    patients: a.patients + r.patients, infections: a.infections + r.infections,
    patientDays: a.patientDays + r.patientDays, totalPatients: a.totalPatients + r.totalPatients,
  }), { patients: 0, infections: 0, patientDays: 0, totalPatients: 0 });
  const totals = {
    ...t,
    rate: t.totalPatients > 0 ? (t.infections / t.totalPatients) * 100 : null,
    per1000: t.patientDays > 0 ? (t.infections / t.patientDays) * 1000 : null,
  };

  return (
    <div className="card-soft p-5">
      <div className="font-bold text-primary mb-4">ข้อมูลการติดเชื้อรายหอผู้ป่วย 🛏️</div>

      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          ยังไม่มีข้อมูล — เพิ่มข้อมูลวันนอน/ผู้ป่วยได้ที่เมนู "ข้อมูลรายเดือน" 🐰
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground bg-sky/30">
                <th className="p-3 rounded-l-xl whitespace-nowrap">หอผู้ป่วย</th>
                <th className="p-3 text-right whitespace-nowrap">จำนวนผู้ป่วยติดเชื้อ</th>
                <th className="p-3 text-right whitespace-nowrap">จำนวนครั้งติดเชื้อ</th>
                <th className="p-3 text-right whitespace-nowrap">อัตราการติดเชื้อ (%)</th>
                <th className="p-3 text-right whitespace-nowrap rounded-r-xl">การติดเชื้อ/1,000 วันนอน</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ward} className="border-b border-border/40 hover:bg-sky/10">
                  <td className="p-3 font-medium text-foreground whitespace-nowrap">{r.ward}</td>
                  <td className="p-3 text-right tabular-nums">{r.patients.toLocaleString()}</td>
                  <td className="p-3 text-right tabular-nums">{r.infections.toLocaleString()}</td>
                  <td className="p-3 text-right tabular-nums font-semibold text-primary">{r.rate !== null ? r.rate.toFixed(2) : "—"}</td>
                  <td className="p-3 text-right tabular-nums font-semibold text-primary">{r.per1000 !== null ? r.per1000.toFixed(2) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-primary/10 font-bold border-t-2 border-primary/30">
                <td className="p-3 rounded-l-xl text-primary">รวม</td>
                <td className="p-3 text-right tabular-nums">{totals.patients.toLocaleString()}</td>
                <td className="p-3 text-right tabular-nums">{totals.infections.toLocaleString()}</td>
                <td className="p-3 text-right tabular-nums text-primary">{totals.rate !== null ? totals.rate.toFixed(2) : "—"}</td>
                <td className="p-3 text-right tabular-nums text-primary rounded-r-xl">{totals.per1000 !== null ? totals.per1000.toFixed(2) : "—"}</td>
              </tr>
            </tfoot>
          </table>
          <div className="text-[11px] text-muted-foreground mt-2">
            อัตราการติดเชื้อ = ครั้งติดเชื้อ ÷ ผู้ป่วยทั้งหมด × 100 · การติดเชื้อ/1,000 วันนอน = ครั้งติดเชื้อ ÷ วันนอน × 1,000 (อ้างอิงข้อมูลรายเดือน)
          </div>
        </div>
      )}
    </div>
  );
}

function SSISection({ records, orStats }: { records: PatientRecord[]; orStats: ORMonthlyStat[] }) {
  const rows    = computeSSIRates(records, orStats);
  const overall = overallSSIRate(rows);

  return (
    <div className="card-soft p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="font-bold text-primary">อัตราการติดเชื้อแผลผ่าตัด (SSI) 🩹</div>
        <div className="text-[11px] text-muted-foreground">รวมทั้งโรงพยาบาล · แผลผ่าตัด = CW+CCW+CoW+DW (ไม่รวม NW)</div>
      </div>

      {orStats.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          ยังไม่มีข้อมูลจำนวนแผลผ่าตัด — เพิ่มได้ที่เมนู "ข้อมูลรายเดือน → ห้องผ่าตัด (OR)" 🐰
        </div>
      ) : (
        <>
          <div className="rounded-2xl p-4 bg-gradient-to-br from-lemon/50 to-pink/20 border border-white/60 flex flex-wrap items-end gap-x-6 gap-y-1 mb-4">
            <div>
              <div className="text-4xl font-extrabold tabular-nums text-lemon-foreground">{overall.ratePct.toFixed(2)}<span className="text-xl">%</span></div>
              <div className="text-xs text-foreground/60">อัตรา SSI (รวม)</div>
            </div>
            <div className="text-sm text-foreground/70">
              SSI <span className="font-bold">{overall.ssi.toLocaleString()}</span> ราย /
              แผลผ่าตัด <span className="font-bold">{overall.wounds.toLocaleString()}</span> แผล
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground bg-lemon/30">
                  <th className="p-2.5 rounded-l-xl">เดือน</th>
                  <th className="p-2.5 text-right">SSI</th>
                  <th className="p-2.5 text-right">แผลผ่าตัด</th>
                  <th className="p-2.5 text-right rounded-r-xl">อัตรา SSI (%)</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.month} className="border-b border-border/40 hover:bg-lemon/10">
                    <td className="p-2.5 font-medium text-foreground">{monthLabelShort(r.month)}</td>
                    <td className="p-2.5 text-right tabular-nums">{r.ssi.toLocaleString()}</td>
                    <td className="p-2.5 text-right tabular-nums">{r.wounds.toLocaleString()}</td>
                    <td className="p-2.5 text-right tabular-nums font-bold text-primary">{r.ratePct.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function DeviceSummarySection({ records, stats, ward }: { records: PatientRecord[]; stats: MonthlyStat[]; ward: string }) {
  const rates = computeMonthlyRates(records, stats);
  const { patientDays, devices } = deviceSummary(rates);

  return (
    <div className="card-soft p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="font-bold text-primary">อัตราการติดเชื้อจากอุปกรณ์ & อัตราการใช้อุปกรณ์ 🩺</div>
        <div className="text-[11px] text-muted-foreground">{ward || "ทุกแผนก"} · Device-associated infection rates & DUR</div>
      </div>

      {stats.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          ยังไม่มีข้อมูล device-days — เพิ่มได้ที่เมนู "ข้อมูลรายเดือน" 🐰
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground bg-sky/30">
                <th className="p-2.5 rounded-l-xl whitespace-nowrap">อุปกรณ์</th>
                <th className="p-2.5 text-right whitespace-nowrap">การติดเชื้อ (ครั้ง)</th>
                <th className="p-2.5 text-right whitespace-nowrap">Device-days</th>
                <th className="p-2.5 text-right whitespace-nowrap">อัตราติดเชื้อ /1,000 device-days</th>
                <th className="p-2.5 text-right whitespace-nowrap rounded-r-xl">DUR (อัตราการใช้อุปกรณ์)</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.infection} className="border-b border-border/40 hover:bg-sky/10">
                  <td className="p-2.5 font-medium text-foreground whitespace-nowrap">{d.label}</td>
                  <td className="p-2.5 text-right tabular-nums">
                    {d.infections.toLocaleString()} <span className="text-[10px] text-muted-foreground">{d.infection}</span>
                  </td>
                  <td className="p-2.5 text-right tabular-nums">{d.deviceDays.toLocaleString()}</td>
                  <td className="p-2.5 text-right tabular-nums font-semibold text-primary">{d.ratePer1000.toFixed(2)}</td>
                  <td className="p-2.5 text-right tabular-nums font-semibold text-primary">{d.dur.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[11px] text-muted-foreground mt-2">
            วันนอนรวม {patientDays.toLocaleString()} วัน · อัตราติดเชื้อ = ครั้งติดเชื้อ ÷ device-days × 1,000 · DUR = device-days ÷ วันนอน
          </div>
        </div>
      )}
    </div>
  );
}

function RateSection({ records, stats, ward }: { records: PatientRecord[]; stats: MonthlyStat[]; ward: string }) {
  const rates   = computeMonthlyRates(records, stats);   // ascending
  const overall = overallRate(rates);

  // ── อัตราการติดเชื้อดื้อยา (AMR) ต่อ 1,000 วันนอน ──
  // นับ HAI record ที่มี MDRO อย่างน้อย 1 site
  const hasMdro = (r: PatientRecord) =>
    Object.values(r.mdroBySite ?? {}).some((arr) => arr.some(Boolean)) &&
    evaluate(r).some((x) => x.category === "HAI");

  // สร้าง map เดือน → { amrCount, patientDays } จาก stats + records
  const amrByMonth = new Map<string, { amr: number; pd: number }>();
  stats.forEach((s) => {
    const e = amrByMonth.get(s.month) ?? { amr: 0, pd: 0 };
    e.pd += s.patientDays;
    amrByMonth.set(s.month, e);
  });
  records.forEach((r) => {
    if (!hasMdro(r)) return;
    const ym = (r.doeDate || r.createdAt || "").slice(0, 7);
    if (!ym) return;
    const e = amrByMonth.get(ym) ?? { amr: 0, pd: 0 };
    e.amr += 1;
    amrByMonth.set(ym, e);
  });
  const totalAmr = records.filter(hasMdro).length;
  const totalPd  = stats.reduce((s, x) => s + x.patientDays, 0);
  const overallAmrRate = totalPd > 0 ? (totalAmr / totalPd) * 1000 : 0;

  return (
    <div className="card-soft p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="font-bold text-primary">อัตราการติดเชื้อ HAI ต่อ 1,000 วันนอน</div>
        <div className="text-[11px] text-muted-foreground">{ward || "ทุกแผนก"} · อ้างอิงข้อมูลวันนอนรายเดือน</div>
      </div>

      {stats.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          {ward
            ? `ยังไม่มีข้อมูลวันนอนรายเดือนของ ${ward} 🐰`
            : "ยังไม่มีข้อมูลวันนอนรายเดือน — เพิ่มได้ที่เมนู ข้อมูลรายเดือน 🐰"}
        </div>
      ) : (
        <>
          {/* Overall — HAI + AMR side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="rounded-2xl p-4 bg-gradient-to-br from-pink/40 to-lavender/30 border border-white/60">
              <div className="text-3xl font-extrabold tabular-nums text-pink-foreground">{overall.ratePer1000.toFixed(2)}</div>
              <div className="text-xs text-foreground/60 mt-0.5">HAI / 1,000 วันนอน</div>
              <div className="text-xs text-foreground/50 mt-1">
                ติดเชื้อ {overall.infections.toLocaleString()} ราย · วันนอน {overall.patientDays.toLocaleString()} วัน
              </div>
            </div>
            <div className="rounded-2xl p-4 bg-gradient-to-br from-lemon/50 to-lemon/20 border border-white/60">
              <div className="text-3xl font-extrabold tabular-nums text-lemon-foreground">{overallAmrRate.toFixed(2)}</div>
              <div className="text-xs text-foreground/60 mt-0.5">AMR (เชื้อดื้อยา) / 1,000 วันนอน</div>
              <div className="text-xs text-foreground/50 mt-1">
                ติดเชื้อดื้อยา {totalAmr.toLocaleString()} ราย · วันนอน {totalPd.toLocaleString()} วัน
              </div>
            </div>
          </div>

          {/* Per-month table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground bg-sky/30">
                  <th className="p-2.5 rounded-l-xl">เดือน</th>
                  <th className="p-2.5 text-right">ติดเชื้อ HAI</th>
                  <th className="p-2.5 text-right">ติดเชื้อดื้อยา (AMR)</th>
                  <th className="p-2.5 text-right">วันนอน</th>
                  <th className="p-2.5 text-right">HAI/1,000 วันนอน</th>
                  <th className="p-2.5 text-right rounded-r-xl">AMR/1,000 วันนอน</th>
                </tr>
              </thead>
              <tbody>
                {[...rates].reverse().map((r) => {
                  const amrEntry = amrByMonth.get(r.month) ?? { amr: 0, pd: r.patientDays };
                  const amrRate  = amrEntry.pd > 0 ? (amrEntry.amr / amrEntry.pd) * 1000 : 0;
                  return (
                    <tr key={r.month} className="border-b border-border/40 hover:bg-sky/10">
                      <td className="p-2.5 font-medium text-foreground">{monthLabelShort(r.month)}</td>
                      <td className="p-2.5 text-right tabular-nums">{r.infections.toLocaleString()}</td>
                      <td className="p-2.5 text-right tabular-nums text-lemon-foreground font-semibold">{amrEntry.amr}</td>
                      <td className="p-2.5 text-right tabular-nums">{r.patientDays.toLocaleString()}</td>
                      <td className="p-2.5 text-right tabular-nums font-bold text-primary">{r.ratePer1000.toFixed(2)}</td>
                      <td className="p-2.5 text-right tabular-nums font-bold text-lemon-foreground">{amrRate.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-sky/10 font-bold border-t-2 border-border/60">
                  <td className="p-2.5">รวม</td>
                  <td className="p-2.5 text-right tabular-nums">{overall.infections.toLocaleString()}</td>
                  <td className="p-2.5 text-right tabular-nums text-lemon-foreground">{totalAmr}</td>
                  <td className="p-2.5 text-right tabular-nums">{totalPd.toLocaleString()}</td>
                  <td className="p-2.5 text-right tabular-nums text-primary">{overall.ratePer1000.toFixed(2)}</td>
                  <td className="p-2.5 text-right tabular-nums text-lemon-foreground">{overallAmrRate.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="text-[11px] text-muted-foreground mt-2">
            AMR = HAI ที่พบเชื้อดื้อยา (MDRO) อย่างน้อย 1 ชนิด · อัตรา = จำนวน ÷ วันนอน × 1,000
          </div>
        </>
      )}
    </div>
  );
}

function CategoryListDialog({
  catKey, records, wardLabel, onClose, onSelect,
}: {
  catKey: string | null;
  records: PatientRecord[];
  wardLabel: string;
  onClose: () => void;
  onSelect: (r: PatientRecord) => void;
}) {
  const cat  = CATEGORIES.find((c) => c.key === catKey);
  const list = catKey ? records.filter((r) => categorizeAll(r).includes(catKey)) : [];

  return (
    <Dialog open={catKey !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <div className="mx-auto text-4xl mb-1">{cat?.icon}</div>
          <DialogTitle className="text-center text-xl font-bold text-primary">{cat?.label}</DialogTitle>
          <DialogDescription className="text-center text-xs">
            {cat?.desc} · {wardLabel} · {list.length} ราย
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {list.length === 0 ? (
            <div className="text-center text-muted-foreground py-6">ไม่มีผู้ป่วยในหมวดนี้ 🐰</div>
          ) : list.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              className="w-full text-left rounded-2xl border border-border/60 bg-white p-3 flex items-center gap-3 hover:bg-sky/10 hover:border-sky-foreground/30 transition-all">
              <div className="w-10 h-10 rounded-xl bg-sky/20 grid place-items-center text-lg shrink-0">
                {r.sex === "male" ? "👦" : r.sex === "female" ? "👧" : "🧸"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground truncate">
                  HN {r.hn || "—"} · AN {r.an || "—"}
                </div>
                <div className="text-xs text-foreground/60 truncate">
                  {r.ward || "—"} · {r.age === "" ? "—" : `${r.age} ปี`} · DOE {formatDateThai(r.doeDate, true)}
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold px-2 py-1 rounded-full bg-mint/50 text-mint-foreground">
                {r.result ?? "—"}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={cn("rounded-xl px-3 py-1.5 font-semibold flex items-center gap-1.5", tone)}>
      <span className="text-xs opacity-80">{label}</span>
      <span className="text-lg font-extrabold tabular-nums">{value}</span>
    </div>
  );
}

const settingsInput =
  "px-3 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function SettingsView({ isAdmin = false }: { isAdmin?: boolean }) {
  return (
    <div className="space-y-5">
      {/* สถานะการเชื่อมต่อ Supabase */}
      <div className="card-soft p-5">
        <div className="font-bold text-primary mb-2">☁️ การเชื่อมต่อฐานข้อมูล</div>
        <div className="flex items-center gap-2 text-sm">
          <span className={cn("inline-block w-2.5 h-2.5 rounded-full", supabaseReady ? "bg-mint-foreground" : "bg-muted-foreground/40")} />
          {supabaseReady
            ? <span className="text-foreground">เชื่อมต่อ Supabase แล้ว — ข้อมูลถูก sync อัตโนมัติ</span>
            : <span className="text-muted-foreground">ยังไม่ได้ตั้งค่า Supabase — ใช้งานแบบ local เท่านั้น</span>}
        </div>
      </div>

      <DepartmentManager isAdmin={isAdmin} />
      <WardManager isAdmin={isAdmin} />
    </div>
  );
}

function DepartmentManager({ isAdmin }: { isAdmin: boolean }) {
  const departments = useDepartments();
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [toDelete, setToDelete] = useState<Department | null>(null);

  const add = () => {
    const res = addDepartment(newName);
    if (!res.ok) return toast.error(res.error);
    toast.success(`เพิ่มแผนก "${newName.trim()}" แล้ว`);
    setNewName("");
  };
  const saveEdit = (d: Department) => {
    const res = renameDepartment(d.id, editName);
    if (!res.ok) return toast.error(res.error);
    toast.success("แก้ไขชื่อแผนกแล้ว");
    setEditId(null);
  };
  const confirmDelete = () => {
    if (!toDelete) return;
    deleteDepartment(toDelete.id);
    toast.success(`ลบแผนก "${toDelete.name}" แล้ว`);
    setToDelete(null);
  };

  return (
    <div className="card-soft p-5">
      <div className="font-bold text-primary mb-3">🏷️ แผนก ({departments.length})</div>

      <div className="flex flex-wrap gap-2">
        {departments.map((d) => (
          <div key={d.id} className="flex items-center gap-1.5 rounded-full bg-lavender/40 pl-3 pr-1.5 py-1 text-sm">
            {editId === d.id ? (
              <>
                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit(d)}
                  className="bg-white rounded-lg border border-border px-2 py-0.5 text-sm w-32" />
                <button onClick={() => saveEdit(d)} className="px-1.5 hover:scale-110 transition" title="บันทึก">✅</button>
                <button onClick={() => setEditId(null)} className="px-1.5 hover:scale-110 transition" title="ยกเลิก">✖️</button>
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">{d.name}</span>
                {isAdmin && (
                  <>
                    <button onClick={() => { setEditId(d.id); setEditName(d.name); }} className="px-1 hover:scale-110 transition" title="แก้ไข">✏️</button>
                    <button onClick={() => setToDelete(d)} className="px-1 hover:scale-110 transition" title="ลบ">🗑️</button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
        {departments.length === 0 && <span className="text-sm text-muted-foreground">ยังไม่มีแผนก</span>}
      </div>

      {isAdmin && (
        <div className="flex gap-2 mt-4">
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="ชื่อแผนกใหม่" className={cn(settingsInput, "flex-1 max-w-xs")} />
          <button onClick={add} className="btn-soft bg-mint text-mint-foreground px-4 text-sm">➕ เพิ่มแผนก</button>
        </div>
      )}

      <ConfirmDeleteDialog
        open={toDelete !== null}
        title="ลบแผนก"
        description={`ลบแผนก "${toDelete?.name}" ใช่หรือไม่? หอผู้ป่วยที่อยู่ในแผนกนี้จะไม่ถูกลบ แต่จะไม่มีแผนกที่สังกัด`}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function WardManager({ isAdmin }: { isAdmin: boolean }) {
  const wards = useWards();
  const departments = useDepartments();
  const [newName, setNewName] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newIcu, setNewIcu] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [toDelete, setToDelete] = useState<Ward | null>(null);

  const deptName = (id: string) => departments.find((d) => d.id === id)?.name ?? "—";

  const add = () => {
    const res = addWard({ name: newName, departmentId: newDept, isICU: newIcu });
    if (!res.ok) return toast.error(res.error);
    toast.success(`เพิ่มหอผู้ป่วย "${newName.trim()}" แล้ว`);
    setNewName(""); setNewDept(""); setNewIcu(false);
  };
  const saveName = (w: Ward) => {
    const res = updateWard(w.id, { name: editName });
    if (!res.ok) return toast.error(res.error);
    toast.success("แก้ไขชื่อหอผู้ป่วยแล้ว");
    setEditId(null);
  };
  const confirmDelete = () => {
    if (!toDelete) return;
    deleteWard(toDelete.id);
    toast.success(`ลบหอผู้ป่วย "${toDelete.name}" แล้ว`);
    setToDelete(null);
  };

  return (
    <div className="card-soft p-5">
      <div className="font-bold text-primary mb-3">🛏️ หอผู้ป่วย ({wards.length})</div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="p-2 font-medium">ชื่อหอผู้ป่วย</th>
              <th className="p-2 font-medium">แผนก</th>
              <th className="p-2 font-medium text-center">ICU</th>
              {isAdmin && <th className="p-2 font-medium text-right">จัดการ</th>}
            </tr>
          </thead>
          <tbody>
            {wards.map((w) => (
              <tr key={w.id} className="border-b border-border/40 hover:bg-sky/10">
                <td className="p-2 font-medium text-foreground">
                  {editId === w.id ? (
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveName(w)}
                      className="bg-white rounded-lg border border-border px-2 py-1 text-sm w-36" />
                  ) : w.name}
                </td>
                <td className="p-2">
                  {isAdmin ? (
                    <select value={w.departmentId}
                      onChange={(e) => updateWard(w.id, { departmentId: e.target.value })}
                      className={cn(settingsInput, "py-1 cursor-pointer")}>
                      <option value="">— ไม่ระบุ —</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  ) : (
                    <span className="text-muted-foreground">{w.departmentId ? deptName(w.departmentId) : "—"}</span>
                  )}
                </td>
                <td className="p-2 text-center">
                  <input type="checkbox" checked={w.isICU} disabled={!isAdmin}
                    onChange={(e) => updateWard(w.id, { isICU: e.target.checked })}
                    className="w-4 h-4 accent-pink cursor-pointer disabled:cursor-default" />
                </td>
                {isAdmin && (
                  <td className="p-2 text-right whitespace-nowrap">
                    {editId === w.id ? (
                      <>
                        <button onClick={() => saveName(w)} className="px-1.5 hover:scale-110 transition" title="บันทึก">✅</button>
                        <button onClick={() => setEditId(null)} className="px-1.5 hover:scale-110 transition" title="ยกเลิก">✖️</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditId(w.id); setEditName(w.name); }} className="px-1.5 hover:scale-110 transition" title="แก้ไขชื่อ">✏️</button>
                        <button onClick={() => setToDelete(w)} className="px-1.5 hover:scale-110 transition" title="ลบ">🗑️</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {wards.length === 0 && (
              <tr><td colSpan={isAdmin ? 4 : 3} className="p-3 text-center text-muted-foreground">ยังไม่มีหอผู้ป่วย</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="ชื่อหอผู้ป่วยใหม่" className={cn(settingsInput, "w-44")} />
          <select value={newDept} onChange={(e) => setNewDept(e.target.value)}
            className={cn(settingsInput, "cursor-pointer")}>
            <option value="">— เลือกแผนก —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
            <input type="checkbox" checked={newIcu} onChange={(e) => setNewIcu(e.target.checked)}
              className="w-4 h-4 accent-pink cursor-pointer" />
            ICU
          </label>
          <button onClick={add} className="btn-soft bg-mint text-mint-foreground px-4 text-sm">➕ เพิ่มหอผู้ป่วย</button>
        </div>
      )}

      <ConfirmDeleteDialog
        open={toDelete !== null}
        title="ลบหอผู้ป่วย"
        description={`ลบหอผู้ป่วย "${toDelete?.name}" ใช่หรือไม่? ข้อมูลผู้ป่วยและข้อมูลรายเดือนที่บันทึกไว้จะไม่ถูกลบ`}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function ConfirmDeleteDialog({
  open, title, description, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-sm rounded-3xl">
        <DialogHeader>
          <div className="text-center text-3xl mb-1">🗑️</div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center text-sm">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2 mt-2">
          <button onClick={onCancel}
            className="btn-soft flex-1 justify-center">
            ยกเลิก
          </button>
          <button onClick={onConfirm}
            className="btn-soft bg-pink text-pink-foreground flex-1 justify-center">
            ลบ
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

