import { SSI_PROCEDURES_30, SSI_PROCEDURES_90, ssiWindowDays, type PatientRecord } from "@/lib/hai-types";
import { daysBetween } from "@/lib/rule-engine";
import { ThaiDatePicker } from "@/components/ui/ThaiDatePicker";
import { cn } from "@/lib/utils";
import { Check, CheckButton, Radio, SiteCard, toggle, type Updater } from "./shared";

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/70 rounded-2xl p-4 border border-border/60">
      <div className="text-sm font-bold text-primary mb-2">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value?: string; onChange: (iso: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <ThaiDatePicker value={value ?? ""} onChange={onChange} placeholder="วัน เดือน ปี (พ.ศ.)" />
    </div>
  );
}

const UTI_SYM = [
  "1. มีไข้ > 38°C",
  "2. ตัวเย็น อุณหภูมิ < 36°C",
  "3. ปัสสาวะแสบขัด",
  "4. ปัสสาวะมีตะกอน",
  "5. ปัสสาวะบ่อย",
  "6. ปัสสาวะเร่งด่วน (urgency)",
  "7. กดเจ็บบริเวณหัวหน่าวโดยไม่มีสาเหตุอื่น",
  "8. ปวดหลัง/กดเจ็บบริเวณ Costovertebral angle โดยไม่มีสาเหตุอื่น",
  "9. มีภาวะหยุดหายใจ (ผู้ป่วยอายุ < 1 ปี)",
  "10. หัวใจเต้นช้าผิดปกติ (ผู้ป่วยอายุ < 1 ปี)",
  "11. ซึมไม่มีสาเหตุอื่น (ผู้ป่วยอายุ < 1 ปี)",
  "12. อาเจียนไม่มีสาเหตุอื่น (ผู้ป่วยอายุ < 1 ปี)",
];
// ข้อ 3, 5, 7 ใช้ได้เฉพาะเมื่อถอดสายสวนแล้ว — ไม่นับเมื่อยังคาสายสวน
const UTI_CATHETER_ONLY = [3, 5, 7];
const stripCatheterOnly = (arr?: number[]) => (arr ?? []).filter((n) => !UTI_CATHETER_ONLY.includes(n));

export function UTIForm({ data, onChange }: { data: PatientRecord; onChange: Updater }) {
  const catheterInPlace = data.uti_catheter === true; // ยังคาสายสวน

  return (
    <SiteCard title="10.2 ระบบทางเดินปัสสาวะ" emoji="💧" color="bg-lavender text-lavender-foreground">
      <Sub title="10.2.1 ผู้ป่วยใส่สายสวนปัสสาวะหรือไม่">
        <Radio checked={data.uti_catheter === true && data.uti_catheter_ge2 === true} label="ใส่สายสวนปัสสาวะ > 2 วัน"
          onChange={() => onChange({ uti_catheter: true, uti_catheter_ge2: true, uti_symptoms: stripCatheterOnly(data.uti_symptoms) })} />
        <Radio checked={data.uti_catheter === true && data.uti_catheter_ge2 !== true} label="ใส่สายสวนปัสสาวะ ≤ 2 วัน"
          onChange={() => onChange({ uti_catheter: true, uti_catheter_ge2: false, uti_symptoms: stripCatheterOnly(data.uti_symptoms) })} />
        <Radio checked={data.uti_catheter === false} label="ไม่ใส่สายสวนปัสสาวะ"
          onChange={() => onChange({ uti_catheter: false, uti_catheter_ge2: false })} />
      </Sub>
      <Sub title="10.2.3 ผลเพาะเชื้อปัสสาวะ (Urine C/S)">
        <Radio checked={data.uti_culture === "negative"} label="ไม่พบเชื้อแบคทีเรีย"
          onChange={() => onChange({ uti_culture: "negative", uti_culture_positive: false, uti_candida: false })} />
        <Radio checked={data.uti_culture === "positive" || (data.uti_culture === undefined && data.uti_culture_positive === true && !data.uti_candida)} label="พบเชื้อก่อโรค ≥ 10⁵ CFU/mL และไม่เกิน 2 ชนิด"
          onChange={() => onChange({ uti_culture: "positive", uti_culture_positive: true, uti_candida: false })} />
        <Radio checked={data.uti_culture === "multi"} label="พบเชื้อมากกว่า 2 ชนิด"
          onChange={() => onChange({ uti_culture: "multi", uti_culture_positive: false, uti_candida: false })} />
        <Radio checked={data.uti_culture === "candida" || (data.uti_culture === undefined && !!data.uti_candida)} label="พบเชื้อ Candida ใน urine C/S"
          onChange={() => onChange({ uti_culture: "candida", uti_culture_positive: false, uti_candida: true })} />
      </Sub>
      <Sub title="10.2.4 อาการและอาการแสดง (เลือกอย่างน้อย 1 ข้อ)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {UTI_SYM.map((s, i) => {
            const val = i + 1;
            const disabled = catheterInPlace && UTI_CATHETER_ONLY.includes(val);
            return (
              <Check key={i}
                checked={!!data.uti_symptoms?.includes(val) && !disabled}
                disabled={disabled}
                label={disabled ? `${s} (ไม่นับขณะคาสายสวน)` : s}
                onChange={() => onChange({ uti_symptoms: toggle(data.uti_symptoms, val) })} />
            );
          })}
        </div>
        <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
          <div className="font-semibold text-foreground/70">หมายเหตุ การใช้เกณฑ์ข้อ 3, 5 และ 7</div>
          <div>• ไม่ใช้เกณฑ์นี้กรณีผู้ป่วยที่ยังคาสายสวนปัสสาวะ (อาจมีอาการได้แม้ไม่ติดเชื้อ)</div>
          <div>• ใช้เกณฑ์นี้เฉพาะกรณีผู้ป่วยถอดสายสวนปัสสาวะแล้วเท่านั้น</div>
        </div>
      </Sub>
    </SiteCard>
  );
}

const BSI_SYM = ["1. ไข้ > 38°C", "2. หนาวสั่น", "3. BP drop", "4. ตัวเย็น อุณหภูมิ < 36°C", "5. Apnea (หยุดหายใจ)", "6. ชีพจรเต้นช้า (Bradycardia)"];

const BSI_CONFIRM = [
  { key: "ge2_consec",  label: "1. พบเชื้อใน H/C ≥ 2 ครั้ง 2 วันต่อเนื่องกัน" },
  { key: "ge2_sameday", label: "2. พบเชื้อใน H/C ≥ 2 ครั้ง ต่างช่วงเวลาในวันเดียวกัน" },
  { key: "ge2_within2", label: "3. พบเชื้อใน H/C ≥ 2 ครั้ง ห่างกันไม่เกิน 2 วัน" },
  { key: "1x_consec",   label: "4. พบเชื้อใน H/C 1 ครั้ง ใน 2 วันต่อเนื่องกัน" },
  { key: "1x_sameday",  label: "5. พบเชื้อใน H/C 1 ครั้ง ต่างช่วงเวลาในวันเดียวกัน" },
] as const;

export function BSIForm({ data, onChange }: { data: PatientRecord; onChange: Updater }) {
  const positive  = data.bsi_hc_result === "positive";
  const le2       = positive && data.bsi_org_count === "le2";
  const isPathogen = le2 && data.bsi_org_type === "pathogen";
  const isFlora    = le2 && data.bsi_org_type === "flora";
  // 10.3.4.3 reveals when: เชื้อก่อโรคจาก peripheral หรือ normal flora
  const showConfirm = (isPathogen && data.bsi_pathogen_source === "peripheral") || isFlora;

  // 10.3.5 อาการ: อายุ < 1 ปี แสดงเฉพาะข้อ 1,4,5,6; อื่นๆ แสดงทุกข้อ
  const ageUnder1 = typeof data.age === "number" && data.age < 1;
  const bsiSymNos = ageUnder1 ? [1, 4, 5, 6] : [1, 2, 3, 4, 5, 6];

  return (
    <SiteCard title="10.3 การติดเชื้อกระแสเลือด" emoji="🩸" color="bg-pink text-pink-foreground">
      {/* 10.3.1 / 10.3.2 */}
      <Sub title="10.3.1–10.3.2 การใส่สายสวนหลอดเลือด">
        <Radio checked={data.bsi_line === "central_ge2"}
          label="10.3.1 ใส่สายสวนหลอดเลือดดำส่วนกลาง/สะดือ > 2 วันปฏิทิน (และยังคาอยู่ ณ วัน DOE หรือ 1 วันก่อน DOE)"
          onChange={() => onChange({ bsi_line: "central_ge2" })} />
        <Radio checked={data.bsi_line === "none"}
          label="10.3.2 ไม่มีการใส่สายสวนหลอดเลือดดำส่วนกลาง/สะดือ หรือใส่ ≤ 2 วันปฏิทิน"
          onChange={() => onChange({ bsi_line: "none" })} />
      </Sub>

      {/* 10.3.3 / 10.3.4 */}
      <Sub title="ผลเพาะเชื้อ Hemoculture (H/C)">
        <Radio checked={data.bsi_hc_result === "negative"} label="10.3.3 ผล H/C ไม่พบเชื้อ"
          onChange={() => onChange({ bsi_hc_result: "negative" })} />
        <Radio checked={positive} label="10.3.4 ผล H/C พบเชื้อ"
          onChange={() => onChange({ bsi_hc_result: "positive" })} />
        {positive && (
          <div className="pl-4 space-y-2">
            <Radio checked={data.bsi_org_count === "gt2"} label="1. พบ > 2 เชื้อ"
              onChange={() => onChange({ bsi_org_count: "gt2" })} />
            <Radio checked={data.bsi_org_count === "le2"} label="2. พบ ≤ 2 เชื้อ"
              onChange={() => onChange({ bsi_org_count: "le2" })} />
          </div>
        )}
      </Sub>

      {/* 10.3.4.1 / 10.3.4.2 — only when ≤ 2 เชื้อ */}
      {le2 && (
        <Sub title="10.3.4.1–10.3.4.2 ชนิดเชื้อที่พบ">
          <Radio checked={isPathogen} label="10.3.4.1 พบเชื้อก่อโรค"
            onChange={() => onChange({ bsi_org_type: "pathogen" })} />
          {isPathogen && (
            <div className="pl-4 space-y-2">
              <Radio checked={data.bsi_pathogen_source === "central"} label="1. จากสายสวนหลอดเลือดดำส่วนกลาง (Central line)"
                onChange={() => onChange({ bsi_pathogen_source: "central" })} />
              <Radio checked={data.bsi_pathogen_source === "peripheral"} label="2. จากหลอดเลือดดำส่วนปลาย (Peripheral line)"
                onChange={() => onChange({ bsi_pathogen_source: "peripheral" })} />
            </div>
          )}
          <Radio checked={isFlora} label="10.3.4.2 พบเฉพาะเชื้อในกลุ่ม Normal flora"
            onChange={() => onChange({ bsi_org_type: "flora" })} />
          {isFlora && (
            <div className="pl-4 text-xs text-muted-foreground leading-relaxed">
              เช่น Corynebacterium spp. (ที่ไม่ใช่ C.diphtheriae), Bacillus spp., Propionibacterium spp.,
              coagulase-negative staphylococci (รวม S. epidermidis), viridans group streptococci,
              Aerococcus spp., Micrococcus spp., Rhodococcus spp.
            </div>
          )}
        </Sub>
      )}

      {/* 10.3.4.3 — confirmation when peripheral pathogen or normal flora */}
      {showConfirm && (
        <Sub title="10.3.4.3 ยืนยันการพบเชื้อ">
          {BSI_CONFIRM.map((c) => (
            <Radio key={c.key} checked={data.bsi_confirm === c.key} label={c.label}
              onChange={() => onChange({ bsi_confirm: c.key })} />
          ))}
        </Sub>
      )}

      {/* 10.3.5 symptoms — กรองตามอายุ */}
      <Sub title="10.3.5 อาการ (อย่างน้อย 1 ข้อ)">
        {ageUnder1 && <div className="text-xs text-muted-foreground">อายุ &lt; 1 ปี — เลือกอย่างน้อย 1 ข้อ (ข้อ 1, 4, 5, 6)</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {bsiSymNos.map((no) => (
            <Check key={no} checked={!!data.bsi_symptoms?.includes(no)} label={BSI_SYM[no - 1]}
              onChange={() => onChange({ bsi_symptoms: toggle(data.bsi_symptoms, no) })} />
          ))}
        </div>
      </Sub>
    </SiteCard>
  );
}

const SSI_WOUND = [
  { key: "CW",  label: "1. Clean wound (CW)" },
  { key: "CCW", label: "2. Clean contaminated wound (CCW)" },
  { key: "CoW", label: "3. Contaminated wound (CoW)" },
  { key: "DW",  label: "4. Dirty wound (DW)" },
] as const;

const SSI_ORGAN_SPACE_SITES = [
  "Osteomyelitis",
  "Breast abscess or mastitis",
  "Myocarditis or pericarditis",
  "Disc space",
  "Ear, mastoid",
  "Endocarditis",
  "GI tract",
  "Intraabdominal, not specified",
  "Intracranial, brain abscess or dura",
  "Meningitis or ventriculitis",
  "Oral cavity (mouth, tongue or gums)",
  "Other infections of the male or female reproductive tract",
  "Periprosthetic Joint Infection",
  "Spinal abscess without meningitis",
  "Sinusitis",
  "Upper respiratory tract",
  "Urinary system infection",
  "Arterial or venous infection",
  "Vaginal cuff",
];

export function SSIForm({ data, onChange }: { data: PatientRecord; onChange: Updater }) {
  // วันที่ผ่าตัดหลายครั้ง (รองรับข้อมูลเก่าช่องเดียว)
  const surgeryDates = data.ssi_surgeryDates ?? (data.ssi_surgeryDate ? [data.ssi_surgeryDate] : []);
  const setSurgeryDates = (next: string[]) => onChange({ ssi_surgeryDates: next, ssi_surgery: next.length > 0 });

  const windowDays = ssiWindowDays(data.ssi_procedure);
  // ระยะที่ใกล้สุด: เลือกการผ่าตัดที่ทำให้วันมีอาการอยู่ในช่วง (หรือครั้งล่าสุดก่อนมีอาการ)
  const gaps = surgeryDates.map((d) => daysBetween(d, data.ssi_signDate)).filter((g): g is number => g !== null && g >= 0);
  const gap = gaps.length ? Math.min(...gaps) : null;
  const inWindow = gap !== null ? gap <= windowDays : null;

  return (
    <SiteCard title="10.4 การติดเชื้อตำแหน่งผ่าตัด" emoji="🩹" color="bg-lemon text-lemon-foreground">
      {/* 10.4.1 surgery dates (multiple) */}
      <Sub title="10.4.1 ผู้ป่วยได้รับการผ่าตัด — วันที่ผ่าตัด">
        {surgeryDates.length === 0 && (
          <div className="text-xs text-muted-foreground">ยังไม่ได้เพิ่มวันที่ผ่าตัด</div>
        )}
        {surgeryDates.map((d, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <DateField label={`วันที่ผ่าตัด ครั้งที่ ${i + 1} (ว/ด/ป)`} value={d}
                onChange={(iso) => setSurgeryDates(surgeryDates.map((x, j) => (j === i ? iso : x)))} />
            </div>
            <button type="button" aria-label="ลบ"
              onClick={() => setSurgeryDates(surgeryDates.filter((_, j) => j !== i))}
              className="mb-0.5 px-2.5 py-2 rounded-xl text-pink-foreground hover:bg-pink/20 transition-colors">✕</button>
          </div>
        ))}
        <button type="button"
          onClick={() => setSurgeryDates([...surgeryDates, ""])}
          className="text-sm font-semibold text-primary px-3 py-1.5 rounded-xl bg-sky/30 hover:bg-sky/50 transition-colors">
          + เพิ่มวันที่ผ่าตัด ครั้งที่ {surgeryDates.length + 1}
        </button>
      </Sub>

      {/* 10.4.3 procedure type (30 / 90-day surveillance) */}
      <Sub title="10.4.3 ชนิดการผ่าตัด">
        <select
          value={data.ssi_procedure ?? ""}
          onChange={(e) => onChange({ ssi_procedure: e.target.value })}
          className={cn("w-full px-3 py-2 rounded-xl border border-border bg-white/80 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring", !data.ssi_procedure && "text-muted-foreground/60")}>
          <option value="">เลือกชนิดการผ่าตัด</option>
          <optgroup label="เฝ้าระวัง 30 วัน (30-day surveillance)">
            {SSI_PROCEDURES_30.map((p) => <option key={p} value={p} className="text-foreground">{p}</option>)}
          </optgroup>
          <optgroup label="เฝ้าระวัง 90 วัน (90-day surveillance)">
            {SSI_PROCEDURES_90.map((p) => <option key={p} value={p} className="text-foreground">{p}</option>)}
          </optgroup>
        </select>
        {data.ssi_procedure && (
          <div className="text-xs text-muted-foreground mt-1">ช่วงเฝ้าระวัง: <span className="font-semibold text-foreground">{windowDays} วัน</span></div>
        )}
      </Sub>

      {/* วันที่เริ่มมีอาการ (ใช้คำนวณ window อัตโนมัติ) */}
      <Sub title="วันที่เริ่มมีอาการแสดงการติดเชื้อ">
        <DateField label="วันที่เริ่มมีอาการแสดง (ว/ด/ป)" value={data.ssi_signDate} onChange={(iso) => onChange({ ssi_signDate: iso })} />
        {gap !== null && (
          <div className={cn("text-xs font-semibold rounded-xl px-3 py-2",
            inWindow ? "bg-lemon/40 text-lemon-foreground" : "bg-muted text-muted-foreground")}>
            {gap < 0
              ? "⚠️ วันที่มีอาการก่อนวันผ่าตัด — โปรดตรวจสอบวันที่"
              : `ห่างจากวันผ่าตัด ${gap} วัน · ${inWindow ? `อยู่ในช่วงเฝ้าระวัง (≤ ${windowDays} วัน)` : `เกินช่วงเฝ้าระวัง (> ${windowDays} วัน)`}`}
          </div>
        )}
      </Sub>

      {/* 10.4.4 SSI type */}
      <Sub title="10.4.4 ประเภทการติดเชื้อที่ตำแหน่งผ่าตัด (SSI Type)">
        <Radio
          checked={data.ssi_type === "superficial"}
          label="Superficial Incisional SSI — ติดเชื้อที่ผิวหนังหรือเนื้อเยื่อใต้ผิวหนัง"
          onChange={() => onChange({ ssi_type: "superficial", ssi_organ_space_site: undefined, ssi_os_criteria: undefined, ssi_os_criterion4: undefined })}
        />
        {data.ssi_type === "superficial" && (
          <div className="ml-6 mt-2 space-y-1">
            {[
              "3.1 มีหนองออกมาจากแผลผ่าตัด",
              "3.2 แยกเชื้อได้จากของเหลวหรือเนื้อเยื่อจากแผลผ่าตัดที่เก็บโดยวิธี Aseptic technique",
              "3.3 แพทย์ให้เปิดปากแผลโดยไม่ได้เพาะเชื้อ และผู้ป่วยมีอาการอย่างน้อย 1 อย่าง (ปวด/กดเจ็บ, บวม, แดง, ร้อน)",
              "3.4 แพทย์ที่ดูแลผู้ป่วยเป็นผู้ให้การวินิจฉัย SSI",
            ].map((label, i) => (
              <Check
                key={i}
                checked={!!(data.ssi_sup_criteria ?? []).includes(i + 1)}
                label={label}
                onChange={() => onChange({ ssi_sup_criteria: toggle(data.ssi_sup_criteria ?? [], i + 1) })}
              />
            ))}
          </div>
        )}
        <Radio
          checked={data.ssi_type === "deep"}
          label="Deep Incisional SSI — ติดเชื้อชั้นลึก (fascial layer / muscle)"
          onChange={() => onChange({ ssi_type: "deep", ssi_organ_space_site: undefined, ssi_os_criteria: undefined, ssi_os_criterion4: undefined, ssi_sup_criteria: undefined })}
        />
        {data.ssi_type === "deep" && (
          <div className="ml-6 mt-2 space-y-1">
            {[
              "3.1 มีหนองไหลจากชั้นใต้ผิวหนังบริเวณผ่าตัด (แต่ไม่ใช่จากอวัยวะ/ช่องโพรง)",
              "3.2 แผลแยกเองหรือแพทย์เปิดแผล (ไม่ได้เพาะเชื้อ หรือเพาะแล้วไม่พบเชื้อก่อโรค) และผู้ป่วยมีไข้ > 38°C หรือปวด/กดเจ็บบริเวณแผล",
              "3.3 พบฝี (Abscess) หรือหลักฐานการติดเชื้อ จากการตรวจโดยตรง / ผ่าตัดใหม่ / ตรวจเนื้อเยื่อ / ตรวจทางรังสีวิทยา",
            ].map((label, i) => (
              <Check
                key={i}
                checked={!!(data.ssi_deep_criteria ?? []).includes(i + 1)}
                label={label}
                onChange={() => onChange({ ssi_deep_criteria: toggle(data.ssi_deep_criteria ?? [], i + 1) })}
              />
            ))}
          </div>
        )}
        <Radio
          checked={data.ssi_type === "organ_space"}
          label="Organ/Space SSI — การติดเชื้อในอวัยวะหรือช่องโพรงภายในร่างกาย"
          onChange={() => onChange({ ssi_type: "organ_space", ssi_sup_criteria: undefined, ssi_deep_criteria: undefined })}
        />
        {data.ssi_type === "organ_space" && (
          <div className="ml-6 mt-2 space-y-2">
            {/* เกณฑ์ข้อ 3 checkboxes */}
            <div className="space-y-1">
              {[
                "3.1 มีหนองออกจากท่อระบายที่ใส่ไว้ภายในอวัยวะหรือช่องโพรงในร่างกาย",
                "3.2 แยกเชื้อได้จากของเหลวหรือเนื้อเยื่อจากอวัยวะหรือช่องโพรงในร่างกาย",
                "3.3 พบฝี (Abscess) หรือหลักฐานการติดเชื้อ จากการตรวจโดยตรง / ผ่าตัดใหม่ / ตรวจเนื้อเยื่อ / ตรวจทางรังสีวิทยา",
              ].map((label, i) => (
                <Check
                  key={i}
                  checked={!!(data.ssi_os_criteria ?? []).includes(i + 1)}
                  label={label}
                  onChange={() => onChange({ ssi_os_criteria: toggle(data.ssi_os_criteria ?? [], i + 1) })}
                />
              ))}
            </div>
            {/* เกณฑ์ข้อ 4 */}
            <Check
              checked={!!data.ssi_os_criterion4}
              label="4. มีลักษณะเข้าเกณฑ์การวินิจฉัยการติดเชื้อในระบบอวัยวะ/ตำแหน่ง Site ที่เลือก อย่างน้อย 1 ข้อ"
              onChange={() => onChange({ ssi_os_criterion4: !data.ssi_os_criterion4 })}
            />
            {/* ระบุตำแหน่ง */}
            <div>
              <label className="block text-xs font-semibold text-foreground/70 mb-1">ระบุตำแหน่ง Organ/Space Site</label>
              <select
                value={data.ssi_organ_space_site ?? ""}
                onChange={(e) => onChange({ ssi_organ_space_site: e.target.value || undefined })}
                className={cn(
                  "w-full px-3 py-2 rounded-xl border border-border bg-white/80 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring",
                  !data.ssi_organ_space_site && "text-muted-foreground/60"
                )}>
                <option value="">เลือกตำแหน่ง...</option>
                {SSI_ORGAN_SPACE_SITES.map((s) => (
                  <option key={s} value={s} className="text-foreground">{s}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Sub>

      {/* 10.4.5 wound class */}
      <Sub title="10.4.5 ประเภทแผลผ่าตัด">
        {SSI_WOUND.map((w) => (
          <Radio key={w.key} checked={data.ssi_wound_class === w.key} label={w.label}
            onChange={() => onChange({ ssi_wound_class: w.key })} />
        ))}
      </Sub>
    </SiteCard>
  );
}

const GAST_SYM = [
  "1. คลื่นไส้",
  "2. ปวดท้อง หรืออาเจียน",
  "3. ไข้ อุณหภูมิ > 38.0 องศาเซลเซียส",
  "4. ปวดศีรษะ",
];
const GAST_EVIDENCE = [
  "2.1 เพาะเชื้อก่อโรคได้จากตัวอย่างที่เก็บโดย Rectal swab หรือจากของเหลว/สิ่งอื่น",
  "2.2 พบเชื้อก่อโรคจากการตรวจด้วยกล้องจุลทรรศน์",
  "2.3 ตรวจ IgM antibody ถึงระดับวินิจฉัย 1 ครั้ง หรือ IgG antibody เพิ่มขึ้น 4 เท่าในการตรวจครั้งที่สอง",
];
const CDIFF_CRIT = [
  "1. ตรวจพบ Clostridium difficile toxin ในอุจจาระ",
  "2. ตรวจพบ Pseudomembranous colitis โดยลักษณะทางกายวิภาค หรือทางพยาธิวิทยา",
];
const NEC_CLIN = [
  "1. ท้องอืด",
  "2. อาเจียน",
  "3. ท้องเสีย",
  "4. มีเลือดออก หรือตรวจพบ occult blood",
];
const NEC_XRAY = [
  "1. Pneumatosis intestinalis",
  "2. Portal venous gas (hepatobiliary gas)",
  "3. Pneumoperitoneum",
  "4. ภาพรังสีไม่ชัดเจน แต่แพทย์วินิจฉัยและรักษาแบบ NEC",
];
const NEC_SURG = [
  "2.1 Extensive bowel necrosis ความยาวอย่างน้อย 2 เซนติเมตร",
  "2.2 Pneumatosis intestinalis",
];
const GI_TRACT_CRIT = [
  "1. มีหลักฐานทางรังสีวิทยาหรือพยาธิวิทยาของการติดเชื้อในระบบทางเดินอาหาร",
  "2. มีฝีหรือหลักฐานการติดเชื้อจากการตรวจโดยตรง / ผ่าตัด / ตรวจเนื้อเยื่อ / รังสีวิทยา",
  "3. พบเชื้อก่อโรคจากของเหลว/เนื้อเยื่อในระบบทางเดินอาหาร (เพาะเชื้อหรือวิธีอื่น)",
];

export function GIForm({ data, onChange }: { data: PatientRecord; onChange: Updater }) {
  const gi = data.gi_type;
  const symCount  = (data.gi_gast_symptoms ?? []).length;
  const evidCount = (data.gi_gast_evidence ?? []).length;

  return (
    <SiteCard title="10.5 การติดเชื้อระบบทางเดินอาหาร" emoji="🍽️" color="bg-mint text-mint-foreground">

      {/* Appendicitis */}
      <Sub title="การวินิจฉัย Appendicitis">
        <CheckButton checked={!!data.gi_appendicitis}
          label="แพทย์วินิจฉัย Appendicitis (สรุปผล: ไม่มีการติดเชื้อระบบทางเดินอาหาร)"
          onChange={() => onChange({ gi_appendicitis: !data.gi_appendicitis })} />
      </Sub>

      {!data.gi_appendicitis && (<>

        {/* Type selector */}
        <Sub title="ประเภทการติดเชื้อ">
          <Radio checked={gi === "gastroenteritis"}
            label="Gastroenteritis (ไม่รวมการติดเชื้อ C. difficile)"
            onChange={() => onChange({ gi_type: "gastroenteritis" })} />
          <Radio checked={gi === "cdiff_pseudo"}
            label="การติดเชื้อ C. difficile หรือ Pseudomembranous colitis"
            onChange={() => onChange({ gi_type: "cdiff_pseudo" })} />
          <Radio checked={gi === "nec"}
            label="Necrotizing enterocolitis (NEC)"
            onChange={() => onChange({ gi_type: "nec" })} />
          <Radio checked={gi === "gi_tract"}
            label="การติดเชื้อระบบทางเดินอาหาร (ยกเว้น Gastroenteritis / Appendicitis / C. difficile)"
            onChange={() => onChange({ gi_type: "gi_tract" })} />
        </Sub>

        {/* ─── Gastroenteritis ─── */}
        {gi === "gastroenteritis" && (
          <Sub title="เกณฑ์การวินิจฉัย Gastroenteritis (≥1 ข้อ)">
            <Check
              checked={!!data.gi_gast_crit1}
              label="1. อุจจาระร่วง (อุจจาระเป็นน้ำ นานกว่า 12 ชั่วโมง) โดยไม่มีสาเหตุอื่น"
              onChange={() => onChange({ gi_gast_crit1: !data.gi_gast_crit1 })}
            />
            <div className="mt-2 pt-2 border-t border-border/40">
              <div className="text-xs font-semibold text-foreground/70 mb-1">
                2. มีอาการ ≥ 2 ข้อต่อไปนี้ {symCount >= 2 ? <span className="text-mint-foreground">✓ ({symCount} ข้อ)</span> : <span className="text-muted-foreground">({symCount}/4)</span>}
              </div>
              <div className="space-y-1 mb-3">
                {GAST_SYM.map((label, i) => (
                  <Check key={i}
                    checked={!!(data.gi_gast_symptoms ?? []).includes(i + 1)}
                    label={label}
                    onChange={() => onChange({ gi_gast_symptoms: toggle(data.gi_gast_symptoms ?? [], i + 1) })} />
                ))}
              </div>
              <div className="text-xs font-semibold text-foreground/70 mb-1">
                AND มีหลักฐานอย่างน้อย 1 ข้อต่อไปนี้ {evidCount >= 1 ? <span className="text-mint-foreground">✓</span> : ""}
              </div>
              <div className="space-y-1">
                {GAST_EVIDENCE.map((label, i) => (
                  <Check key={i}
                    checked={!!(data.gi_gast_evidence ?? []).includes(i + 1)}
                    label={label}
                    onChange={() => onChange({ gi_gast_evidence: toggle(data.gi_gast_evidence ?? [], i + 1) })} />
                ))}
              </div>
            </div>
          </Sub>
        )}

        {/* ─── C. difficile / Pseudomembranous colitis ─── */}
        {gi === "cdiff_pseudo" && (
          <Sub title="เกณฑ์การวินิจฉัย C. difficile / Pseudomembranous colitis (≥1 ข้อ)">
            {CDIFF_CRIT.map((label, i) => (
              <Check key={i}
                checked={!!(data.gi_cdiff_criteria ?? []).includes(i + 1)}
                label={label}
                onChange={() => onChange({ gi_cdiff_criteria: toggle(data.gi_cdiff_criteria ?? [], i + 1) })} />
            ))}
          </Sub>
        )}

        {/* ─── NEC ─── */}
        {gi === "nec" && (
          <Sub title="เกณฑ์การวินิจฉัย Necrotizing Enterocolitis (NEC)">
            <div className="text-xs font-semibold text-foreground/70 mb-1">เกณฑ์ข้อ 1 — ลักษณะทางคลินิก (≥1 ข้อ)</div>
            <div className="space-y-1 mb-3">
              {NEC_CLIN.map((label, i) => (
                <Check key={i}
                  checked={!!(data.gi_nec_clinical ?? []).includes(i + 1)}
                  label={label}
                  onChange={() => onChange({ gi_nec_clinical: toggle(data.gi_nec_clinical ?? [], i + 1) })} />
              ))}
            </div>
            <div className="text-xs font-semibold text-foreground/70 mb-1">เกณฑ์ข้อ 1 — ลักษณะทางภาพรังสี (≥1 ข้อ)</div>
            <div className="space-y-1 mb-3">
              {NEC_XRAY.map((label, i) => (
                <Check key={i}
                  checked={!!(data.gi_nec_xray_items ?? []).includes(i + 1)}
                  label={label}
                  onChange={() => onChange({ gi_nec_xray_items: toggle(data.gi_nec_xray_items ?? [], i + 1) })} />
              ))}
            </div>
            <div className="pt-2 border-t border-border/40">
              <div className="text-xs font-semibold text-foreground/70 mb-1">เกณฑ์ข้อ 2 — Surgical NEC (≥1 ข้อ)</div>
              <div className="space-y-1">
                {NEC_SURG.map((label, i) => (
                  <Check key={i}
                    checked={!!(data.gi_nec_surgical_items ?? []).includes(i + 1)}
                    label={label}
                    onChange={() => onChange({ gi_nec_surgical_items: toggle(data.gi_nec_surgical_items ?? [], i + 1) })} />
                ))}
              </div>
            </div>
          </Sub>
        )}

        {/* ─── GI tract infection ─── */}
        {gi === "gi_tract" && (
          <Sub title="เกณฑ์การวินิจฉัยการติดเชื้อระบบทางเดินอาหาร (≥1 ข้อ)">
            {GI_TRACT_CRIT.map((label, i) => (
              <Check key={i}
                checked={!!(data.gi_tract_criteria ?? []).includes(i + 1)}
                label={label}
                onChange={() => onChange({ gi_tract_criteria: toggle(data.gi_tract_criteria ?? [], i + 1) })} />
            ))}
          </Sub>
        )}

      </>)}
    </SiteCard>
  );
}