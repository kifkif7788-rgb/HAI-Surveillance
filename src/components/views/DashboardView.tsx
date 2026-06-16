import { useMemo, useState } from "react";
import { useRecords } from "@/lib/hai-store";
import { useMonthlyStats } from "@/lib/monthly-store";
import { computeMonthlyRates, overallRate, categorize, isHAI } from "@/lib/hai-stats";
import { evaluate } from "@/lib/rule-engine";
import { PatientListDialog } from "@/components/PatientListDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AntibioticSection, MdroSection, HAI_COLS, recordSiteToHaiType } from "./SimpleViews";
import { statWard } from "@/lib/ward-store";
import { type PatientRecord } from "@/lib/hai-types";
import { useWards, departmentOf, departmentGroups, icuWardNames } from "@/lib/ward-store";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, ComposedChart } from "recharts";
import { cn } from "@/lib/utils";

const SITE_LABELS: Record<string, string> = { "10.1": "ทางเดินหายใจ", "10.2": "ทางเดินปัสสาวะ", "10.3": "กระแสเลือด", "10.4": "แผลผ่าตัด", "10.5": "ทางเดินอาหาร" };

// หมวดผลตรวจ → ตำแหน่งติดเชื้อ (สำหรับนับตาม site)
const SITE_OF_CAT: Record<string, string> = {
  VAP: "10.1", HAP: "10.1", UTI: "10.2", CAUTI: "10.2",
  CLABSI: "10.3", BSI: "10.3", SSI: "10.4", GI: "10.5",
};

// recharts click payloads vary by version (fields at top level or under `.payload`)
type BarDatum = { id?: string; name?: string; payload?: { id?: string; name?: string } };

/** Overall category of a record: HAI > CI > NONE. */
function recordCategory(r: PatientRecord): "HAI" | "CI" | "NONE" {
  const res = evaluate(r);
  if (res.some((x) => x.category === "HAI")) return "HAI";
  if (res.some((x) => x.category === "CI")) return "CI";
  return "NONE";
}

type WardRow = { name: string; HAI: number; CI: number; NONE: number; rate: number | null };

function WardTooltip({ active, payload, label }: {
  active?: boolean;
  label?: string;
  payload?: { payload: WardRow }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="card-soft p-2.5 text-xs space-y-0.5">
      <div className="font-bold text-foreground">{label}</div>
      <div className="text-pink-foreground">HAI: {d.HAI}</div>
      <div className="text-mint-foreground">CI: {d.CI}</div>
      <div className="text-sky-foreground">ไม่มีการติดเชื้อ: {d.NONE}</div>
      {d.rate != null && <div className="text-foreground/70 pt-0.5">อัตรา {d.rate}/1,000 วันนอน</div>}
    </div>
  );
}

const COLORS = ["#f9a8c5", "#a7e3d0", "#a8d5f5", "#fde68a", "#d4b4f5", "#fbb98a"];

const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

type Period = "day" | "month" | "year";
const PERIODS: { key: Period; label: string }[] = [
  { key: "day",   label: "รายวัน" },
  { key: "month", label: "รายเดือน" },
  { key: "year",  label: "รายปี" },
];

/** Build a sortable key + Thai (พ.ศ.) display label for a date by granularity. */
function periodKey(iso: string, p: Period): { key: string; label: string } {
  if (p === "day") {
    const [, m, d] = iso.slice(0, 10).split("-");
    return { key: iso.slice(0, 10), label: `${d}/${m}` };
  }
  if (p === "month") {
    const [y, m] = iso.slice(0, 7).split("-");
    const be = Number(y) + 543;
    return { key: iso.slice(0, 7), label: `${TH_MONTHS[Number(m) - 1]} ${be % 100}` };
  }
  const y = iso.slice(0, 4);
  return { key: y, label: String(Number(y) + 543) };
}

type WardView = "ALL" | "HAI" | "CI" | "NONE";
const WARD_VIEWS: { key: WardView; label: string }[] = [
  { key: "ALL",  label: "ทั้งหมด" },
  { key: "HAI",  label: "HAI" },
  { key: "CI",   label: "CI" },
  { key: "NONE", label: "ไม่ติดเชื้อ" },
];

export function DashboardView() {
  const records = useRecords();
  const monthlyStats = useMonthlyStats();
  const wards = useWards();
  const departments = useMemo(() => departmentGroups(), [wards]);
  const icuWards = useMemo(() => icuWardNames(), [wards]);
  const nonIcuWards = useMemo(() => wards.filter((w) => !w.isICU).map((w) => w.name), [wards]);
  const [period, setPeriod] = useState<Period>("month");
  const [wardView, setWardView] = useState<WardView>("ALL");
  const [deptYear, setDeptYear] = useState(""); // กราฟแผนก: ปี (พ.ศ. base CE)
  const [deptMon, setDeptMon]   = useState(""); // กราฟแผนก: เดือน ("01".."12")

  const deptMatch = (ym: string) => {
    if (deptYear && ym.slice(0, 4) !== deptYear) return false;
    if (deptMon && ym.slice(5, 7) !== deptMon) return false;
    return true;
  };

  const [icuYear, setIcuYear] = useState(""); // กราฟ ICU: ปี
  const [icuMon, setIcuMon]   = useState(""); // กราฟ ICU: เดือน
  const icuMatch = (ym: string) => {
    if (icuYear && ym.slice(0, 4) !== icuYear) return false;
    if (icuMon && ym.slice(5, 7) !== icuMon) return false;
    return true;
  };

  const [nonIcuYear, setNonIcuYear] = useState(""); // กราฟหอทั่วไป: ปี
  const [nonIcuMon, setNonIcuMon]   = useState(""); // กราฟหอทั่วไป: เดือน
  const nonIcuMatch = (ym: string) => {
    if (nonIcuYear && ym.slice(0, 4) !== nonIcuYear) return false;
    if (nonIcuMon && ym.slice(5, 7) !== nonIcuMon) return false;
    return true;
  };

  // HAI rate per 1,000 patient-days (from monthly denominator data)
  const rates   = useMemo(() => computeMonthlyRates(records, monthlyStats), [records, monthlyStats]);
  const overall = useMemo(() => overallRate(rates), [rates]);
  const rateTrend = useMemo(
    () => rates.map((r) => ({ label: periodKey(r.month + "-01", "month").label, rate: Number(r.ratePer1000.toFixed(2)) })),
    [rates],
  );

  // drill-down dialog
  const [list, setList] = useState<{ title: string; subtitle?: string; icon?: string; records: PatientRecord[] } | null>(null);

  const haiRecords  = records.filter((r) => isHAI(r.result));
  const ciRecords   = records.filter((r) => categorize(r.result) === "CI");
  const noneRecords = records.filter((r) => categorize(r.result) === "NONE");

  const byWard: WardRow[] = useMemo(() => {
    const m = new Map<string, { HAI: number; CI: number; NONE: number; infections: number; patientDays: number }>();
    const get = (w: string) => {
      let e = m.get(w);
      if (!e) { e = { HAI: 0, CI: 0, NONE: 0, infections: 0, patientDays: 0 }; m.set(w, e); }
      return e;
    };
    records.forEach((r) => {
      if (!r.ward) return;
      const e = get(r.ward);
      e[recordCategory(r)] += 1;
      e.infections += evaluate(r).filter((x) => x.category === "HAI").length;
    });
    // stats อาจบันทึกภายใต้ชื่อรวม เช่น ม.6ก → ใช้กับทั้ง ม.6ก ortho และ ม.6ก observe
    monthlyStats.forEach((s) => {
      if (!s.ward) return;
      // ลอง match ตรง แล้วลอง match alias (เช่น stats ของ ม.6ก ใส่ให้ทั้ง 2 แผนก)
      const e = m.get(s.ward);
      if (e) { e.patientDays += s.patientDays; return; }
      // หา rows ที่ statWard(row) === s.ward
      [...m.entries()].forEach(([ward, entry]) => {
        if (statWard(ward) === s.ward) entry.patientDays += s.patientDays;
      });
    });
    return [...m.entries()].map(([name, e]) => ({
      name, HAI: e.HAI, CI: e.CI, NONE: e.NONE,
      rate: e.patientDays > 0 ? Number(((e.infections / e.patientDays) * 1000).toFixed(1)) : null,
    }));
  }, [records, monthlyStats]);

  // เฉพาะ HAI: นับผลที่เป็น HAI แยกตามตำแหน่งติดเชื้อ
  const deptYearOptions = useMemo(() => {
    const nowCE = new Date().getFullYear();
    const range = Array.from({ length: 7 }, (_, i) => String(nowCE - 4 + i));
    const dataY = records.map((r) => (r.doeDate || r.createdAt || "").slice(0, 4)).filter(Boolean);
    return [...new Set([...range, ...dataY])].sort((a, b) => b.localeCompare(a));
  }, [records]);

  // จัดกลุ่มตามแผนก (Department): HAI / CI / ไม่ติดเชื้อ (กรองตามเดือน/ปี)
  const byDept = useMemo(() => {
    const m = new Map<string, { HAI: number; CI: number; NONE: number }>();
    departments.forEach((d) => m.set(d.name, { HAI: 0, CI: 0, NONE: 0 })); // แสดงทุกแผนกแม้ยังไม่มีข้อมูล
    records.forEach((r) => {
      if (!r.ward) return;
      if (!deptMatch((r.doeDate || r.createdAt || "").slice(0, 7))) return;
      const dept = departmentOf(r.ward);
      let e = m.get(dept);
      if (!e) { e = { HAI: 0, CI: 0, NONE: 0 }; m.set(dept, e); }
      e[recordCategory(r)] += 1;
    });
    return [...m.entries()]
      .filter(([name, e]) => departments.some((d) => d.name === name) || e.HAI + e.CI + e.NONE > 0)
      .map(([name, e]) => ({ name, HAI: e.HAI, CI: e.CI, NONE: e.NONE }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, departments, deptYear, deptMon]);

  // HAI เฉพาะหอ ICU — จำนวน + อัตรา/1,000 วันนอน (กรองตามเดือน/ปี)
  const byIcu = useMemo(() => {
    const cnt = new Map<string, number>(); icuWards.forEach((w) => cnt.set(w, 0));
    const pdays = new Map<string, number>(); icuWards.forEach((w) => pdays.set(w, 0));
    records.forEach((r) => {
      if (!r.ward || !icuWards.includes(r.ward)) return;
      if (!icuMatch((r.doeDate || r.createdAt || "").slice(0, 7))) return;
      if (recordCategory(r) === "HAI") cnt.set(r.ward, (cnt.get(r.ward) ?? 0) + 1);
    });
    monthlyStats.forEach((s) => {
      if (s.ward && icuWards.includes(s.ward) && icuMatch(s.month)) pdays.set(s.ward, (pdays.get(s.ward) ?? 0) + s.patientDays);
    });
    return icuWards.map((w) => {
      const c = cnt.get(w) ?? 0, d = pdays.get(w) ?? 0;
      return { name: w, value: c, rate: d > 0 ? Number(((c / d) * 1000).toFixed(1)) : null };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, monthlyStats, icuWards, icuYear, icuMon]);

  // HAI หอผู้ป่วยทั่วไป (ยกเว้น ICU) — จำนวน + อัตรา/1,000 วันนอน
  const byNonIcu = useMemo(() => {
    const cnt = new Map<string, number>(); nonIcuWards.forEach((w) => cnt.set(w, 0));
    const pdays = new Map<string, number>(); nonIcuWards.forEach((w) => pdays.set(w, 0));
    records.forEach((r) => {
      if (!r.ward || !nonIcuWards.includes(r.ward)) return;
      if (!nonIcuMatch((r.doeDate || r.createdAt || "").slice(0, 7))) return;
      if (recordCategory(r) === "HAI") cnt.set(r.ward, (cnt.get(r.ward) ?? 0) + 1);
    });
    monthlyStats.forEach((s) => {
      if (!s.ward || !nonIcuMatch(s.month)) return;
      // stats อาจบันทึกเป็นชื่อรวม (เช่น ม.6ก) → แจกจ่ายให้ทุก ward ที่ statWard(w) === s.ward
      nonIcuWards.forEach((w) => {
        if (w === s.ward || statWard(w) === s.ward) pdays.set(w, (pdays.get(w) ?? 0) + s.patientDays);
      });
    });
    return nonIcuWards.map((w) => {
      const c = cnt.get(w) ?? 0, d = pdays.get(w) ?? 0;
      return { name: w, value: c, rate: d > 0 ? Number(((c / d) * 1000).toFixed(1)) : null, pdays: d };
    }).filter((x) => x.value > 0 || x.pdays > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, monthlyStats, nonIcuWards, nonIcuYear, nonIcuMon]);

  const bySite = useMemo(() => {
    const m = new Map<string, number>();
    records.forEach((r) => evaluate(r).forEach((res) => {
      if (res.category !== "HAI") return;
      const site = SITE_OF_CAT[categorize(res.label)];
      if (site) m.set(site, (m.get(site) ?? 0) + 1);
    }));
    return Array.from(m, ([id, value]) => ({ id, name: SITE_LABELS[id] ?? id, value })).filter((d) => d.value > 0);
  }, [records]);

  const trend = useMemo(() => {
    const m = new Map<string, { label: string; count: number }>();
    records.forEach((r) => {
      const iso = r.doeDate || r.createdAt;
      if (!iso) return;
      const { key, label } = periodKey(iso, period);
      const cur = m.get(key);
      m.set(key, { label, count: (cur?.count ?? 0) + 1 });
    });
    return Array.from(m, ([key, v]) => ({ key, label: v.label, count: v.count }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [records, period]);

  const trendTitle = period === "day" ? "Trend รายวัน 📈" : period === "month" ? "Trend รายเดือน 📈" : "Trend รายปี 📈";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="HAI ทั้งหมด" value={haiRecords.length} emoji="🏥" color="bg-pink text-pink-foreground"
          onClick={() => setList({ title: "ผู้ป่วยติดเชื้อในโรงพยาบาล (HAI)", icon: "🏥", records: haiRecords })} />
        <Stat label="CI ทั้งหมด" value={ciRecords.length} emoji="🏘️" color="bg-mint text-mint-foreground"
          onClick={() => setList({ title: "ผู้ป่วยติดเชื้อในชุมชน (CI)", icon: "🏘️", records: ciRecords })} />
        <Stat label="ไม่ติดเชื้อ" value={noneRecords.length} emoji="💧" color="bg-sky text-sky-foreground"
          onClick={() => setList({ title: "ผู้ป่วยไม่มีการติดเชื้อ", icon: "💧", records: noneRecords })} />
        <Stat label="ผู้ป่วยทั้งหมด" value={records.length} emoji="🧸" color="bg-lemon text-lemon-foreground"
          onClick={() => setList({ title: "ผู้ป่วยทั้งหมด", icon: "🧸", records })} />
      </div>

      {/* HAI rate per 1,000 patient-days */}
      <div className="card-soft p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <div className="font-bold text-primary">อัตราการติดเชื้อ HAI ต่อ 1,000 วันนอน 🩺</div>
          <div className="text-[11px] text-muted-foreground">อ้างอิงข้อมูลวันนอนรายเดือน</div>
        </div>
        {monthlyStats.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            ยังไม่มีข้อมูลวันนอนรายเดือน — เพิ่มได้ที่เมนู “ข้อมูลรายเดือน” (เฉพาะแอดมิน) 🐰
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4 items-center">
            <div className="rounded-2xl p-4 bg-gradient-to-br from-pink/40 to-lavender/30 border border-white/60 text-center">
              <div className="text-4xl font-extrabold tabular-nums text-pink-foreground">{overall.ratePer1000.toFixed(2)}</div>
              <div className="text-xs text-foreground/60 mt-1">ต่อ 1,000 วันนอน (รวม)</div>
              <div className="text-[11px] text-foreground/50 mt-1">
                {overall.infections.toLocaleString()} ราย / {overall.patientDays.toLocaleString()} วันนอน
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={rateTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0eaff" />
                <XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} />
                <Tooltip formatter={(v: number) => [`${v} /1,000 วันนอน`, "อัตรา"]} />
                <Line type="monotone" dataKey="rate" stroke="#a78bf5" strokeWidth={3} dot={{ r: 4, fill: "#a78bf5" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Chart
          title="แยกตามหอผู้ป่วย 🛏️"
          action={
            <div className="flex gap-1 bg-muted/60 rounded-xl p-1">
              {WARD_VIEWS.map((v) => (
                <button key={v.key} onClick={() => setWardView(v.key)}
                  className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                    wardView === v.key ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {v.label}
                </button>
              ))}
            </div>
          }>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byWard}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0eaff" />
              <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} />
              <Tooltip content={<WardTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {([
                ["HAI", "HAI", "#f487b6"],
                ["CI", "CI", "#6fcfb0"],
                ["NONE", "ไม่มีการติดเชื้อ", "#8fc7ef"],
              ] as const).filter(([key]) => wardView === "ALL" || wardView === key).map(([key, label, fill]) => (
                <Bar key={key} dataKey={key} name={label} fill={fill} radius={[6, 6, 0, 0]} className="cursor-pointer"
                  onClick={(d: BarDatum) => {
                    const name = d?.payload?.name ?? d?.name;
                    if (name) setList({
                      title: `หอ ${name} · ${label}`, icon: "🛏️",
                      records: records.filter((r) => r.ward === name && recordCategory(r) === key),
                    });
                  }} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Chart>
        <Chart title="แยกตามตำแหน่งติดเชื้อ 🌈 (เฉพาะ HAI)">
          {bySite.length === 0 ? (
            <div className="h-[260px] grid place-items-center text-muted-foreground">ยังไม่มีการติดเชื้อ HAI 🐰</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={bySite} dataKey="value" nameKey="name" outerRadius={90} label className="cursor-pointer"
                  onClick={(d: BarDatum) => {
                    const id = d?.payload?.id ?? d?.id;
                    const name = d?.payload?.name ?? d?.name;
                    if (id) setList({
                      title: `HAI · ตำแหน่ง: ${name ?? id}`, icon: "🌈",
                      records: records.filter((r) => evaluate(r).some((res) => res.category === "HAI" && SITE_OF_CAT[categorize(res.label)] === id)),
                    });
                  }}>
                  {bySite.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Chart>
        <Chart
          title={trendTitle}
          className="lg:col-span-2"
          action={
            <div className="flex gap-1 bg-muted/60 rounded-xl p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-semibold transition-all",
                    period === p.key ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}>
                  {p.label}
                </button>
              ))}
            </div>
          }>
          {trend.length === 0 ? (
            <div className="h-[240px] grid place-items-center text-muted-foreground">ยังไม่มีข้อมูล 🐰</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0eaff" />
                <XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#f487b6" strokeWidth={3} dot={{ r: 5, fill: "#f487b6" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Chart>

        {/* แยกตามแผนก (Department) */}
        <Chart
          title="แยกตามแผนก (Department) 🏛️ (HAI / CI / ไม่ติดเชื้อ)"
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-2">
              <select value={deptMon} onChange={(e) => setDeptMon(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-border bg-white text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">ทุกเดือน</option>
                {TH_MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
              </select>
              <select value={deptYear} onChange={(e) => setDeptYear(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-border bg-white text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">ทุกปี</option>
                {deptYearOptions.map((y) => <option key={y} value={y}>{Number(y) + 543}</option>)}
              </select>
            </div>
          }>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byDept}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0eaff" />
              <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {([
                ["HAI", "HAI", "#f487b6"],
                ["CI", "CI", "#6fcfb0"],
                ["NONE", "ไม่มีการติดเชื้อ", "#8fc7ef"],
              ] as const).map(([key, label, fill]) => (
                <Bar key={key} dataKey={key} name={label} fill={fill} radius={[6, 6, 0, 0]} className="cursor-pointer"
                  onClick={(d: BarDatum) => {
                    const name = d?.payload?.name ?? d?.name;
                    if (name) setList({
                      title: `แผนก ${name} · ${label}`, icon: "🏛️",
                      records: records.filter((r) => r.ward && departmentOf(r.ward) === name && recordCategory(r) === key
                        && deptMatch((r.doeDate || r.createdAt || "").slice(0, 7))),
                    });
                  }} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Chart>

        {/* HAI หอผู้ป่วย ICU */}
        <Chart
          title="HAI หอผู้ป่วย ICU 🏥"
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-2">
              <select value={icuMon} onChange={(e) => setIcuMon(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-border bg-white text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">ทุกเดือน</option>
                {TH_MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
              </select>
              <select value={icuYear} onChange={(e) => setIcuYear(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-border bg-white text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">ทุกปี</option>
                {deptYearOptions.map((y) => <option key={y} value={y}>{Number(y) + 543}</option>)}
              </select>
            </div>
          }>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={byIcu}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0eaff" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis yAxisId="left" fontSize={11} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" fontSize={11} />
              <Tooltip formatter={(v: number, key) => key === "rate" ? [`${v ?? "—"} /1,000 วันนอน`, "อัตรา"] : [`${v} ราย`, "HAI"]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="value" name="HAI (ราย)" radius={[8, 8, 0, 0]} className="cursor-pointer"
                onClick={(d: BarDatum) => {
                  const name = d?.payload?.name ?? d?.name;
                  if (name) setList({
                    title: `HAI · ICU ${name}`, icon: "🏥",
                    records: records.filter((r) => r.ward === name && recordCategory(r) === "HAI"
                      && icuMatch((r.doeDate || r.createdAt || "").slice(0, 7))),
                  });
                }}>
                {byIcu.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="rate" name="อัตรา/1,000 วันนอน"
                stroke="#a78bf5" strokeWidth={3} dot={{ r: 4, fill: "#a78bf5" }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </Chart>

        {/* HAI หอผู้ป่วยทั่วไป (ยกเว้น ICU) */}
        <Chart
          title="HAI หอผู้ป่วยทั่วไป (ยกเว้น ICU) 🛏️"
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-2">
              <select value={nonIcuMon} onChange={(e) => setNonIcuMon(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-border bg-white text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">ทุกเดือน</option>
                {TH_MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
              </select>
              <select value={nonIcuYear} onChange={(e) => setNonIcuYear(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-border bg-white text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">ทุกปี</option>
                {deptYearOptions.map((y) => <option key={y} value={y}>{Number(y) + 543}</option>)}
              </select>
            </div>
          }>
          {byNonIcu.length === 0 ? (
            <div className="h-[260px] grid place-items-center text-muted-foreground">ยังไม่มีข้อมูล 🐰</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={byNonIcu}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0eaff" />
                <XAxis dataKey="name" fontSize={10} interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis yAxisId="left" fontSize={11} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" fontSize={11} />
                <Tooltip formatter={(v: number, key) => key === "rate" ? [`${v ?? "—"} /1,000 วันนอน`, "อัตรา"] : [`${v} ราย`, "HAI"]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="value" name="HAI (ราย)" radius={[6, 6, 0, 0]} className="cursor-pointer"
                  onClick={(d: BarDatum) => {
                    const name = d?.payload?.name ?? d?.name;
                    if (name) setList({
                      title: `HAI · ${name}`, icon: "🛏️",
                      records: records.filter((r) => r.ward === name && recordCategory(r) === "HAI"
                        && nonIcuMatch((r.doeDate || r.createdAt || "").slice(0, 7))),
                    });
                  }}>
                  {byNonIcu.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="rate" name="อัตรา/1,000 วันนอน"
                  stroke="#a78bf5" strokeWidth={3} dot={{ r: 3, fill: "#a78bf5" }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Chart>
      </div>

      {/* สรุปเชื้อก่อโรคแยกตามประเภทการติดเชื้อ */}
      <PathogenByTypeSection records={records} />

      {/* เชื้อดื้อยา (MDRO) */}
      <MdroSection records={records} />

      {/* การได้รับยาฆ่าเชื้อ (ทุกหอผู้ป่วย) */}
      <AntibioticSection records={records} />

      {/* drill-down: list of patients behind a clicked item */}
      <PatientListDialog
        open={list !== null}
        onOpenChange={(o) => { if (!o) setList(null); }}
        title={list?.title ?? ""}
        icon={list?.icon}
        records={list?.records ?? []}
      />
    </div>
  );
}

// ── สรุปเชื้อก่อโรคแยกตามประเภทการติดเชื้อ ────────────────────────────────
function PathogenByTypeSection({ records }: { records: PatientRecord[] }) {
  const haiWithOrg = records.filter(
    (r) => (r.result ?? "").includes("HAI") && r.organismsBySite && Object.keys(r.organismsBySite).length > 0,
  );

  const [activeCol, setActiveCol] = useState(HAI_COLS[0].key);
  // drill-down: เชื้อที่คลิก → dialog รายหอ
  const [detail, setDetail] = useState<{ org: string; wardRows: { ward: string; count: number }[] } | null>(null);

  // map: haiType → organism → ward → count
  type WardCount = Map<string, number>;
  type OrgMap    = Map<string, WardCount>;
  const byType   = new Map<string, OrgMap>();
  HAI_COLS.forEach((c) => byType.set(c.key, new Map()));

  haiWithOrg.forEach((r) => {
    Object.entries(r.organismsBySite ?? {}).forEach(([site, orgs]) => {
      const haiType = recordSiteToHaiType(r, site);
      const orgMap  = byType.get(haiType);
      if (!orgMap) return;
      orgs.forEach((name) => {
        const n = name.trim(); if (!n) return;
        if (!orgMap.has(n)) orgMap.set(n, new Map());
        const wardMap = orgMap.get(n)!;
        const ward = r.ward || "— ไม่ระบุ —";
        wardMap.set(ward, (wardMap.get(ward) ?? 0) + 1);
      });
    });
  });

  const typeTotals = new Map(HAI_COLS.map((c) => {
    let sum = 0;
    byType.get(c.key)?.forEach((wm) => wm.forEach((v) => { sum += v; }));
    return [c.key, sum];
  }));

  const activeOrgMap = byType.get(activeCol) ?? new Map();
  // organism → total count (across wards)
  const rows = [...activeOrgMap.entries()]
    .map(([org, wm]) => ({ org, count: [...wm.values()].reduce((s, n) => s + n, 0) }))
    .sort((a, b) => b.count - a.count);
  const peak  = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((s, r) => s + r.count, 0);

  const openDetail = (org: string) => {
    const wm = activeOrgMap.get(org);
    if (!wm) return;
    const wardRows = [...wm.entries()]
      .map(([ward, count]) => ({ ward, count }))
      .sort((a, b) => b.count - a.count);
    setDetail({ org, wardRows });
  };

  if (haiWithOrg.length === 0) return null;

  return (
    <div className="card-soft p-5">
      <div className="font-bold text-primary mb-3">🦠 สรุปเชื้อก่อโรคแยกตามประเภทการติดเชื้อ</div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {HAI_COLS.map((c) => {
          const cnt = typeTotals.get(c.key) ?? 0;
          return (
            <button
              key={c.key}
              onClick={() => setActiveCol(c.key)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold border-2 transition-all",
                activeCol === c.key
                  ? "bg-pink text-pink-foreground border-pink-foreground/40 shadow-sm"
                  : "bg-white/60 border-border text-muted-foreground hover:bg-muted",
                cnt === 0 && activeCol !== c.key && "opacity-40",
              )}>
              {c.label}
              {cnt > 0 && <span className="ml-1 opacity-70">({cnt})</span>}
            </button>
          );
        })}
      </div>

      {/* รายการเชื้อ — คลิกเพื่อดูรายหอ */}
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">
          ยังไม่มีข้อมูลเชื้อก่อโรคสำหรับ {activeCol} 🐰
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map(({ org, count }) => (
            <button
              key={org}
              type="button"
              onClick={() => openDetail(org)}
              className="w-full flex items-center gap-3 rounded-xl hover:bg-sky/10 px-1 py-0.5 transition-colors group text-left">
              <div className="w-52 shrink-0 text-xs font-semibold text-foreground/80 truncate group-hover:text-primary transition-colors" title={org}>{org}</div>
              <div className="flex-1 h-6 rounded-lg bg-muted/60 overflow-hidden">
                <div className="h-full rounded-lg bg-sky-foreground/50 group-hover:bg-sky-foreground/70 transition-colors" style={{ width: `${(count / peak) * 100}%` }} />
              </div>
              <div className="w-20 shrink-0 text-xs tabular-nums text-right">
                <span className="font-bold text-foreground">{count}</span>
                <span className="text-muted-foreground ml-1">({total > 0 ? ((count / total) * 100).toFixed(1) : 0}%)</span>
              </div>
            </button>
          ))}
          <div className="pt-2 text-xs text-muted-foreground text-right border-t border-border/40">
            รวม {total} ครั้ง · กดชื่อเชื้อเพื่อดูรายละเอียดหอผู้ป่วย
          </div>
        </div>
      )}

      {/* Dialog รายหอผู้ป่วย */}
      <Dialog open={detail !== null} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader>
            <div className="text-center text-3xl mb-1">🦠</div>
            <DialogTitle className="text-center text-base">{detail?.org}</DialogTitle>
            <DialogDescription className="text-center text-xs">
              รายละเอียดหอผู้ป่วยสำหรับ {activeCol}
            </DialogDescription>
          </DialogHeader>
          <div className="px-2 pb-4 space-y-1.5 max-h-72 overflow-y-auto">
            {detail?.wardRows.map(({ ward, count }) => {
              const detailTotal = detail.wardRows.reduce((s, r) => s + r.count, 0);
              const pct = detailTotal > 0 ? ((count / detailTotal) * 100).toFixed(1) : "0";
              const peak2 = Math.max(1, ...detail.wardRows.map((r) => r.count));
              return (
                <div key={ward} className="flex items-center gap-2">
                  <div className="w-32 shrink-0 text-xs font-medium text-foreground truncate" title={ward}>{ward}</div>
                  <div className="flex-1 h-5 rounded-lg bg-muted/60 overflow-hidden">
                    <div className="h-full rounded-lg bg-lavender-foreground/60" style={{ width: `${(count / peak2) * 100}%` }} />
                  </div>
                  <div className="w-16 shrink-0 text-xs tabular-nums text-right">
                    <span className="font-bold">{count}</span>
                    <span className="text-muted-foreground ml-1">({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, emoji, color, onClick }: { label: string; value: number; emoji: string; color: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick || value === 0}
      className={cn(
        "card-soft p-4 text-left w-full transition-all",
        color,
        onClick && value > 0 ? "hover:scale-[1.03] hover:-translate-y-0.5 hover:shadow-md cursor-pointer" : "cursor-default",
      )}>
      <div className="text-3xl">{emoji}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
      <div className="text-xs opacity-80">{label}</div>
    </button>
  );
}
function Chart({ title, children, className, action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <div className={`card-soft p-5 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="font-bold text-primary">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}