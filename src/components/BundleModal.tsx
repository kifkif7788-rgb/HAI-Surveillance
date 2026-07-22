import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

/* ── Bundle data ── */
interface BundleItem { text: string; detail?: string }
interface Bundle { title: string; icon: string; color: string; items: BundleItem[] }

const BUNDLES: Record<string, Bundle> = {
  VAP: {
    title: "VAP Bundle", icon: "🫁",  color: "sky",
    items: [
      { text: "ยกหัวเตียงสูง 30–45° ตลอดเวลา", detail: "ลดการสำลักสิ่งคัดหลั่งลงปอด" },
      { text: "ประเมิน Sedation vacation ทุกวัน", detail: "และทดสอบ Spontaneous Breathing Trial (SBT)" },
      { text: "ดูแลช่องปากด้วย Chlorhexidine 0.12%", detail: "ทุก 2–4 ชั่วโมง ลดการสะสมแบคทีเรีย" },
      { text: "ป้องกันแผลในกระเพาะ (PUD prophylaxis)", detail: "ใช้ H2-blocker หรือ PPI ตามข้อบ่งชี้" },
      { text: "ป้องกันหลอดเลือดดำอุดตัน (DVT prophylaxis)", detail: "LMWH หรือ graduated compression stocking" },
      { text: "ดูดเสมหะเหนือ cuff ก่อน deflate (subglottic suction)", detail: "ลดการสูดสำลักเข้าปอด" },
      { text: "เปลี่ยน ventilator circuit เฉพาะเมื่อสกปรกหรือชำรุด", detail: "ไม่เปลี่ยนตามตารางเวลาโดยไม่จำเป็น" },
      { text: "ล้างมือด้วยเทคนิคที่ถูกต้องทุกครั้งก่อน-หลังดูแลผู้ป่วย" },
    ],
  },
  HAP: {
    title: "HAP Bundle", icon: "🫁", color: "sky",
    items: [
      { text: "ยกหัวเตียงสูง 30–45° เมื่อให้อาหารหรือยา", detail: "ลดความเสี่ยงการสำลัก" },
      { text: "ดูแลช่องปากด้วย Chlorhexidine", detail: "ทุก 4–6 ชั่วโมง" },
      { text: "กระตุ้น early mobilization", detail: "ให้ผู้ป่วยลุกนั่ง/เดินตามความสามารถ" },
      { text: "ใช้มาตรการป้องกันการสำลัก (aspiration precautions)", detail: "ประเมินความเสี่ยงก่อนให้อาหารทางปาก" },
      { text: "ล้างมือด้วยเทคนิคที่ถูกต้องทุกครั้งก่อน-หลังดูแลผู้ป่วย" },
      { text: "หลีกเลี่ยงยาปฏิชีวนะที่ไม่จำเป็น", detail: "เพื่อลดความเสี่ยงเชื้อดื้อยา" },
    ],
  },
  CAUTI: {
    title: "CAUTI Bundle", icon: "💧", color: "lavender",
    items: [
      { text: "ใส่สายสวนปัสสาวะเฉพาะเมื่อจำเป็น", detail: "และบันทึกเหตุผลที่ชัดเจนทุกวัน" },
      { text: "ใช้เทคนิค Aseptic ขณะใส่สาย", detail: "สวม sterile gloves ใช้ antiseptic ทำความสะอาด" },
      { text: "รักษาระบบ Closed drainage ตลอดเวลา", detail: "ห้ามเปิดระบบโดยไม่จำเป็น" },
      { text: "ถุงเก็บปัสสาวะต้องอยู่ต่ำกว่ากระเพาะปัสสาวะเสมอ", detail: "ห้ามวางบนพื้น" },
      { text: "ยึดสายสวนให้แน่นเพื่อป้องกันการเคลื่อน", detail: "ใช้เทปหรืออุปกรณ์ยึดสาย" },
      { text: "ประเมินความจำเป็นของสายสวนทุกวัน", detail: "ถอดสายให้เร็วที่สุดเมื่อไม่จำเป็น" },
      { text: "ล้างมือด้วยเทคนิคที่ถูกต้องทุกครั้งก่อน-หลังดูแลสายสวน" },
    ],
  },
  UTI: {
    title: "UTI Bundle", icon: "💧", color: "lavender",
    items: [
      { text: "ส่งเสริมให้ผู้ป่วยดื่มน้ำเพียงพอ", detail: "เพิ่ม urine flow ลด colonization" },
      { text: "รักษาความสะอาดบริเวณอวัยวะสืบพันธุ์และรอบๆ สาย (ถ้ามี)" },
      { text: "ติดตามผล Urine C/S และเลือกยาตามผลเพาะเชื้อ", detail: "หลีกเลี่ยงการรักษาแบบ empiric นานเกินไป" },
      { text: "ล้างมือด้วยเทคนิคที่ถูกต้องทุกครั้ง" },
      { text: "หากมีสายสวน: ประเมินและถอดสายเมื่อไม่จำเป็น" },
    ],
  },
  CLABSI: {
    title: "CLABSI Bundle", icon: "🩸", color: "pink",
    items: [
      { text: "ล้างมืออย่างถูกวิธีก่อนดูแล Central line ทุกครั้ง" },
      { text: "ใส่สาย: สวม Maximal Barrier Precautions", detail: "mask, cap, sterile gown, sterile gloves, large sterile drape" },
      { text: "ฆ่าเชื้อผิวหนังด้วย Chlorhexidine ≥ 0.5% in alcohol", detail: "และรอให้แห้งสนิทก่อนแทงสาย" },
      { text: "เลือกตำแหน่งใส่สายที่เหมาะสม", detail: "Subclavian > Jugular > Femoral เพื่อลด CLABSI" },
      { text: "ดูแลจุดต่อสายและ hub ด้วยเทคนิค Aseptic", detail: "ใช้ Scrub-the-hub ทุกครั้งก่อนเข้าถึงสาย" },
      { text: "ประเมินความจำเป็นของสายทุกวัน", detail: "ถอดสายให้เร็วที่สุดเมื่อไม่จำเป็น" },
      { text: "เปลี่ยน IV set ตามกำหนด (72–96 ชั่วโมง)" },
    ],
  },
  BSI: {
    title: "BSI Bundle", icon: "🩸", color: "pink",
    items: [
      { text: "เก็บ Blood culture ≥ 2 ชุด จากตำแหน่งต่างกัน ก่อนให้ยา" },
      { text: "เริ่ม Empiric antibiotic ภายใน 1 ชั่วโมง กรณีสงสัย Sepsis", detail: "ปรับยาตามผล C/S ภายหลัง" },
      { text: "ค้นหาและควบคุมแหล่งติดเชื้อ (Source control)", detail: "ถอด line / ระบาย abscess ตามข้อบ่งชี้" },
      { text: "ดูแล IV access ด้วยเทคนิค Aseptic" },
      { text: "ติดตาม Vital signs, Lactate และการทำงานของอวัยวะอย่างใกล้ชิด" },
      { text: "ล้างมือทุกครั้งก่อน-หลังดูแลผู้ป่วยและ IV access" },
    ],
  },
  "2BSI": {
    title: "Secondary BSI Bundle", icon: "🩸", color: "pink",
    items: [
      { text: "รักษา/ควบคุมแหล่งติดเชื้อหลักก่อน (Primary source control)", detail: "เป็นสาเหตุหลักของ Secondary BSI" },
      { text: "เก็บ Blood culture ≥ 2 ชุด ก่อนเริ่มยา" },
      { text: "เลือก Antibiotic ให้ครอบคลุมเชื้อจากทั้ง 2 แหล่ง" },
      { text: "ติดตามผล C/S และปรับยาตามความเหมาะสม" },
      { text: "ติดตาม Vital signs และ organ function อย่างใกล้ชิด" },
    ],
  },
  SSI: {
    title: "SSI Bundle", icon: "🩹", color: "lemon",
    items: [
      { text: "ให้ยาปฏิชีวนะป้องกัน (Prophylactic antibiotic) ภายใน 60 นาทีก่อนผ่าตัด", detail: "เลือกยาที่ครอบคลุมเชื้อที่มักพบในตำแหน่งนั้น" },
      { text: "ควบคุมระดับน้ำตาลในเลือด < 180 mg/dL", detail: "ทั้งในผู้ป่วยเบาหวานและไม่เบาหวาน" },
      { text: "รักษาอุณหภูมิกายให้ปกติ (Normothermia)", detail: "ห้องผ่าตัดอุ่น / warming blanket" },
      { text: "อาบน้ำด้วย Chlorhexidine ก่อนผ่าตัด", detail: "อย่างน้อย 1 คืนก่อนหัตถการ" },
      { text: "หลีกเลี่ยงการโกนขนด้วยมีดโกน", detail: "ใช้ clipper แทน เพื่อลดการบาดเจ็บผิวหนัง" },
      { text: "ดูแลแผลผ่าตัดด้วยเทคนิค Aseptic", detail: "เปลี่ยนผ้าปิดแผลตามกำหนด หมั่นสังเกตสัญญาณติดเชื้อ" },
      { text: "ล้างมือก่อนทำแผล/ทำหัตถการทุกครั้ง" },
    ],
  },
  GI: {
    title: "GI Bundle", icon: "🍽️", color: "mint",
    items: [
      { text: "ให้สารน้ำและเกลือแร่ทดแทนอย่างเพียงพอ", detail: "ติดตาม electrolytes และ hydration status" },
      { text: "ล้างมือด้วยสบู่และน้ำ (ไม่ใช่ ABHR) ก่อน-หลังดูแลผู้ป่วย", detail: "สำคัญมากโดยเฉพาะกรณี C. difficile" },
      { text: "แยกผู้ป่วย (Contact precautions)", detail: "สวม gown และ gloves ทุกครั้งที่เข้าห้อง" },
      { text: "ทำความสะอาดสิ่งแวดล้อมและอุปกรณ์ด้วย Hypochlorite solution" },
      { text: "ติดตามอาการ: จำนวนและลักษณะอุจจาระ, Abdominal signs" },
      { text: "หลีกเลี่ยงยาที่ไม่จำเป็น เช่น ยาระบาย, ยาต้านการเคลื่อนไหวลำไส้", detail: "โดยเฉพาะกรณี C. difficile และ NEC" },
    ],
  },
  "GI-CDIFF": {
    title: "C. difficile Bundle", icon: "🍽️", color: "mint",
    items: [
      { text: "แยกผู้ป่วยทันที (Contact precautions)", detail: "ห้องแยก หรือรวมกับผู้ป่วย C.diff รายอื่น" },
      { text: "ล้างมือด้วยสบู่และน้ำเท่านั้น", detail: "Alcohol hand rub ไม่สามารถฆ่า C. difficile spore ได้" },
      { text: "สวม gown และ gloves ทุกครั้งที่เข้าห้องผู้ป่วย" },
      { text: "ทำความสะอาดสิ่งแวดล้อมด้วย Hypochlorite 1,000–5,000 ppm", detail: "รวมถึงราวเตียง โต๊ะ และอุปกรณ์ทุกชิ้น" },
      { text: "หยุดหรือปรับยาปฏิชีวนะที่ไม่จำเป็น", detail: "เป็น precipitating factor สำคัญ" },
      { text: "รักษาด้วย Metronidazole หรือ Vancomycin ตามความรุนแรง" },
      { text: "ให้สารน้ำทดแทนอย่างเพียงพอ" },
    ],
  },
  "GI-NEC": {
    title: "NEC Bundle", icon: "🍽️", color: "mint",
    items: [
      { text: "NPO ทันที และใส่สาย NG tube ระบาย", detail: "ลด distension และความเครียดต่อผนังลำไส้" },
      { text: "ให้สารน้ำทางหลอดเลือดดำ (TPN)", detail: "ทดแทนในช่วง bowel rest" },
      { text: "เริ่ม Broad-spectrum antibiotic ทันที", detail: "ครอบคลุม gram-negative และ anaerobes" },
      { text: "ติดตาม Abdominal X-ray อย่างน้อยทุก 6–12 ชั่วโมง", detail: "เฝ้าระวัง pneumoperitoneum / perforation" },
      { text: "Monitor vital signs, I&O, CBC, electrolytes อย่างใกล้ชิด" },
      { text: "ปรึกษาศัลยแพทย์เด็ก เมื่อสงสัย perforation หรือ NEC Stage III" },
    ],
  },
};

/* ── Match bundle key from result label ── */
function getBundleKeys(label: string): string[] {
  const l = label.toUpperCase();
  if (l.includes("VAP"))             return ["VAP"];
  if (l.includes("HAP"))             return ["HAP"];
  if (l.includes("CAUTI"))           return ["CAUTI"];
  if (l.includes("UTI"))             return ["UTI"];
  if (l.includes("CLABSI"))          return ["CLABSI"];
  if (l.includes("2'BSI") || l.includes("2BSI")) return ["2BSI"];
  if (l.includes("BSI"))             return ["BSI"];
  if (l.includes("SSI"))             return ["SSI"];
  if (l.includes("C. DIFFICILE"))    return ["GI-CDIFF"];
  if (l.includes("NEC"))             return ["GI-NEC"];
  if (l.includes("GI"))              return ["GI"];
  return [];
}

/* ── Color map ── */
const COLOR: Record<string, { header: string; check: string; item: string }> = {
  sky:      { header: "bg-sky text-sky-foreground",           check: "text-sky-foreground",      item: "border-sky/60 bg-sky/10" },
  lavender: { header: "bg-lavender text-lavender-foreground", check: "text-lavender-foreground", item: "border-lavender/60 bg-lavender/10" },
  pink:     { header: "bg-pink text-pink-foreground",         check: "text-pink-foreground",     item: "border-pink/60 bg-pink/10" },
  lemon:    { header: "bg-lemon text-lemon-foreground",       check: "text-lemon-foreground",    item: "border-lemon/60 bg-lemon/10" },
  mint:     { header: "bg-mint text-mint-foreground",         check: "text-mint-foreground",     item: "border-mint/60 bg-mint/10" },
};

/* ── Props ── */
interface Props {
  label: string;   // result label e.g. "HAI / VAP"
  onClose: () => void;
}

export function BundleModal({ label, onClose }: Props) {
  const keys = getBundleKeys(label);
  const bundles = keys.map((k) => BUNDLES[k]).filter(Boolean);

  const [checked, setChecked] = useState<boolean[][]>(
    () => bundles.map((b) => b.items.map(() => false))
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function toggle(bi: number, ii: number) {
    setChecked((prev) => prev.map((row, b) =>
      b !== bi ? row : row.map((v, i) => i === ii ? !v : v)
    ));
  }

  if (bundles.length === 0) return null;

  const totalItems = bundles.reduce((s, b) => s + b.items.length, 0);
  const totalDone  = checked.reduce((s, row) => s + row.filter(Boolean).length, 0);
  const pct = totalItems ? Math.round((totalDone / totalItems) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border/30">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-3xl shrink-0">{bundles[0].icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                  🧩 Bundle การดูแล
                </p>
                <p className="font-black text-primary text-lg leading-tight truncate">
                  {bundles.map((b) => b.title).join(" + ")}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-9 h-9 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all text-base font-bold">
              ✕
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold text-muted-foreground">ความคืบหน้า</span>
              <span className="text-xs font-bold text-foreground">{totalDone}/{totalItems} รายการ ({pct}%)</span>
            </div>
            <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-mint transition-all duration-300 rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">
          {bundles.map((bundle, bi) => {
            const c = COLOR[bundle.color] ?? COLOR.mint;
            const doneCount = checked[bi]?.filter(Boolean).length ?? 0;
            const total = bundle.items.length;

            return (
              <div key={bi}>
                {/* Section header */}
                <div className={cn("rounded-2xl px-5 py-3 mb-3 flex items-center justify-between", c.header)}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{bundle.icon}</span>
                    <span className="font-black text-base">{bundle.title}</span>
                  </div>
                  <span className={cn(
                    "text-sm font-bold px-2.5 py-0.5 rounded-full",
                    doneCount === total ? "bg-white/60" : "bg-black/10"
                  )}>
                    {doneCount}/{total}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-2.5">
                  {bundle.items.map((item, ii) => {
                    const done = checked[bi]?.[ii] ?? false;
                    return (
                      <button
                        key={ii}
                        type="button"
                        onClick={() => toggle(bi, ii)}
                        className={cn(
                          "w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all",
                          done
                            ? "bg-mint/15 border-mint-foreground/25"
                            : cn("bg-white hover:bg-muted/20 border-border/60 hover:border-border", c.item)
                        )}>
                        {/* Checkbox circle */}
                        <span className={cn(
                          "shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-black transition-all",
                          done
                            ? "bg-mint border-mint text-white"
                            : "border-border/60 bg-white/80"
                        )}>
                          {done ? "✓" : <span className="text-[10px] text-muted-foreground font-bold">{ii + 1}</span>}
                        </span>

                        <div className="flex-1 min-w-0 space-y-1">
                          <p className={cn(
                            "text-sm font-semibold leading-snug",
                            done ? "line-through text-muted-foreground" : "text-foreground"
                          )}>
                            {item.text}
                          </p>
                          {item.detail && (
                            <p className={cn(
                              "text-xs leading-relaxed",
                              done ? "text-muted-foreground/60" : "text-muted-foreground"
                            )}>
                              💡 {item.detail}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 px-5 py-3.5 border-t border-border/30 flex justify-between items-center bg-muted/20">
          <p className="text-xs text-muted-foreground">
            {totalDone === totalItems && totalItems > 0
              ? "✅ ครบทุกรายการแล้ว"
              : "กดแต่ละรายการเพื่อทำเครื่องหมาย ✓"}
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-2xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all shadow-sm">
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Trigger button (used in ResultSummaryPanel) ── */
export function BundleButton({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const keys = getBundleKeys(label);
  if (keys.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-dashed border-current/40 text-xs font-semibold hover:bg-white/30 transition-all">
        🧩 Bundle การดูแล
      </button>
      {open && <BundleModal label={label} onClose={() => setOpen(false)} />}
    </>
  );
}
