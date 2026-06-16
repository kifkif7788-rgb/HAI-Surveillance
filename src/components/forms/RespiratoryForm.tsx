import type { PatientRecord } from "@/lib/hai-types";
import { Check, Radio, SiteCard, toggle, type Updater } from "./shared";

const SYMPTOMS = [
  "1. ไข้ > 38°C", "2. อุณหภูมิ < 36°C",
  "3. WBC < 4,000 หรือ > 12,000/mm³",
  "4. อายุ < 1 ปี WBC <4,000 หรือ >15,000",
  "5. ไอรุนแรง", "6. หายใจลำบาก", "7. หยุดหายใจ",
  "8. หัวใจเต้นเร็ว", "9. จมูกบาน/อกบุ๋ม",
  "10. O₂ Sat < 94%", "11. PaO₂/FiO₂ < 240",
  "12. ปรับเครื่องช่วยหายใจเพิ่ม", "13. เสมหะมากขึ้น",
  "14. เสมหะคล้ายหนอง", "15. Wheezing/rhonchi",
  "16. หัวใจเต้นช้า (<100)", "17. หัวใจเต้นเร็ว (>170) อายุ<1ปี",
];

export function RespiratoryForm({ data, onChange }: { data: PatientRecord; onChange: Updater }) {
  const xray = data.resp_xray ?? [];
  const hasPositiveXray = xray.some((x) => x !== "notmatch"); // ข้อ 1-3 (ไม่นับ "notmatch")
  const notMatch = xray.includes("notmatch");

  // เลือกข้อ 1-3 → ล้าง "notmatch"; เลือกข้อ 4 (notmatch) → ล้าง 1-3 (exclusive)
  const toggleFinding = (x: "infiltration" | "cavitation" | "consolidation") =>
    onChange({ resp_xray: toggle(xray.filter((v) => v !== "notmatch"), x), resp_noxray: false });
  const toggleNotMatch = () =>
    onChange({ resp_xray: notMatch ? [] : ["notmatch"], resp_noxray: false });

  return (
    <SiteCard title="10.1 ระบบทางเดินหายใจ" emoji="🫁" color="bg-sky text-sky-foreground">
      <Sub title="10.1.1 ผู้ป่วยใส่ท่อช่วยหายใจมากกว่า 2 วันปฏิทินหรือไม่">
        <Radio checked={data.resp_intubated === true} label="ใส่ท่อช่วยหายใจมากกว่า 2 วันปฏิทิน"
          hint="นับวันที่ใส่ท่อเป็นวันที่ 1 โดย ณ วันแรกที่เกิดปอดอักเสบ (DOE) หรือ 1 วันก่อน DOE ยังมีท่อ"
          onChange={() => onChange({ resp_intubated: true })} />
        <Radio checked={data.resp_intubated === false} label="ไม่ได้ใส่ท่อช่วยหายใจ หรือใส่ ≤ 2 วันปฏิทิน"
          onChange={() => onChange({ resp_intubated: false, resp_xray: data.resp_xray })} />
      </Sub>

      <Sub title="10.1.2 ผล X-RAY ปอด (เลือกได้มากกว่า 1)">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(["infiltration", "cavitation", "consolidation"] as const).map((x, i) => (
            <Check key={x} checked={xray.includes(x)} label={`${i + 1}. ${x[0].toUpperCase()}${x.slice(1)}`}
              onChange={() => toggleFinding(x)} />
          ))}
        </div>
        <div className="mt-2">
          <Check checked={notMatch} label="4. ผลไม่ตรงกับข้อ 1, 2, 3" onChange={toggleNotMatch} />
        </div>
        <label className="flex items-center gap-2 mt-2 text-sm">
          <input type="checkbox" checked={!!data.resp_noxray} className="accent-primary"
            onChange={(e) => onChange({ resp_noxray: e.target.checked, resp_xray: e.target.checked ? [] : data.resp_xray })} />
          10.1.3 ไม่มีผลอ่าน X-RAY ปอด
        </label>
      </Sub>

      {!data.resp_noxray && hasPositiveXray && (
        <Sub title="10.1.4 อาการแสดงปอดอักเสบ (ผู้ป่วยอายุ <1 ปี หรือ 1-12 ปี ต้อง ≥ 3 ข้อ, อื่น ≥ 1 ข้อ)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {SYMPTOMS.map((s, i) => (
              <Check key={i} checked={!!data.resp_symptoms?.includes(i + 1)} label={s}
                onChange={() => onChange({ resp_symptoms: toggle(data.resp_symptoms, i + 1) })} />
            ))}
          </div>
        </Sub>
      )}
    </SiteCard>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/70 rounded-2xl p-4 border border-border/60">
      <div className="text-sm font-bold text-primary mb-2">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}