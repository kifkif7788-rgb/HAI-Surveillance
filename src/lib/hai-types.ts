export type Sex = "male" | "female";

export interface PatientRecord {
  id: string;
  hn: string;
  an: string;
  firstName: string;
  lastName: string;
  age: number | "";
  sex: Sex | "";
  bed: string;
  ward: string;
  admitDate: string; // yyyy-mm-dd
  doeDate: string;
  firstDx: string;  // การวินิจฉัยแรกรับ
  lastDx: string;   // การวินิจฉัยสุดท้าย
  organismsBySite?: Record<string, string[]>; // เชื้อก่อโรคแยกตามตำแหน่งติดเชื้อ (เมื่อผลเป็น HAI)
  mdroBySite?: Record<string, string[]>;       // เชื้อดื้อยา (MDRO) แยกตามตำแหน่งติดเชื้อ
  antibioticCount: number | ""; // จำนวนยาฆ่าเชื้อที่ได้รับตลอดการแอดมิท
  outcome?: "home" | "admit" | "deceased"; // ผลการรักษา
  sites: string[]; // "10.1" etc
  // 10.1 respiratory
  resp_intubated?: boolean | null;
  resp_xray?: ("infiltration" | "cavitation" | "consolidation" | "notmatch")[];
  resp_noxray?: boolean;
  resp_symptoms?: number[]; // 1..17 selected
  // 10.2 UTI
  uti_catheter?: boolean | null;
  uti_catheter_ge2?: boolean; // ใส่สายสวนปัสสาวะ ≥ 2 วัน (เกณฑ์ CAUTI)
  uti_culture?: "negative" | "positive" | "multi"; // ผล Urine C/S: ไม่พบเชื้อ / พบ ≥10⁵ ≤2ชนิด / พบ >2 ชนิด
  uti_culture_positive?: boolean;
  uti_candida?: boolean;
  uti_symptoms?: number[];
  // 10.3 BSI
  bsi_line?: "central_ge2" | "none";               // 10.3.1 สายสวนกลาง/สะดือ > 2 วัน / 10.3.2 ไม่มี
  bsi_hc_result?: "negative" | "positive";          // 10.3.3 ไม่พบเชื้อ / 10.3.4 พบเชื้อ
  bsi_org_count?: "gt2" | "le2";                    // > 2 เชื้อ / ≤ 2 เชื้อ
  bsi_org_type?: "pathogen" | "flora";              // 10.3.4.1 เชื้อก่อโรค / 10.3.4.2 normal flora
  bsi_pathogen_source?: "central" | "peripheral";   // 10.3.4.1 แหล่งที่พบเชื้อก่อโรค
  bsi_confirm?: "ge2_consec" | "ge2_sameday" | "ge2_within2" | "1x_consec" | "1x_sameday"; // 10.3.4.3
  bsi_symptoms?: number[];
  // 10.4 SSI
  ssi_surgery?: boolean | null;
  ssi_surgeryDate?: string;     // (เดิม) วันที่ผ่าตัดครั้งเดียว — คงไว้สำหรับข้อมูลเก่า
  ssi_surgeryDates?: string[];  // 10.4.1 วันที่ผ่าตัด หลายครั้ง (ครั้งที่ 1,2,3,...)
  ssi_procedure?: string;       // 10.4.3 ชนิดการผ่าตัด
  ssi_wound_class?: "CW" | "CCW" | "CoW" | "DW"; // 10.4.5 ประเภทแผลผ่าตัด
  ssi_signDate?: string;     // 10.4.2 วันที่มีอาการแสดงการติดเชื้อ
  ssi_in_window?: boolean;   // fallback (กรณีไม่ได้กรอกวันที่)
  ssi_symptoms?: number[];
  // 10.5 GI
  gi_cdiff_status?: "no" | "yes";          // 10.5.1 ไม่มี / 10.5.2 มี C. difficile
  gi_pseudo?: boolean;                       // 10.5.3 Pseudomembranous colitis
  gi_appendicitis?: boolean;                // 10.5.4 appendicitis (สรุป: ไม่ติดเชื้อ)
  gi_evidence?: "anatomical" | "clinical" | "none"; // 10.5.5.1 / 10.5.5.2 / 10.5.5.3
  gi_clinical_symptoms?: number[];          // 10.5.5.2 อาการที่เข้ากับการติดเชื้อ (≥ 2)
  gi_pathogen?: number[];                    // 10.5.5.4 ตรวจพบเชื้อ (≥ 1)
  // เส้นทางจาก 10.5.5.3 (ไม่พบทั้ง 2 ข้อ)
  gi_diarrhea_acute?: boolean;              // 10.5.5.5 อุจจาระร่วงเฉียบพลัน > 12 ชม.
  // 10.5.6 NEC (อายุ < 1 ปี — ต้องมีทั้ง 10.5.6.1 และ 10.5.6.2)
  gi_nec_clinical?: number[];               // 10.5.6.1 ลักษณะทางคลินิก (≥ 1)
  gi_nec_xray?: "has" | "none";             // 10.5.6.2 มีภาพรังสี / 10.5.6.3 ไม่มี
  gi_nec_xray_items?: number[];             // 10.5.6.2 ลักษณะภาพทางรังสี (≥ 1)
  gi_nec_surgical?: "found" | "notfound";   // 10.5.7 พบระหว่างผ่าตัด / 10.5.8 ไม่พบ
  gi_nec_surgical_items?: number[];         // 10.5.7 สิ่งตรวจพบระหว่างผ่าตัด
  createdAt: string;
  status: "draft" | "saved";
  result?: string;
}

// ── ค่าตั้งต้น (seed) ของหอผู้ป่วย/แผนก ────────────────────────────────────
// รายการจริงถูกจัดการผ่าน ward-store (sync กับ Supabase) — ค่าด้านล่างใช้ seed
// ครั้งแรก และเป็น fallback เมื่อยังไม่มีข้อมูลใน cache/Supabase
export const DEFAULT_WARDS = [
  "ส.5เอ","ส.5บี","ส.6เอ","SICU","NSICU","ส.7บี","ส.8เอ",
  "ส.8บี","NIMCU 9","NIMCU 10","NICU","PICU","PCICU",
  "ม.6ก ortho","ม.6ก observe","ม.6ข","ม.7ก","ม.7ข","ม.8ก","ม.8ข","ม.9ก","ม.9ข","ม.10ก","ม.10ข",
];

// กลุ่มแผนก (Department) — ใช้จัดกลุ่มหอผู้ป่วยในรายงาน/Dashboard
export const DEFAULT_DEPARTMENTS: { name: string; wards: string[] }[] = [
  { name: "ตา-โสต-ศอ-นาสิก", wards: ["ส.5บี"] },
  { name: "กุมารเวชกรรม", wards: [
    "ส.8เอ","NIMCU 9","NIMCU 10","NICU","PICU","ม.6ก observe","ม.7ก","ม.7ข",
    "ม.8ก","ม.8ข","ม.9ก","ม.9ข","ส.8บี","ม.10ก","ม.10ข",
  ] },
  { name: "ศัลยกรรม", wards: ["SICU","NSICU","PCICU","ส.5เอ","ม.6ก ortho","ม.6ข","ส.6เอ","ส.7บี"] },
];

/** หอผู้ป่วยวิกฤต (ICU) — ค่าตั้งต้น */
export const DEFAULT_ICU_WARDS = ["SICU", "NSICU", "NICU", "PICU", "PCICU"];

export const SITES = [
  { id: "10.1", label: "ระบบทางเดินหายใจ", icon: "🫁", color: "sky" },
  { id: "10.2", label: "ระบบทางเดินปัสสาวะ", icon: "💧", color: "lavender" },
  { id: "10.3", label: "การติดเชื้อกระแสเลือด", icon: "🩸", color: "pink" },
  { id: "10.4", label: "การติดเชื้อแผลผ่าตัด", icon: "🩹", color: "lemon" },
  { id: "10.5", label: "ระบบทางเดินอาหาร", icon: "🍽️", color: "mint" },
] as const;

// 10.4.3 ชนิดการผ่าตัด แบ่งตามช่วงเฝ้าระวัง (surveillance window)
export const SSI_PROCEDURES_30 = [
  "Abdominal aortic aneurysm repair", "Abdominal hysterectomy", "Appendix surgery",
  "Bile duct, liver or pancreatic surgery", "Carotid endarterectomy", "Cesarean section",
  "Colon surgery", "Exploratory Laparotomy", "Gastric surgery", "Gallbladder surgery",
  "Heart transplant", "Kidney surgery", "Kidney transplant", "Laminectomy", "Limb amputation",
  "Liver transplant", "Neck surgery", "Ovarian surgery", "Parathyroid surgery", "Prostate surgery",
  "Rectal surgery", "Small bowel surgery", "Spleen surgery", "Shunt for dialysis",
  "Thoracic surgery", "Thyroid and/or parathyroid surgery", "Vaginal hysterectomy",
];

export const SSI_PROCEDURES_90 = [
  "Breast surgery", "Cardiac surgery",
  "Coronary artery bypass graft with both chest and donor site incisions",
  "Coronary artery bypass graft with chest incisions only", "Craniotomy", "Spinal fusion",
  "Open reduction of fracture", "Herniorrhaphy", "Hip prosthesis", "Knee prosthesis",
  "Pacemaker surgery", "Peripheral vascular bypass surgery", "Ventricular shunt",
];

/** Surveillance window (days) for an SSI procedure; 90 for listed procedures, otherwise 30. */
export function ssiWindowDays(procedure?: string): 30 | 90 {
  return procedure && SSI_PROCEDURES_90.includes(procedure) ? 90 : 30;
}