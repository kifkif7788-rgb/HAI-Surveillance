import { useEffect, useState, useCallback } from "react";
import type { PatientRecord } from "./hai-types";
import { sbAll, sbUpsert, sbDelete, sbReplaceAll } from "./supabase";

const KEY = "hai-records-v1";
const DRAFT_KEY = "hai-draft-v1";

function read(): PatientRecord[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(r: PatientRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(r));
  window.dispatchEvent(new Event("hai-records-changed"));
}

/** Pull records from Supabase into the local cache (call on startup). */
export async function pullRecords() {
  const rows = await sbAll<PatientRecord>("records");
  if (rows) write(rows);
}

export function emptyRecord(): PatientRecord {
  return {
    id: crypto.randomUUID(), hn: "", an: "", firstName: "", lastName: "", age: "", sex: "", bed: "",
    ward: "", admitDate: "", doeDate: "", firstDx: "", lastDx: "", antibioticCount: "", outcome: undefined, organismsBySite: {}, mdroBySite: {}, sites: [],
    resp_xray: [], resp_symptoms: [], uti_symptoms: [], bsi_symptoms: [],
    ssi_symptoms: [], gi_clinical_symptoms: [], gi_pathogen: [],
    createdAt: new Date().toISOString(), status: "draft",
  };
}

export function useRecords() {
  const [records, setRecords] = useState<PatientRecord[]>(() => read());
  useEffect(() => {
    const h = () => setRecords(read());
    window.addEventListener("hai-records-changed", h);
    return () => window.removeEventListener("hai-records-changed", h);
  }, []);
  return records;
}

/**
 * Merge incoming record into existing one (same HN+AN, different id).
 * Rules:
 *   - arrays  → union (deduplicated)
 *   - objects (organismsBySite / mdroBySite) → merge keys; each site array = union
 *   - scalars → use incoming if non-empty, else keep existing
 *   - id / createdAt → keep existing
 */
function mergeRecords(existing: PatientRecord, incoming: PatientRecord): PatientRecord {
  const mergeArr = <T>(a: T[] = [], b: T[] = []): T[] => [...new Set([...a, ...b])];
  const mergeObjArr = (
    a: Record<string, string[]> = {},
    b: Record<string, string[]> = {},
  ): Record<string, string[]> => {
    const result: Record<string, string[]> = { ...a };
    Object.entries(b).forEach(([k, v]) => {
      result[k] = [...new Set([...(result[k] ?? []), ...v])];
    });
    return result;
  };
  const pick = <T>(a: T, b: T): T => (b !== undefined && b !== null && b !== "" ? b : a);

  return {
    ...existing,
    // demographics — prefer incoming if filled
    firstName:    pick(existing.firstName, incoming.firstName),
    lastName:     pick(existing.lastName, incoming.lastName),
    age:          pick(existing.age, incoming.age),
    sex:          pick(existing.sex, incoming.sex),
    bed:          pick(existing.bed, incoming.bed),
    ward:         pick(existing.ward, incoming.ward),
    admitDate:    pick(existing.admitDate, incoming.admitDate),
    doeDate:      pick(existing.doeDate, incoming.doeDate),
    firstDx:      pick(existing.firstDx, incoming.firstDx),
    lastDx:       pick(existing.lastDx, incoming.lastDx),
    antibioticCount: pick(existing.antibioticCount, incoming.antibioticCount),
    outcome:      pick(existing.outcome, incoming.outcome),
    status:       incoming.status === "saved" ? "saved" : existing.status,
    result:       pick(existing.result, incoming.result),
    // infection sites → union
    sites: mergeArr(existing.sites, incoming.sites),
    // organisms/MDRO → merge per site
    organismsBySite: mergeObjArr(existing.organismsBySite, incoming.organismsBySite),
    mdroBySite:      mergeObjArr(existing.mdroBySite, incoming.mdroBySite),
    // clinical arrays → union
    resp_xray:           mergeArr(existing.resp_xray, incoming.resp_xray),
    resp_symptoms:       mergeArr(existing.resp_symptoms, incoming.resp_symptoms),
    uti_symptoms:        mergeArr(existing.uti_symptoms, incoming.uti_symptoms),
    bsi_symptoms:        mergeArr(existing.bsi_symptoms, incoming.bsi_symptoms),
    ssi_symptoms:        mergeArr(existing.ssi_symptoms, incoming.ssi_symptoms),
    ssi_surgeryDates:    mergeArr(existing.ssi_surgeryDates, incoming.ssi_surgeryDates),
    gi_clinical_symptoms: mergeArr(existing.gi_clinical_symptoms, incoming.gi_clinical_symptoms),
    gi_pathogen:         mergeArr(existing.gi_pathogen, incoming.gi_pathogen),
    gi_nec_clinical:     mergeArr(existing.gi_nec_clinical, incoming.gi_nec_clinical),
    gi_nec_xray_items:   mergeArr(existing.gi_nec_xray_items, incoming.gi_nec_xray_items),
    gi_nec_surgical_items: mergeArr(existing.gi_nec_surgical_items, incoming.gi_nec_surgical_items),
    // clinical scalars → prefer incoming if set
    resp_intubated:      pick(existing.resp_intubated, incoming.resp_intubated),
    resp_noxray:         pick(existing.resp_noxray, incoming.resp_noxray),
    uti_catheter:        pick(existing.uti_catheter, incoming.uti_catheter),
    uti_catheter_ge2:    pick(existing.uti_catheter_ge2, incoming.uti_catheter_ge2),
    uti_culture:         pick(existing.uti_culture, incoming.uti_culture),
    uti_culture_positive: pick(existing.uti_culture_positive, incoming.uti_culture_positive),
    uti_candida:         pick(existing.uti_candida, incoming.uti_candida),
    bsi_line:            pick(existing.bsi_line, incoming.bsi_line),
    bsi_hc_result:       pick(existing.bsi_hc_result, incoming.bsi_hc_result),
    bsi_org_count:       pick(existing.bsi_org_count, incoming.bsi_org_count),
    bsi_org_type:        pick(existing.bsi_org_type, incoming.bsi_org_type),
    bsi_pathogen_source: pick(existing.bsi_pathogen_source, incoming.bsi_pathogen_source),
    bsi_confirm:         pick(existing.bsi_confirm, incoming.bsi_confirm),
    ssi_surgery:         pick(existing.ssi_surgery, incoming.ssi_surgery),
    ssi_surgeryDate:     pick(existing.ssi_surgeryDate, incoming.ssi_surgeryDate),
    ssi_procedure:       pick(existing.ssi_procedure, incoming.ssi_procedure),
    ssi_wound_class:     pick(existing.ssi_wound_class, incoming.ssi_wound_class),
    ssi_signDate:        pick(existing.ssi_signDate, incoming.ssi_signDate),
    ssi_in_window:       pick(existing.ssi_in_window, incoming.ssi_in_window),
    gi_cdiff_status:     pick(existing.gi_cdiff_status, incoming.gi_cdiff_status),
    gi_pseudo:           pick(existing.gi_pseudo, incoming.gi_pseudo),
    gi_appendicitis:     pick(existing.gi_appendicitis, incoming.gi_appendicitis),
    gi_evidence:         pick(existing.gi_evidence, incoming.gi_evidence),
    gi_diarrhea_acute:   pick(existing.gi_diarrhea_acute, incoming.gi_diarrhea_acute),
    gi_nec_xray:         pick(existing.gi_nec_xray, incoming.gi_nec_xray),
    gi_nec_surgical:     pick(existing.gi_nec_surgical, incoming.gi_nec_surgical),
  };
}

/** Save a record. If an existing record with the same HN+AN already exists,
 *  merge rather than duplicate. Returns whether a merge occurred. */
export function saveRecord(r: PatientRecord): { merged: boolean } {
  const all = read();
  const sameIdx = all.findIndex((x) => x.id === r.id);

  if (sameIdx >= 0) {
    // normal edit — same id
    all[sameIdx] = r;
    write(all);
    void sbUpsert("records", r);
    return { merged: false };
  }

  // check for duplicate HN+AN (case-insensitive trim)
  const hn = r.hn.trim().toLowerCase();
  const an = r.an.trim().toLowerCase();
  const dupIdx = hn && an
    ? all.findIndex((x) => x.hn.trim().toLowerCase() === hn && x.an.trim().toLowerCase() === an)
    : -1;

  if (dupIdx >= 0) {
    // merge into existing record
    const merged = mergeRecords(all[dupIdx], r);
    all[dupIdx] = merged;
    write(all);
    void sbUpsert("records", merged);
    return { merged: true };
  }

  all.push(r);
  write(all);
  void sbUpsert("records", r);
  return { merged: false };
}
export function deleteRecord(id: string) {
  write(read().filter((r) => r.id !== id));
  void sbDelete("records", id);
}

/** Backward-compatible ward renames (idempotent — safe to run on every load). */
export const WARD_RENAMES: Record<string, string> = {
  "ม.6ก": "ม.6ก observe",
  "ส.5ปี": "ส.5บี",
  "ส.7ปี": "ส.7บี",
  "ส.8ปี": "ส.8บี",
};

export function migrateWards() {
  const all = read();
  let changed = false;
  const next = all.map((r) => {
    const renamed = WARD_RENAMES[r.ward];
    if (renamed) { changed = true; return { ...r, ward: renamed }; }
    return r;
  });
  if (changed) { write(next); void sbReplaceAll("records", next); }
}
export function saveDraft(r: PatientRecord) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(r));
}
export function loadDraft(): PatientRecord | null {
  try { const s = localStorage.getItem(DRAFT_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

export function seedIfEmpty() {
  if (read().length > 0) return;
  const sample: PatientRecord[] = [
    { ...emptyRecord(), hn: "680001", an: "AN001", age: 2, sex: "male", bed: "12", ward: "PICU", admitDate: "2026-05-20", doeDate: "2026-05-25", firstDx: "ไข้สูง ไอ", sites: ["10.1"], resp_intubated: true, resp_xray: ["infiltration"], resp_symptoms: [1, 5, 10], status: "saved", result: "HAI / VAP" },
    { ...emptyRecord(), hn: "680002", an: "AN002", age: 5, sex: "female", bed: "5", ward: "ม.6ก observe", admitDate: "2026-05-28", doeDate: "2026-05-29", firstDx: "ปวดท้อง", sites: ["10.5"], gi_cdiff_status: "no", gi_evidence: "clinical", gi_clinical_symptoms: [1, 8], gi_pathogen: [1], status: "saved", result: "CI / GI" },
    { ...emptyRecord(), hn: "680003", an: "AN003", age: 0.5, sex: "female", bed: "3", ward: "NICU", admitDate: "2026-05-15", doeDate: "2026-05-22", firstDx: "Preterm", sites: ["10.3"], bsi_line: "central_ge2", bsi_hc_result: "positive", bsi_org_count: "le2", bsi_org_type: "pathogen", bsi_pathogen_source: "central", bsi_symptoms: [1, 2], status: "saved", result: "HAI / CLABSI" },
    { ...emptyRecord(), hn: "680004", an: "AN004", age: 8, sex: "male", bed: "7", ward: "ส.7ปี", admitDate: "2026-05-22", doeDate: "2026-05-27", firstDx: "post-op", sites: ["10.4"], ssi_surgery: true, ssi_in_window: true, ssi_symptoms: [1], status: "saved", result: "SSI" },
    { ...emptyRecord(), hn: "680005", an: "AN005", age: 3, sex: "female", bed: "9", ward: "ม.7ก", admitDate: "2026-05-26", doeDate: "2026-05-30", firstDx: "UTI?", sites: ["10.2"], uti_catheter: false, uti_culture_positive: true, uti_symptoms: [1, 2], status: "saved", result: "HAI / UTI" },
  ];
  write(sample);
  void sbReplaceAll("records", sample);
}

export function useNow() {
  const [, set] = useState(0);
  return useCallback(() => set((n) => n + 1), []);
}