import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PatientDetailDialog } from "@/components/PatientDetailDialog";
import { formatDateThai } from "@/components/ui/ThaiDatePicker";
import type { PatientRecord } from "@/lib/hai-types";

/**
 * Shows a list of patient records (e.g. behind a dashboard number),
 * and lets the user drill into a single record's full detail.
 */
export function PatientListDialog({
  open, onOpenChange, title, subtitle, icon, records,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  subtitle?: string;
  icon?: string;
  records: PatientRecord[];
}) {
  const [rec, setRec] = useState<PatientRecord | null>(null);

  const closeAll = () => { setRec(null); onOpenChange(false); };

  return (
    <>
      {/* list (hidden while a detail is open) */}
      <Dialog open={open && rec === null} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            {icon && <div className="mx-auto text-4xl mb-1">{icon}</div>}
            <DialogTitle className="text-center text-xl font-bold text-primary">{title}</DialogTitle>
            <DialogDescription className="text-center text-xs">
              {subtitle ? `${subtitle} · ` : ""}{records.length} ราย
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {records.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">ไม่มีผู้ป่วย 🐰</div>
            ) : records.map((r) => (
              <button
                key={r.id}
                onClick={() => setRec(r)}
                className="w-full text-left rounded-2xl border border-border/60 bg-white p-3 flex items-center gap-3 hover:bg-sky/10 hover:border-sky-foreground/30 transition-all">
                <div className="w-10 h-10 rounded-xl bg-sky/20 grid place-items-center text-lg shrink-0">
                  {r.sex === "male" ? "👦" : r.sex === "female" ? "👧" : "🧸"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground truncate">HN {r.hn || "—"} · AN {r.an || "—"}</div>
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

      {/* individual detail */}
      <PatientDetailDialog
        open={rec !== null}
        onOpenChange={(o) => { if (!o) closeAll(); }}
        record={rec}
      />
    </>
  );
}
