import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Pencil, Trash2, LogOut, BedDouble, Scissors } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  useORStats, upsertORStat, deleteORStat, OR_DEPTS, WOUND_CLASSES, type ORMonthlyStat, type ORDept,
} from "@/lib/or-store";
import { cn } from "@/lib/utils";

const TH_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${TH_MONTHS[Number(m) - 1]} ${Number(y) + 543}`;
}

export function ORMonthlyView({ lockedDept }: { lockedDept?: ORDept }) {
  const allRows = useORStats();
  const [editing, setEditing]   = useState<ORMonthlyStat | "new" | null>(null);
  const [toDelete, setToDelete] = useState<ORMonthlyStat | null>(null);

  // year + month filter
  const nowCE = new Date().getFullYear();
  const [filterYear,  setFilterYear]  = useState(String(nowCE));
  const [filterMonth, setFilterMonth] = useState("");

  const yearOptions = [...new Set([
    ...Array.from({ length: 5 }, (_, i) => String(nowCE - 4 + i)),
    ...allRows.map((r) => r.month.slice(0, 4)),
  ])].filter(Boolean).sort((a, b) => b.localeCompare(a));

  // OR department users only see/manage their own dept
  const rowsByDept = lockedDept ? allRows.filter((r) => r.dept === lockedDept) : allRows;
  const rows = rowsByDept.filter((r) => {
    if (!r.month.startsWith(filterYear)) return false;
    if (filterMonth && r.month.slice(5, 7) !== filterMonth) return false;
    return true;
  });
  const sorted = [...rows].sort((a, b) => b.month.localeCompare(a.month) || a.dept.localeCompare(b.dept));

  const selCls = "px-3 py-1.5 rounded-xl border border-border bg-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring";

  const confirmDelete = () => {
    if (!toDelete) return;
    deleteORStat(toDelete.id);
    toast.success(`ลบข้อมูล ${toDelete.dept} · ${monthLabel(toDelete.month)} แล้ว`);
    setToDelete(null);
  };

  return (
    <div className="card-soft p-5">
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="font-bold text-primary">🔪 ข้อมูลห้องผ่าตัด (OR) รายเดือน</div>
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className={selCls}>
            <option value="">ทุกเดือน</option>
            {TH_MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
            ))}
          </select>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className={selCls}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>ปี พ.ศ. {Number(y) + 543}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">{rows.length} รายการ</span>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="btn-soft bg-primary text-primary-foreground gap-2 px-4 text-sm">
          <CalendarPlus className="w-4 h-4" />
          เพิ่มข้อมูล OR
        </button>
      </div>
      <div className="text-xs text-muted-foreground mb-4">
        {lockedDept
          ? <>บันทึกข้อมูลของแผนก <span className="font-semibold text-foreground">{lockedDept}</span> · จำนวนแผลผ่าตัดแยกตามชนิดแผล (NW / CW / CCW / CoW / DW)</>
          : "แผนก OR IPD / OR OPD · จำนวนแผลผ่าตัดแยกตามชนิดแผล (NW / CW / CCW / CoW / DW)"}
      </div>

      {sorted.length === 0 ? (
        <div className="text-center text-muted-foreground py-10">ยังไม่มีข้อมูลห้องผ่าตัด 🐰</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground bg-lemon/30">
                <th className="p-3 rounded-l-xl whitespace-nowrap">แผนก</th>
                <th className="p-3 whitespace-nowrap">เดือน</th>
                <th className="p-3 text-right whitespace-nowrap">จำหน่าย</th>
                <th className="p-3 text-right whitespace-nowrap">วันนอน</th>
                {WOUND_CLASSES.map((w) => (
                  <th key={w.key} className="p-3 text-right whitespace-nowrap" title={w.hint}>{w.label}</th>
                ))}
                <th className="p-3 rounded-r-xl"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-border/40 hover:bg-lemon/10">
                  <td className="p-3 font-medium text-foreground whitespace-nowrap">{r.dept}</td>
                  <td className="p-3 whitespace-nowrap">{monthLabel(r.month)}</td>
                  <td className="p-3 text-right tabular-nums">{r.discharged.toLocaleString()}</td>
                  <td className="p-3 text-right tabular-nums">{r.patientDays.toLocaleString()}</td>
                  {WOUND_CLASSES.map((w) => (
                    <td key={w.key} className="p-3 text-right tabular-nums">{r[w.key].toLocaleString()}</td>
                  ))}
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(r)} className="p-2 rounded-lg hover:bg-sky/30 text-sky-foreground" aria-label="แก้ไข">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setToDelete(r)} className="p-2 rounded-lg hover:bg-pink/30 text-pink-foreground" aria-label="ลบ">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {sorted.length > 0 && (() => {
              const sum = (f: (r: ORMonthlyStat) => number) => sorted.reduce((a, r) => a + f(r), 0);
              return (
                <tfoot>
                  <tr className="bg-lemon/20 font-bold border-t-2 border-lemon-foreground/20">
                    <td className="p-3 rounded-l-xl text-lemon-foreground whitespace-nowrap">
                      รวม{filterMonth ? ` ${TH_MONTHS[Number(filterMonth) - 1]}` : ""} ปี {Number(filterYear) + 543}
                    </td>
                    <td className="p-3 text-muted-foreground">{sorted.length} รายการ</td>
                    <td className="p-3 text-right tabular-nums">{sum((r) => r.discharged).toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums">{sum((r) => r.patientDays).toLocaleString()}</td>
                    {WOUND_CLASSES.map((w) => (
                      <td key={w.key} className="p-3 text-right tabular-nums">{sum((r) => r[w.key]).toLocaleString()}</td>
                    ))}
                    <td className="p-3 rounded-r-xl" />
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        </div>
      )}

      {editing !== null && (
        <ORFormDialog stat={editing === "new" ? null : editing} lockedDept={lockedDept} onClose={() => setEditing(null)} />
      )}

      <Dialog open={toDelete !== null} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader>
            <div className="mx-auto text-4xl mb-1">🗑️</div>
            <DialogTitle className="text-center">ลบข้อมูลห้องผ่าตัด</DialogTitle>
            <DialogDescription className="text-center">
              ต้องการลบข้อมูล <span className="font-semibold text-foreground">{toDelete && `${toDelete.dept} · ${monthLabel(toDelete.month)}`}</span> ใช่หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button onClick={() => setToDelete(null)} className="btn-soft bg-muted text-foreground flex-1 justify-center">ยกเลิก</button>
            <button onClick={confirmDelete} className="btn-soft bg-pink text-pink-foreground flex-1 justify-center">ลบ</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const NOW = new Date();

function ORFormDialog({ stat, lockedDept, onClose }: { stat: ORMonthlyStat | null; lockedDept?: ORDept; onClose: () => void }) {
  const isEdit = stat !== null;
  const [dept, setDept]   = useState<ORDept>(stat?.dept ?? lockedDept ?? OR_DEPTS[0]);
  const [year, setYear]   = useState(stat ? Number(stat.month.split("-")[0]) : NOW.getFullYear());
  const [month, setMonth] = useState(stat ? Number(stat.month.split("-")[1]) : NOW.getMonth() + 1);
  const [discharged, setDischarged]   = useState<number | "">(stat?.discharged ?? "");
  const [patientDays, setPatientDays] = useState<number | "">(stat?.patientDays ?? "");
  const [wounds, setWounds] = useState<Record<string, number | "">>({
    nw: stat?.nw ?? "", cw: stat?.cw ?? "", ccw: stat?.ccw ?? "", cow: stat?.cow ?? "", dw: stat?.dw ?? "",
  });

  const save = () => {
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const n = (v: number | "") => (v === "" ? 0 : v);
    const res = upsertORStat({
      id: stat?.id ?? crypto.randomUUID(),
      dept, month: ym, discharged: n(discharged), patientDays: n(patientDays),
      nw: n(wounds.nw), cw: n(wounds.cw), ccw: n(wounds.ccw), cow: n(wounds.cow), dw: n(wounds.dw),
    });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(isEdit ? "บันทึกการแก้ไขแล้ว" : "เพิ่มข้อมูลห้องผ่าตัดแล้ว");
    onClose();
  };

  const ceNow = NOW.getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => ceNow - 4 + i);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขข้อมูลห้องผ่าตัด" : "เพิ่มข้อมูลห้องผ่าตัด"}</DialogTitle>
          <DialogDescription>ข้อมูล OR รายเดือน + จำนวนแผลผ่าตัดแยกชนิด</DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          <Field label="แผนก OR *">
            {lockedDept ? (
              <div className={cn(inputCls, "bg-muted/50 flex items-center")}>{dept}</div>
            ) : (
              <select value={dept} onChange={(e) => setDept(e.target.value as ORDept)} className={cn(inputCls, "cursor-pointer")}>
                {OR_DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="เดือน *">
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={cn(inputCls, "cursor-pointer")}>
                {TH_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </Field>
            <Field label="ปี (พ.ศ.) *">
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={cn(inputCls, "cursor-pointer")}>
                {years.map((y) => <option key={y} value={y}>{y + 543}</option>)}
              </select>
            </Field>
          </div>

          <NumField label="จำนวนผู้ป่วยจำหน่าย" icon={<LogOut className="w-4 h-4" />}    value={discharged} onChange={setDischarged} />
          <NumField label="จำนวนวันนอน"        icon={<BedDouble className="w-4 h-4" />}  value={patientDays} onChange={setPatientDays} />

          <div className="pt-1">
            <div className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5" /> จำนวนแผลผ่าตัด (แยกตามชนิดแผล)
            </div>
            <div className="grid grid-cols-2 gap-3">
              {WOUND_CLASSES.map((w) => (
                <Field key={w.key} label={`${w.label}`}>
                  <input
                    type="number" min={0} value={wounds[w.key]}
                    onChange={(e) => setWounds((prev) => ({ ...prev, [w.key]: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) }))}
                    className={cn(inputCls, "tabular-nums")}
                    title={w.hint}
                  />
                </Field>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 mt-2">
          <button onClick={onClose} className="btn-soft bg-muted text-foreground flex-1 justify-center">ยกเลิก</button>
          <button onClick={save} className="btn-soft bg-primary text-primary-foreground flex-1 justify-center">
            {isEdit ? "บันทึก" : "เพิ่มข้อมูล"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-xl border border-border bg-white text-sm transition-shadow " +
  "focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-foreground/60">{label}</label>
      {children}
    </div>
  );
}

function NumField({ label, icon, value, onChange }: {
  label: string; icon: React.ReactNode; value: number | ""; onChange: (n: number | "") => void;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50">{icon}</span>
        <input
          type="number" min={0} value={value}
          onChange={(e) => onChange(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
          className={cn(inputCls, "pl-9 tabular-nums")}
        />
      </div>
    </Field>
  );
}
