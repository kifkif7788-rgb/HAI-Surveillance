import { useState } from "react";
import { useRecords, deleteRecord } from "@/lib/hai-store";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateThai } from "@/components/ui/ThaiDatePicker";
import { PatientDetailDialog } from "@/components/PatientDetailDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { evaluate, type RuleResult } from "@/lib/rule-engine";
import type { PatientRecord } from "@/lib/hai-types";
import { cn } from "@/lib/utils";

const RESULT_TONE: Record<RuleResult["tone"], string> = {
  danger: "bg-pink/60 text-pink-foreground",
  warn:   "bg-lemon/60 text-lemon-foreground",
  ok:     "bg-mint/60 text-mint-foreground",
  info:   "bg-sky/60 text-sky-foreground",
};

const TH_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

/** "yyyy-mm" → "พฤษภาคม 2569" */
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${TH_MONTHS[Number(m) - 1]} ${Number(y) + 543}`;
}

export function PatientListView() {
  const records = useRecords();
  const [selected, setSelected] = useState<PatientRecord | null>(null);
  const [toDelete, setToDelete] = useState<PatientRecord | null>(null);
  const [ward, setWard]   = useState("");
  const [month, setMonth] = useState("");

  // options from existing data
  const wardOptions  = [...new Set(records.map((r) => r.ward || "— ไม่ระบุ —"))].sort();
  const monthOptions = [...new Set(records.map((r) => (r.doeDate || r.createdAt || "").slice(0, 7)).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a)); // newest first

  const filtered = records.filter((r) => {
    if (ward && (r.ward || "— ไม่ระบุ —") !== ward) return false;
    if (month && (r.doeDate || r.createdAt || "").slice(0, 7) !== month) return false;
    return true;
  });

  return (
    <div className="card-soft p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="font-bold text-primary">🧸 รายการผู้ป่วย ({filtered.length})</div>
        <div className="text-xs text-muted-foreground">คลิกที่แถวเพื่อดูรายละเอียด</div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">🏥 แผนก</label>
        <select
          value={ward}
          onChange={(e) => setWard(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border bg-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">ทุกแผนก</option>
          {wardOptions.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>

        <label className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5 ml-1">📅 เดือน</label>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border bg-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">ทุกเดือน</option>
          {monthOptions.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>

        {(ward || month) && (
          <button
            onClick={() => { setWard(""); setMonth(""); }}
            className="text-xs text-pink-foreground font-medium px-2.5 py-1 rounded-lg hover:bg-pink/20 transition-colors">
            ล้างตัวกรอง
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground bg-sky/30">
              <th className="p-3 rounded-l-xl">HN</th><th className="p-3">AN</th>
              <th className="p-3">ชื่อ-นามสกุล</th>
              <th className="p-3">อายุ</th>
              <th className="p-3">เพศ</th><th className="p-3">หอผู้ป่วย</th><th className="p-3">Admit</th>
              <th className="p-3">DOE</th><th className="p-3">ผลสรุป</th><th className="p-3 rounded-r-xl"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">ไม่มีข้อมูลตามตัวกรอง 🐰</td></tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.id}
                onClick={() => setSelected(r)}
                className="border-b border-border/40 hover:bg-pink/10 cursor-pointer transition-colors">
                <td className="p-3 font-medium">{r.hn}</td>
                <td className="p-3">{r.an}</td>
                <td className="p-3 whitespace-nowrap">
                  {[r.firstName, r.lastName].filter(Boolean).join(" ") || <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className="p-3">{r.age}</td>
                <td className="p-3">{r.sex === "male" ? "👦" : r.sex === "female" ? "👧" : "—"}</td>
                <td className="p-3">{r.ward}</td>
                <td className="p-3">{formatDateThai(r.admitDate, true)}</td>
                <td className="p-3">{formatDateThai(r.doeDate, true)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1 max-w-[260px]">
                    {evaluate(r).map((res, i) => (
                      <span key={i} className={cn("px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap", RESULT_TONE[res.tone])}>
                        {res.label}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); setToDelete(r); }}
                    className="p-2 rounded-lg hover:bg-pink/40 text-pink-foreground"
                    aria-label="ลบ">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PatientDetailDialog
        open={selected !== null}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
        record={selected}
      />

      <Dialog open={toDelete !== null} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader>
            <div className="text-center text-3xl mb-1">🗑️</div>
            <DialogTitle className="text-center">ลบรายการผู้ป่วย</DialogTitle>
            <DialogDescription className="text-center text-sm">
              ลบข้อมูล HN {toDelete?.hn}
              {toDelete?.an ? ` / AN ${toDelete.an}` : ""}
              {toDelete?.ward ? ` (${toDelete.ward})` : ""} ใช่หรือไม่?
              <br />การลบจะไม่สามารถกู้คืนได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2 mt-2">
            <button onClick={() => setToDelete(null)} className="btn-soft flex-1 justify-center">
              ยกเลิก
            </button>
            <button
              onClick={() => {
                if (!toDelete) return;
                deleteRecord(toDelete.id);
                toast.success(`ลบ HN ${toDelete.hn} แล้ว`);
                setToDelete(null);
              }}
              className="btn-soft bg-pink text-pink-foreground flex-1 justify-center">
              ลบ
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
