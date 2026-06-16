import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { PatientRecord } from "@/lib/hai-types";
import { daysBetween, type RuleResult } from "@/lib/rule-engine";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: PatientRecord;
  results: RuleResult[]; // HAI results only
  playSound?: boolean;   // เล่นเสียงเตือนเมื่อเปิด
}

/** เล่นเสียงแจ้งเตือน HAI ด้วย Web Audio API */
function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 0.4;
    gain.connect(ctx.destination);

    // 3 beep ห่างกัน 0.3 วินาที
    [0, 0.35, 0.7].forEach((startTime) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 880;
      osc.connect(gain);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + 0.22);
    });

    setTimeout(() => ctx.close(), 2000);
  } catch { /* browser blocked audio */ }
}

/** Popup แจ้งเตือน HAI พร้อมเสียง */
export function HAIAlertDialog({ open, onOpenChange, data, results, playSound = false }: Props) {
  const diff = daysBetween(data.admitDate, data.doeDate);
  const playedRef = useRef(false);

  useEffect(() => {
    if (open && playSound && !playedRef.current) {
      playedRef.current = true;
      playAlertSound();
    }
    if (!open) playedRef.current = false;
  }, [open, playSound]);

  const isSaveAlert = playSound; // ถ้าเล่นเสียง = มาจากการบันทึก ปรับ UI ให้เข้มขึ้น

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-md rounded-3xl border-2 ${isSaveAlert ? "border-pink-foreground/60 shadow-xl" : "border-pink-foreground/30"} bg-gradient-to-br from-pink/60 via-lavender/50 to-sky/60`}>
        <DialogHeader>
          <div className={`mx-auto text-5xl mb-2 ${isSaveAlert ? "animate-bounce" : ""}`}>
            {isSaveAlert ? "🚨" : "🐰🏥"}
          </div>
          {isSaveAlert && (
            <div className="text-center text-xs font-bold text-pink-foreground bg-pink/40 rounded-full px-4 py-1 mx-auto mb-1">
              ⚠️ บันทึกข้อมูลแล้ว — พบการติดเชื้อในโรงพยาบาล
            </div>
          )}
          <DialogTitle className="text-center text-2xl font-bold text-primary">
            HAI — การติดเชื้อในโรงพยาบาล
          </DialogTitle>
          <DialogDescription className="text-center">
            <span className="flex flex-wrap justify-center gap-1.5 mt-2">
              {results.map((r, i) => (
                <span key={i} className="inline-block px-3 py-1 rounded-full bg-pink text-pink-foreground font-bold text-sm shadow">
                  {r.label}
                </span>
              ))}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm bg-white/70 rounded-2xl p-4 border border-border/60">
          {[data.firstName, data.lastName].some(Boolean) && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">ชื่อ-นามสกุล</span>
              <span className="font-semibold">{[data.firstName, data.lastName].filter(Boolean).join(" ")}</span>
            </div>
          )}
          <div className="flex justify-between"><span className="text-muted-foreground">HN</span><span className="font-semibold">{data.hn || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">AN</span><span className="font-semibold">{data.an || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">หอผู้ป่วย</span><span className="font-semibold">{data.ward || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">DOE − Admit</span><span className="font-semibold text-pink-foreground">{diff ?? "—"} วัน (≥ 3)</span></div>

          <div className="pt-2 mt-2 border-t border-dashed border-border space-y-1.5">
            {results.map((r, i) => (
              <div key={i}>
                <div className="font-semibold text-primary text-sm">{r.label}</div>
                {r.detail && <div className="text-xs text-muted-foreground">{r.detail}</div>}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="w-full rounded-2xl bg-primary text-primary-foreground py-2.5 font-semibold hover:opacity-90 transition">
            {isSaveAlert ? "✅ รับทราบ" : "รับทราบ 💖"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
