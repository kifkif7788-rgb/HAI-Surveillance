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
  uti_culture?: "negative" | "positive" | "multi" | "candida"; // ผล Urine C/S: ไม่พบเชื้อ / พบ ≥10⁵ ≤2ชนิด / พบ >2 ชนิด / พบ Candida
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
  ssi_type?: "superficial" | "deep" | "organ_space"; // 10.4.4 ประเภท SSI
  ssi_organ_space_site?: string;                      // 10.4.4 ตำแหน่ง Organ/Space SSI
  ssi_sup_criteria?: number[];                        // 10.4.4 เกณฑ์ Superficial SSI ข้อ 3.1/3.2/3.4 (≥1)
  ssi_sup_crit33_opened?: boolean;                    // 10.4.4 เกณฑ์ 3.3: แพทย์เปิดปากแผลโดยไม่เพาะเชื้อ
  ssi_sup_crit33_sym?: number[];                      // 10.4.4 เกณฑ์ 3.3 อาการ ≥1: 1=ปวด/กดเจ็บ, 2=บวม, 3=แดง, 4=ร้อน
  ssi_deep_criteria?: number[];                       // 10.4.4 เกณฑ์ Deep SSI ข้อ 3.1/3.3 (≥1)
  ssi_deep_crit32_opened?: boolean;                   // 10.4.4 เกณฑ์ 3.2: แผลแยก/แพทย์เปิดแผล (ไม่เพาะ/เพาะไม่พบ)
  ssi_deep_crit32_sym?: number[];                     // 10.4.4 เกณฑ์ 3.2 อาการ ≥1: 1=ไข้>38°C, 2=ปวด/กดเจ็บ
  ssi_deep_crit33_found?: boolean;                    // 10.4.4 เกณฑ์ 3.3: พบฝี/หลักฐานการติดเชื้อ
  ssi_deep_crit33_methods?: number[];                 // 10.4.4 เกณฑ์ 3.3 วิธีตรวจ ≥1: 1=ตรวจโดยตรง, 2=ผ่าตัดใหม่, 3=ตรวจเนื้อเยื่อ, 4=รังสีวิทยา
  ssi_os_criteria?: number[];                         // 10.4.4 เกณฑ์ O/S SSI ข้อ 3.1/3.2/3.3 (≥1)
  ssi_os_criterion4?: boolean;                        // 10.4.4 เกณฑ์ O/S SSI ข้อ 4 (เข้าเกณฑ์ site)
  // 10.5 GI (new structured fields)
  gi_type?: "gastroenteritis" | "cdiff_pseudo" | "nec" | "gi_tract"; // ประเภท GI
  gi_appendicitis?: boolean;                // appendicitis → ไม่ติดเชื้อ GI
  // Gastroenteritis
  gi_gast_crit1?: boolean;                  // เกณฑ์ 1: อุจจาระร่วง ≥12h
  gi_gast_symptoms?: number[];              // เกณฑ์ 2 อาการ ≥2: 1=คลื่นไส้, 2=ปวดท้อง/อาเจียน, 3=ไข้>38°C, 4=ปวดศีรษะ
  gi_gast_evidence?: number[];              // เกณฑ์ 2 หลักฐาน ≥1: 1=เพาะเชื้อ, 2=กล้อง, 3=antibody
  // C. difficile / Pseudomembranous colitis
  gi_cdiff_criteria?: number[];             // 1=ตรวจพบ toxin, 2=ตรวจพบ pseudomembranous
  // NEC
  gi_nec_clinical?: number[];               // คลินิก ≥1: 1=ท้องอืด, 2=อาเจียน, 3=ท้องเสีย, 4=เลือดออก/occult blood
  gi_nec_xray_items?: number[];             // ภาพรังสี ≥1: 1=pneumatosis, 2=portal venous gas, 3=pneumoperitoneum, 4=แพทย์วินิจฉัย NEC
  gi_nec_surgical_items?: number[];         // Surgical NEC ≥1: 1=extensive necrosis ≥2cm, 2=pneumatosis intestinalis
  // GI tract infection
  gi_tract_criteria?: number[];             // ≥1: 1=รังสี/พยาธิ, 2=ฝี/หลักฐาน, 3=เพาะเชื้อ/กล้อง
  // Legacy fields (backward compat)
  gi_cdiff_status?: "no" | "yes";
  gi_pseudo?: boolean;
  gi_evidence?: "anatomical" | "clinical" | "none";
  gi_clinical_symptoms?: number[];
  gi_pathogen?: number[];
  gi_diarrhea_acute?: boolean;
  gi_nec_xray?: "has" | "none";
  gi_nec_surgical?: "found" | "notfound";
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