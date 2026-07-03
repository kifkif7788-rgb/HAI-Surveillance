import { useEffect, useState } from "react";
import { sbAll, sbUpsert } from "./supabase";

export type SystemChoice = "paper" | "webapp" | "equal" | "";
export type ReworkChoice = "paper" | "webapp" | "unsure" | "";
export type RecommendChoice = "paper" | "webapp" | "hybrid" | "situational" | "";

export interface RatingPair {
  paper: number;   // 1–5 (0 = ยังไม่ได้ให้)
  webapp: number;  // 1–5 (0 = ยังไม่ได้ให้)
}

export type RatingKey =
  | "access" | "menuClarity" | "dataAccuracy" | "speed"
  | "alerts" | "reports" | "security" | "sharing" | "auditTrail" | "overall";

export interface SurveyEntry {
  id: string;
  submittedAt: string;

  // ผู้กรอก (จาก session)
  userId: string;
  userName: string;
  userRole: string;

  // ข้อมูลหัวแบบฟอร์ม
  ward: string;
  age: number | "";
  icwnYears: number | "";
  surveyDate: string;

  // ส่วนที่ 2 — ตารางเปรียบเทียบ (กระดาษ vs เว็บแอป) 10 หัวข้อ
  ratings: Record<RatingKey, RatingPair>;

  // ส่วนที่ 2 — คำถามเชิงเลือก/ข้อเท็จจริง
  systemPreference: SystemChoice;
  paperMinutesPerCase: number | "";
  webappMinutesPerCase: number | "";
  paperErrors: number | "";
  webappErrors: number | "";
  lessRework: ReworkChoice;
  recommendation: RecommendChoice;

  // ส่วนที่ 3 — ความคิดเห็น
  preferredSystem: "paper" | "webapp" | "";
  webappReason: string;
  paperReason: string;
  decisionFactors: string[];
  otherFactor: string;

  // ส่วนที่ 4 — ข้อเสนอแนะ
  webappSuggestions: string;
  paperProblems: string;
}

export const RATING_ITEMS: { key: RatingKey; label: string }[] = [
  { key: "access",       label: "ความสะดวกในการเข้าใช้งานระบบ" },
  { key: "menuClarity",  label: "ความชัดเจนของเมนูและฟังก์ชัน" },
  { key: "dataAccuracy", label: "ความถูกต้องของข้อมูลที่แสดง/บันทึก" },
  { key: "speed",        label: "ความเร็วในการประมวลผล/ค้นคืนข้อมูล" },
  { key: "alerts",       label: "ระบบแจ้งเตือน/เตือนความผิดพลาด (ถ้ามี)" },
  { key: "reports",      label: "การแสดงผลรายงาน/แดชบอร์ดเข้าใจง่าย" },
  { key: "security",     label: "ความปลอดภัย/การคุ้มครองข้อมูลผู้ป่วย" },
  { key: "sharing",      label: "ความสะดวกในการแชร์ข้อมูลให้หน่วยงานอื่น" },
  { key: "auditTrail",   label: "ความสามารถในการติดตาม/audit trail" },
  { key: "overall",      label: "ความพึงพอใจโดยรวม" },
];

export const DECISION_FACTORS = [
  "ความเร็วในการใช้งาน",
  "ความถูกต้องของข้อมูล",
  "งบประมาณ/ค่าใช้จ่าย",
  "ความปลอดภัยของข้อมูล",
  "ความคุ้นเคยของบุคลากร",
  "การบำรุงรักษา/ซัพพอร์ต",
  "ความสามารถในการรายงาน",
] as const;

export function emptyRatings(): Record<RatingKey, RatingPair> {
  const r = {} as Record<RatingKey, RatingPair>;
  for (const item of RATING_ITEMS) r[item.key] = { paper: 0, webapp: 0 };
  return r;
}

const KEY   = "hai-surveys-v1";
const EVENT = "hai-surveys-changed";

function readSurveys(): SurveyEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

function writeSurveys(entries: SurveyEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(EVENT));
}

export async function pullSurveys(): Promise<void> {
  const rows = await sbAll<SurveyEntry>("surveys");
  if (rows) writeSurveys(rows);
}

export async function submitSurvey(entry: Omit<SurveyEntry, "id" | "submittedAt">): Promise<void> {
  const full: SurveyEntry = {
    ...entry,
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
  };
  writeSurveys([...readSurveys(), full]);
  await sbUpsert("surveys", full);
}

export function useSurveys(): SurveyEntry[] {
  const [entries, setEntries] = useState<SurveyEntry[]>(() => readSurveys());
  useEffect(() => {
    const sync = () => setEntries(readSurveys());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return entries;
}
