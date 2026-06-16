import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { PatientRecord } from "@/lib/hai-types";
import { daysBetween, evaluate, type RuleResult } from "@/lib/rule-engine";
import { formatDateThai } from "@/components/ui/ThaiDatePicker";
import { cn } from "@/lib/utils";

const TONE: Record<RuleResult["tone"], string> = {
  danger: "bg-pink text-pink-foreground border-pink-foreground/30",
  warn: "bg-orange-soft text-orange-soft-foreground border-orange-soft-foreground/30",
  ok: "bg-mint text-mint-foreground border-mint-foreground/30",
  info: "bg-sky text-sky-foreground border-sky-foreground/30",
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: PatientRecord;
  onSave: () => void;
}

export function EvaluationResultDialog({ open, onOpenChange, data, onSave }: Props) {
  const diff = daysBetween(data.admitDate, data.doeDate);
  const results = evaluate(data);
  const isHAI = diff !== null && diff >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl border-2 border-lavender-foreground/30 bg-gradient-to-br from-sky/60 via-lavender/50 to-mint/60">
        <DialogHeader>
          <div className="mx-auto text-5xl mb-1">🔍🧸</div>
          <DialogTitle className="text-center text-2xl font-bold text-primary">
            ผลการประเมิน HAI
          </DialogTitle>
          <DialogDescription className="text-center text-xs">
            สรุปอัตโนมัติจากข้อมูลที่กรอก (ยังไม่บันทึก)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="bg-white/70 rounded-2xl p-3 border border-border/60 text-sm grid grid-cols-2 gap-y-1">
            <span className="text-muted-foreground">HN</span><span className="font-semibold text-right">{data.hn || "—"}</span>
            <span className="text-muted-foreground">AN</span><span className="font-semibold text-right">{data.an || "—"}</span>
            <span className="text-muted-foreground">Admit</span><span className="font-semibold text-right">{formatDateThai(data.admitDate, true)}</span>
            <span className="text-muted-foreground">DOE</span><span className="font-semibold text-right">{formatDateThai(data.doeDate, true)}</span>
          </div>

          <div className={cn("rounded-2xl p-3 border-2 text-center",
            isHAI ? "bg-pink/70 border-pink-foreground/30" :
            diff !== null ? "bg-mint/70 border-mint-foreground/30" :
            "bg-muted border-border")}>
            <div className="text-xs">🏥 DOE − Admit</div>
            <div className="font-bold text-lg">{diff ?? "—"} วัน</div>
            <div className="text-sm font-semibold mt-0.5">
              {diff === null ? "—" : isHAI ? "ติดเชื้อในโรงพยาบาล (HAI)" : "ติดเชื้อในชุมชน (CI)"}
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {results.map((r, i) => (
              <div key={i} className={cn("rounded-2xl p-3 border-2", TONE[r.tone])}>
                <div className="font-bold text-sm">{r.label}</div>
                {r.detail && <div className="text-xs opacity-80 mt-0.5">{r.detail}</div>}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-2xl bg-white/80 hover:bg-white py-2.5 font-semibold border border-border transition"
          >
            ปิด
          </button>
          <button
            onClick={() => { onSave(); onOpenChange(false); }}
            className="flex-1 rounded-2xl bg-primary text-primary-foreground py-2.5 font-semibold hover:opacity-90 transition"
          >
            บันทึกข้อมูล 💾
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}