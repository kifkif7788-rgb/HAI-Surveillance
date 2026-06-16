import { type PatientRecord } from "@/lib/hai-types";
import { daysBetween, evaluate, type RuleResult } from "@/lib/rule-engine";
import { cn } from "@/lib/utils";

// Criteria per site for the reference section
const CRITERIA: Record<string, { ref: string; groups: { label: string; color: string; items: string[] }[] }> = {
  "10.1": {
    ref: "ข้อ 10.1",
    groups: [
      {
        label: "HAI / VAP", color: "pink",
        items: [
          "จำนวนวันในข้อ 8. ลบ ข้อ 7. ≥ 3 วัน",
          "ข้อ 10.1.1 ว่าใส่ท่อช่วยหายใจ",
          "ข้อ 10.1.2 มีข้อ 1-3 อย่างน้อย 1 ข้อ",
          "ข้อ 10.1.4 ผู้ป่วยทั่วไป มีข้อ 1-17 อย่างน้อย 1 ข้อ, ผู้ป่วยอายุ < 1 ปี และ > 1-12 ปี มีข้อ 1-17 อย่างน้อย 3 ข้อ",
        ],
      },
      {
        label: "HAI / HAP", color: "sky",
        items: [
          "จำนวนวันในข้อ 8. ลบ ข้อ 7. ≥ 3 วัน",
          "ข้อ 10.1.1 ไม่ได้ใส่ท่อช่วยหายใจ",
          "ข้อ 10.1.2 มีข้อ 1-3 อย่างน้อย 1 ข้อ",
          "ข้อ 10.1.4 ผู้ป่วยทั่วไป มีข้อ 1-17 อย่างน้อย 1 ข้อ, ผู้ป่วยอายุ < 1 ปี และ > 1-12 ปี มีข้อ 1-17 อย่างน้อย 3 ข้อ",
        ],
      },
      {
        label: "CI / CAP", color: "mint",
        items: [
          "จำนวนวันในข้อ 8. ลบ ข้อ 7. < 3 วัน",
          "ข้อ 10.1.4 ผู้ป่วยทั่วไป มีข้อ 1-17 อย่างน้อย 1 ข้อ, ผู้ป่วยอายุ < 1 ปี และ > 1-12 ปี มีข้อ 1-17 อย่างน้อย 3 ข้อ",
        ],
      },
      {
        label: "ไม่มีการติดเชื้อ VAP/HAP/CAP", color: "lavender",
        items: ["เมื่อเลือกข้อ 10.1.3 (ไม่มีผลอ่าน X-RAY ปอด)"],
      },
    ],
  },
  "10.2": {
    ref: "ข้อ 10.2",
    groups: [
      {
        label: "HAI / CAUTI", color: "pink",
        items: [
          "จำนวนวันในข้อ 8. ลบ ข้อ 7. ≥ 3 วัน",
          "ใส่สายสวนปัสสาวะ + ผล urine C/S บวก",
          "มีอาการอย่างน้อย 1 ข้อ",
        ],
      },
      {
        label: "HAI / UTI", color: "sky",
        items: [
          "จำนวนวันในข้อ 8. ลบ ข้อ 7. ≥ 3 วัน",
          "ไม่ใส่สายสวน + ผล urine C/S บวก",
          "มีอาการอย่างน้อย 1 ข้อ",
        ],
      },
      {
        label: "CI / UTI", color: "mint",
        items: [
          "จำนวนวันในข้อ 8. ลบ ข้อ 7. < 3 วัน",
          "ผล urine C/S บวก + มีอาการ",
        ],
      },
    ],
  },
  "10.3": {
    ref: "ข้อ 10.3",
    groups: [
      {
        label: "HAI / CLABSI", color: "pink",
        items: ["จำนวนวันในข้อ 8. ลบ ข้อ 7. ≥ 3 วัน", "มี central line + H/C บวก + มีอาการ"],
      },
      {
        label: "HAI / BSI", color: "sky",
        items: ["จำนวนวันในข้อ 8. ลบ ข้อ 7. ≥ 3 วัน", "H/C บวก + มีอาการ"],
      },
      {
        label: "CI / BSI", color: "mint",
        items: ["จำนวนวันในข้อ 8. ลบ ข้อ 7. < 3 วัน", "H/C บวก + มีอาการ"],
      },
    ],
  },
  "10.4": {
    ref: "ข้อ 10.4",
    groups: [
      {
        label: "SSI", color: "lemon",
        items: ["มีประวัติผ่าตัด", "อยู่ในช่วงเฝ้าระวัง", "มีอาการแสดงการติดเชื้อแผล"],
      },
    ],
  },
  "10.5": {
    ref: "ข้อ 10.5",
    groups: [
      {
        label: "HAI / GI", color: "pink",
        items: ["จำนวนวันในข้อ 8. ลบ ข้อ 7. ≥ 3 วัน", "มีอาการระบบทางเดินอาหาร", "ไม่ได้วินิจฉัย appendicitis"],
      },
      {
        label: "CI / GI", color: "mint",
        items: ["จำนวนวันในข้อ 8. ลบ ข้อ 7. < 3 วัน", "มีอาการระบบทางเดินอาหาร"],
      },
    ],
  },
};

const GROUP_STYLE: Record<string, { header: string; bg: string }> = {
  pink: { header: "bg-pink text-pink-foreground", bg: "bg-pink/30" },
  sky: { header: "bg-sky text-sky-foreground", bg: "bg-sky/30" },
  mint: { header: "bg-mint text-mint-foreground", bg: "bg-mint/30" },
  lemon: { header: "bg-lemon text-lemon-foreground", bg: "bg-lemon/30" },
  lavender: { header: "bg-lavender text-lavender-foreground", bg: "bg-lavender/30" },
};

const TONE_STYLE: Record<RuleResult["tone"], string> = {
  danger: "bg-pink/60 border-pink-foreground/30 text-pink-foreground",
  warn: "bg-lemon/60 border-lemon-foreground/30 text-lemon-foreground",
  ok: "bg-mint/60 border-mint-foreground/30 text-mint-foreground",
  info: "bg-sky/60 border-sky-foreground/20 text-sky-foreground",
};

export function ResultSummaryPanel({ data }: { data: PatientRecord }) {
  const diff = daysBetween(data.admitDate, data.doeDate);
  const results = evaluate(data);
  const isHAI = diff !== null && diff >= 3;
  const isCI = diff !== null && diff < 3;
  const hasDate = diff !== null;

  // First selected site for criteria display
  const firstSite = data.sites[0];
  const criteria = firstSite ? CRITERIA[firstSite] : null;

  return (
    <aside className="space-y-4">
      {/* Header card */}
      <div className="card-soft p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🤖</span>
          <div>
            <div className="font-bold text-primary text-sm">สรุปผลการประเมิน</div>
            <div className="text-[10px] text-muted-foreground">(อัตโนมัติ)</div>
          </div>
        </div>

        {/* HAI / CI result cards */}
        <div className="space-y-2.5 mb-4">
          {/* HAI card */}
          <div className={cn(
            "rounded-2xl p-3 border-2 flex items-center gap-3 transition-all",
            isHAI ? "bg-mint/70 border-mint-foreground/30 shadow-md" : "bg-muted/60 border-border opacity-60"
          )}>
            <span className="text-3xl shrink-0">🏥</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold leading-snug">ผู้ป่วยมีการติดเชื้อในโรงพยาบาล (HAI)</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">เมื่อ จำนวนวันในข้อ 8. ลบ ข้อ 7.</div>
            </div>
            <span className={cn(
              "shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap",
              isHAI ? "bg-orange-soft text-orange-soft-foreground" : "bg-muted text-muted-foreground"
            )}>≥ 3 วัน</span>
          </div>

          {/* CI card */}
          <div className={cn(
            "rounded-2xl p-3 border-2 flex items-center gap-3 transition-all",
            isCI ? "bg-mint/70 border-mint-foreground/30 shadow-md" : "bg-muted/60 border-border opacity-60"
          )}>
            <span className="text-3xl shrink-0">🏡</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold leading-snug">ผู้ป่วยมีการติดเชื้อในชุมชน (CI)</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">เมื่อ จำนวนวันในข้อ 8. ลบ ข้อ 7.</div>
            </div>
            <span className={cn(
              "shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap",
              isCI ? "bg-mint text-mint-foreground" : "bg-muted text-muted-foreground"
            )}>{"< 3 วัน"}</span>
          </div>

          {/* Days display */}
          {hasDate && (
            <div className="text-center text-xs text-muted-foreground">
              DOE − Admit = <span className="font-bold text-primary">{diff} วัน</span>
            </div>
          )}
        </div>

        {/* Detailed results */}
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className={cn("rounded-2xl p-3 border-2", TONE_STYLE[r.tone])}>
              <div className="font-bold text-sm">{r.label}</div>
              {r.detail && <div className="text-xs opacity-80 mt-0.5">{r.detail}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Criteria reference card */}
      {criteria && (
        <div className="card-soft p-4">
          <div className="font-bold text-primary text-sm mb-3 flex items-center gap-1.5">
            <span>📚</span>
            <span>เกณฑ์การสรุปผล</span>
            <span className="text-[10px] text-muted-foreground font-normal">(อ้างอิง{criteria.ref})</span>
          </div>
          <div className="space-y-2.5">
            {criteria.groups.map((g) => {
              const style = GROUP_STYLE[g.color] ?? GROUP_STYLE.sky;
              return (
                <div key={g.label} className={cn("rounded-xl overflow-hidden border border-border/40", style.bg)}>
                  <div className={cn("px-3 py-1.5 text-xs font-bold", style.header)}>{g.label}</div>
                  <ul className="px-3 py-2 space-y-1">
                    {g.items.map((item, i) => (
                      <li key={i} className="text-[11px] text-foreground flex gap-1.5">
                        <span className="shrink-0 text-muted-foreground">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fallback when no site selected */}
      {!criteria && (
        <div className="card-soft p-4 text-xs">
          <div className="font-bold text-primary mb-2">📚 เกณฑ์การสรุปผล</div>
          <ul className="space-y-1 text-muted-foreground list-disc pl-4">
            <li>HAI: DOE − Admit ≥ 3 วัน</li>
            <li>CI: DOE − Admit &lt; 3 วัน</li>
            <li>VAP: HAI + ใส่ท่อช่วยหายใจ + X-ray + อาการ</li>
            <li>HAP: HAI + ไม่ใส่ท่อ + X-ray + อาการ</li>
            <li>CAP: CI + X-ray + อาการ</li>
            <li>CLABSI: HAI + central line + H/C+</li>
            <li>SSI: ผ่าตัด + อยู่ในช่วงเฝ้าระวัง + อาการ</li>
          </ul>
        </div>
      )}
    </aside>
  );
}
