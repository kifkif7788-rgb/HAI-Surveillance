import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Pencil, Trash2, BedDouble, LogOut, Users as UsersIcon, Wind, Activity, Droplet } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useMonthlyStats, upsertMonthlyStat, deleteMonthlyStat, type MonthlyStat } from "@/lib/monthly-store";
import { ORMonthlyView } from "@/components/views/ORMonthlyView";
import { OR_DEPTS, type ORDept } from "@/lib/or-store";
import { useWardNames, WARD_STAT_ALIAS } from "@/lib/ward-store";
import { cn } from "@/lib/utils";

const TH_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${TH_MONTHS[Number(m) - 1]} ${Number(y) + 543}`;
}

export interface MonthlyUser { isAdmin: boolean; ward: string }

export function MonthlyDataView({ currentUser }: { currentUser: MonthlyUser }) {
  const allRows = useMonthlyStats();
  const wards = useWardNames();
  const [editing, setEditing]   = useState<MonthlyStat | "new" | null>(null);
  const [toDelete, setToDelete] = useState<MonthlyStat | null>(null);

  // year + month filter
  const nowCE = new Date().getFullYear();
  const [filterYear,  setFilterYear]  = useState(String(nowCE));
  const [filterMonth, setFilterMonth] = useState("");   // "" = ทุกเดือน

  const yearOptions = [...new Set([
    ...Array.from({ length: 5 }, (_, i) => String(nowCE - 4 + i)),
    ...allRows.map((r) => r.month.slice(0, 4)),
  ])].filter(Boolean).sort((a, b) => b.localeCompare(a));

  // Department users only see/manage their own ward; admins see everything.
  const rowsByWard = currentUser.isAdmin ? allRows : allRows.filter((r) => r.ward === currentUser.ward);
  const rows = rowsByWard.filter((r) => {
    if (!r.month.startsWith(filterYear)) return false;
    if (filterMonth && r.month.slice(5, 7) !== filterMonth) return false;
    return true;
  });
  const sorted = [...rows].sort((a, b) => b.month.localeCompare(a.month) || a.ward.localeCompare(b.ward));

  // A non-admin without an assigned ward cannot record anything
  const deptNoWard = !currentUser.isAdmin && !currentUser.ward;

  // OR department user → only the OR section, locked to their dept
  const orDept: ORDept | undefined =
    !currentUser.isAdmin && (OR_DEPTS as readonly string[]).includes(currentUser.ward)
      ? (currentUser.ward as ORDept)
      : undefined;

  // ผู้ใช้ระดับหอผู้ป่วย → ลงข้อมูลของหอตัวเองได้
  const isWardUser = !currentUser.isAdmin && wards.includes(currentUser.ward);
  const showWardSection = currentUser.isAdmin || isWardUser;
  const showOrSection   = currentUser.isAdmin || !!orDept;

  const confirmDelete = () => {
    if (!toDelete) return;
    deleteMonthlyStat(toDelete.id);
    toast.success(`ลบข้อมูล ${toDelete.ward} · ${monthLabel(toDelete.month)} แล้ว`);
    setToDelete(null);
  };

  return (
    <div className="space-y-5">
    {showWardSection && (
    <div className="card-soft p-5">
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="font-bold text-primary">📅 ข้อมูลรายเดือน</div>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-border bg-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">ทุกเดือน</option>
            {TH_MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
            ))}
          </select>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-border bg-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
            {yearOptions.map((y) => (
              <option key={y} value={y}>ปี พ.ศ. {Number(y) + 543}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">{rows.length} รายการ</span>
        </div>
        <button
          onClick={() => setEditing("new")}
          disabled={deptNoWard}
          className="btn-soft bg-primary text-primary-foreground gap-2 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          <CalendarPlus className="w-4 h-4" />
          เพิ่มข้อมูลเดือน
        </button>
      </div>
      <div className="text-xs text-muted-foreground mb-4">
        {currentUser.isAdmin
          ? "แอดมิน — จัดการข้อมูลได้ทุกแผนก"
          : currentUser.ward
            ? <>บันทึกข้อมูลของแผนก <span className="font-semibold text-foreground">{currentUser.ward}</span></>
            : "บัญชีของคุณยังไม่ได้กำหนดแผนก กรุณาติดต่อแอดมิน"}
      </div>

      {sorted.length === 0 ? (
        <div className="text-center text-muted-foreground py-10">ยังไม่มีข้อมูลรายเดือน 🐰</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground bg-sky/30">
                <th className="p-3 rounded-l-xl whitespace-nowrap">แผนก</th>
                <th className="p-3 whitespace-nowrap">เดือน</th>
                <th className="p-3 text-right whitespace-nowrap">วันนอน</th>
                <th className="p-3 text-right whitespace-nowrap">จำหน่าย</th>
                <th className="p-3 text-right whitespace-nowrap">ผู้ป่วยทั้งหมด</th>
                <th className="p-3 text-right whitespace-nowrap" title="วันใช้เครื่องช่วยหายใจ">Vent-days</th>
                <th className="p-3 text-right whitespace-nowrap" title="วันคาสายสวนหลอดเลือดดำส่วนกลาง">Line-days</th>
                <th className="p-3 text-right whitespace-nowrap" title="วันคาสายสวนปัสสาวะ">Cath-days</th>
                <th className="p-3 rounded-r-xl"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-border/40 hover:bg-sky/10">
                  <td className="p-3 font-medium text-foreground whitespace-nowrap">{r.ward || "— ไม่ระบุ —"}</td>
                  <td className="p-3 whitespace-nowrap">{monthLabel(r.month)}</td>
                  <td className="p-3 text-right tabular-nums">{r.patientDays.toLocaleString()}</td>
                  <td className="p-3 text-right tabular-nums">{r.discharged.toLocaleString()}</td>
                  <td className="p-3 text-right tabular-nums">{r.totalPatients.toLocaleString()}</td>
                  <td className="p-3 text-right tabular-nums">{r.ventilatorDays.toLocaleString()}</td>
                  <td className="p-3 text-right tabular-nums">{r.centralLineDays.toLocaleString()}</td>
                  <td className="p-3 text-right tabular-nums">{r.catheterDays.toLocaleString()}</td>
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
            <tfoot>
              {(() => {
                const sum = (f: (r: MonthlyStat) => number) => sorted.reduce((a, r) => a + f(r), 0);
                return (
                  <tr className="bg-primary/10 font-bold border-t-2 border-primary/30">
                    <td className="p-3 rounded-l-xl text-primary whitespace-nowrap">
                      รวม{filterMonth ? ` ${TH_MONTHS[Number(filterMonth) - 1]}` : ""} ปี {Number(filterYear) + 543}
                    </td>
                    <td className="p-3 text-muted-foreground">{sorted.length} รายการ</td>
                    <td className="p-3 text-right tabular-nums">{sum((r) => r.patientDays).toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums">{sum((r) => r.discharged).toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums">{sum((r) => r.totalPatients).toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums">{sum((r) => r.ventilatorDays).toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums">{sum((r) => r.centralLineDays).toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums">{sum((r) => r.catheterDays).toLocaleString()}</td>
                    <td className="p-3 rounded-r-xl" />
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
      )}

      {editing !== null && (
        <MonthlyFormDialog
          stat={editing === "new" ? null : editing}
          lockedWard={currentUser.isAdmin ? undefined : currentUser.ward}
          deviceOnly={!currentUser.isAdmin}
          onClose={() => setEditing(null)}
        />
      )}

      <Dialog open={toDelete !== null} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader>
            <div className="mx-auto text-4xl mb-1">🗑️</div>
            <DialogTitle className="text-center">ลบข้อมูลรายเดือน</DialogTitle>
            <DialogDescription className="text-center">
              ต้องการลบข้อมูล <span className="font-semibold text-foreground">{toDelete && `${toDelete.ward} · ${monthLabel(toDelete.month)}`}</span> ใช่หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button onClick={() => setToDelete(null)} className="btn-soft bg-muted text-foreground flex-1 justify-center">ยกเลิก</button>
            <button onClick={confirmDelete} className="btn-soft bg-pink text-pink-foreground flex-1 justify-center">ลบ</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    )}

    {/* Operating-room (OR) monthly data — admin sees all depts; OR user is locked to their own */}
    {showOrSection && <ORMonthlyView lockedDept={orDept} />}
    </div>
  );
}

const NOW = new Date();

function MonthlyFormDialog({
  stat, lockedWard, deviceOnly = false, onClose,
}: {
  stat: MonthlyStat | null;
  lockedWard: string | undefined; // department user → fixed ward; admin → undefined (selectable)
  deviceOnly?: boolean;           // ward user → กรอกเฉพาะ device-days (ค่าผู้ป่วยสงวนไว้ให้แอดมิน)
  onClose: () => void;
}) {
  const isEdit = stat !== null;
  const allWardNames = useWardNames();
  // แทน alias ด้วยชื่อรวม เพื่อให้กรอกครั้งเดียว (เช่น ม.6ก ortho + ม.6ก observe → ม.6ก)
  const aliasValues = new Set(Object.values(WARD_STAT_ALIAS));
  const aliasKeys   = new Set(Object.keys(WARD_STAT_ALIAS));
  const wards = [
    ...allWardNames.filter((w) => !aliasKeys.has(w)),  // หอที่ไม่มี alias
    ...aliasValues,                                     // ชื่อรวม (ม.6ก)
  ].sort();
  const [ward, setWard]   = useState(stat?.ward ?? lockedWard ?? "");
  const [year, setYear]   = useState(stat ? Number(stat.month.split("-")[0]) : NOW.getFullYear());
  const [month, setMonth] = useState(stat ? Number(stat.month.split("-")[1]) : NOW.getMonth() + 1);
  const [patientDays, setPatientDays]     = useState<number | "">(stat?.patientDays ?? "");
  const [discharged, setDischarged]       = useState<number | "">(stat?.discharged ?? "");
  const [totalPatients, setTotalPatients] = useState<number | "">(stat?.totalPatients ?? "");
  const [ventilatorDays, setVentilatorDays]   = useState<number | "">(stat?.ventilatorDays ?? "");
  const [centralLineDays, setCentralLineDays] = useState<number | "">(stat?.centralLineDays ?? "");
  const [catheterDays, setCatheterDays]       = useState<number | "">(stat?.catheterDays ?? "");

  const wardLocked = lockedWard !== undefined;

  const save = () => {
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const n = (v: number | "") => (v === "" ? 0 : v);
    const res = upsertMonthlyStat({
      id: stat?.id ?? crypto.randomUUID(),
      ward, month: ym,
      patientDays: n(patientDays), discharged: n(discharged), totalPatients: n(totalPatients),
      ventilatorDays: n(ventilatorDays), centralLineDays: n(centralLineDays), catheterDays: n(catheterDays),
    });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(isEdit ? "บันทึกการแก้ไขแล้ว" : "เพิ่มข้อมูลรายเดือนแล้ว");
    onClose();
  };

  const ceNow = NOW.getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => ceNow - 4 + i);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขข้อมูลรายเดือน" : "เพิ่มข้อมูลรายเดือน"}</DialogTitle>
          <DialogDescription>{deviceOnly ? "บันทึกเฉพาะจำนวนวันใช้อุปกรณ์ (device-days)" : "ข้อมูลตัวหารสำหรับคำนวณอัตราการติดเชื้อ"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          {/* ward */}
          <Field label="แผนก / หอผู้ป่วย *">
            {wardLocked ? (
              <div className={cn(inputCls, "bg-muted/50 flex items-center")}>{ward || "— ไม่ระบุ —"}</div>
            ) : (
              <select value={ward} onChange={(e) => setWard(e.target.value)} className={cn(inputCls, "cursor-pointer", !ward && "text-muted-foreground/50")}>
                <option value="">เลือกแผนก / หอผู้ป่วย</option>
                {wards.map((w) => <option key={w} value={w} className="text-foreground">{w}</option>)}
              </select>
            )}
          </Field>

          {/* month + year */}
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

          {!deviceOnly && <>
            <NumField label="จำนวนวันนอน (patient-days)" icon={<BedDouble className="w-4 h-4" />} value={patientDays} onChange={setPatientDays} />
            <NumField label="จำนวนผู้ป่วยจำหน่าย"        icon={<LogOut className="w-4 h-4" />}    value={discharged} onChange={setDischarged} />
            <NumField label="จำนวนผู้ป่วยทั้งหมด"         icon={<UsersIcon className="w-4 h-4" />}  value={totalPatients} onChange={setTotalPatients} />
          </>}
          {deviceOnly && (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-xl px-3 py-2">
              จำนวนวันนอน / ผู้ป่วยจำหน่าย / ผู้ป่วยทั้งหมด — บันทึกโดยแอดมิน
            </div>
          )}

          <div className="pt-1">
            <div className="text-xs font-bold text-primary mb-2">จำนวนวันใช้อุปกรณ์ (device-days)</div>
            <div className="space-y-3.5">
              <NumField label="วันใช้เครื่องช่วยหายใจ (ventilator-days)" icon={<Wind className="w-4 h-4" />}     value={ventilatorDays}  onChange={setVentilatorDays} />
              <NumField label="วันคาสายสวนหลอดเลือดดำส่วนกลาง (central line-days)" icon={<Activity className="w-4 h-4" />} value={centralLineDays} onChange={setCentralLineDays} />
              <NumField label="วันคาสายสวนปัสสาวะ (catheter-days)"      icon={<Droplet className="w-4 h-4" />}  value={catheterDays}    onChange={setCatheterDays} />
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
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
          className={cn(inputCls, "pl-9 tabular-nums")}
        />
      </div>
    </Field>
  );
}
