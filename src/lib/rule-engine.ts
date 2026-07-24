import { ssiWindowDays, type PatientRecord } from "./hai-types";

export interface RuleResult {
  label: string;
  category: "HAI" | "CI" | "SSI" | "NONE" | "UNKNOWN";
  tone: "danger" | "warn" | "ok" | "info";
  detail: string;
}

export function daysBetween(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  if (isNaN(d1) || isNaN(d2)) return null;
  return Math.round((d2 - d1) / 86400000);
}

function symptomMin(p: PatientRecord, list: number[] | undefined): { ok: boolean; req: number } {
  const age = typeof p.age === "number" ? p.age : 99;
  const req = age < 1 || (age >= 1 && age <= 12) ? 3 : 1;
  return { ok: (list?.length ?? 0) >= req, req };
}

export function evaluate(p: PatientRecord): RuleResult[] {
  const results: RuleResult[] = [];
  const diff = daysBetween(p.admitDate, p.doeDate);
  const isHAI = diff !== null && diff >= 3;
  const isCI = diff !== null && diff < 3;

  // 10.1 Respiratory
  if (p.sites.includes("10.1")) {
    if (p.resp_noxray) {
      results.push({ label: "ไม่สามารถสรุปได้ (VAP/HAP/CAP)", category: "UNKNOWN", tone: "info", detail: "ไม่มีผล X-RAY ปอด" });
    } else {
      // นับเฉพาะ pattern ผิดปกติ (ข้อ 1-3); "notmatch" (ข้อ 4 ผลไม่ตรง) ไม่ถือว่า X-ray ผิดปกติ
      const hasXray = (p.resp_xray ?? []).some((x) => x !== "notmatch");
      const sym = symptomMin(p, p.resp_symptoms);
      if (hasXray && sym.ok) {
        if (isHAI && p.resp_intubated) results.push({ label: "HAI / VAP", category: "HAI", tone: "danger", detail: "ปอดอักเสบจากเครื่องช่วยหายใจ" });
        else if (isHAI && p.resp_intubated === false) results.push({ label: "HAI / HAP", category: "HAI", tone: "danger", detail: "ปอดอักเสบในโรงพยาบาล" });
        else if (isCI) results.push({ label: "CI / CAP", category: "CI", tone: "ok", detail: "ปอดอักเสบจากชุมชน" });
      } else {
        results.push({ label: "ไม่มีการติดเชื้อ VAP/HAP/CAP", category: "NONE", tone: "info", detail: `ต้องมีอาการ ≥ ${sym.req} ข้อ + X-RAY ผิดปกติ` });
      }
    }
  }

  // 10.2 UTI
  if (p.sites.includes("10.2")) {
    // ข้อ 3, 5, 7 ใช้ได้เฉพาะเมื่อถอดสายสวนแล้ว — ไม่นับเมื่อยังคาสายสวน (10.2.1)
    const catheterInPlace = p.uti_catheter === true;
    const countedUtiSym = (p.uti_symptoms ?? []).filter((n) => !(catheterInPlace && (n === 3 || n === 5 || n === 7)));
    const hasSym = countedUtiSym.length >= 1;
    // CAUTI ต้องใส่สายสวนปัสสาวะ > 2 วัน; สายสวน ≤ 2 วัน หรือไม่ใส่ → จัดเป็น UTI ทั่วไป
    const cauti = !!p.uti_catheter && p.uti_catheter_ge2 === true;
    if (p.uti_candida && hasSym) {
      // พบ Candida + มีอาการ ≥ 1 ข้อ → HAI/UTI (ไม่ขึ้นกับสายสวน)
      if (isHAI)     results.push({ label: "HAI / UTI", category: "HAI", tone: "danger", detail: "พบเชื้อ Candida ใน urine C/S" });
      else if (isCI) results.push({ label: "CI / UTI",  category: "CI",  tone: "ok",    detail: "พบเชื้อ Candida ใน urine C/S" });
      else           results.push({ label: "HAI / UTI", category: "HAI", tone: "warn",  detail: "พบเชื้อ Candida ใน urine C/S (กรุณากรอกวัน Admit/DOE)" });
    } else if (p.uti_candida && !hasSym) {
      results.push({ label: "ไม่มีการติดเชื้อ UTI", category: "NONE", tone: "info", detail: "พบ Candida แต่ยังไม่มีอาการ (ต้องเลือกอาการ ข้อ 10.2.4 อย่างน้อย 1 ข้อ)" });
    } else if (p.uti_culture_positive && hasSym) {
      if (cauti && isHAI) results.push({ label: "HAI / CAUTI", category: "HAI", tone: "danger", detail: "ติดเชื้อจากสายสวนปัสสาวะ (> 2 วัน)" });
      else if (!cauti && isHAI) results.push({ label: "HAI / UTI", category: "HAI", tone: "danger", detail: "ติดเชื้อระบบทางเดินปัสสาวะ" });
      else if (cauti && isCI) results.push({ label: "CI / CAUTI", category: "CI", tone: "ok", detail: "" });
      else if (isCI) results.push({ label: "CI / UTI", category: "CI", tone: "ok", detail: "" });
    } else {
      results.push({ label: "ไม่มีการติดเชื้อ UTI", category: "NONE", tone: "info", detail: "ไม่พบเชื้อหรืออาการไม่ครบ" });
    }
  }

  // 10.3 BSI
  if (p.sites.includes("10.3")) {
    // อายุ < 1 ปี นับเฉพาะข้อ 1,4,5,6; อื่นๆ นับทุกข้อ
    const bsiAge = typeof p.age === "number" ? p.age : 99;
    const hasSym = bsiAge < 1
      ? (p.bsi_symptoms ?? []).some((nn) => [1, 4, 5, 6].includes(nn))
      : (p.bsi_symptoms?.length ?? 0) >= 1;
    const none = (detail: string): RuleResult => ({ label: "ไม่มีการติดเชื้อในกระแสโลหิต", category: "NONE", tone: "info", detail });

    // confirmation of repeated cultures (10.3.4.3): options 1-3 confirm, 4-5 do not
    const confirmedRepeat = p.bsi_confirm === "ge2_consec" || p.bsi_confirm === "ge2_sameday" || p.bsi_confirm === "ge2_within2";

    // does the H/C tree confirm a true bloodstream organism?
    let organismConfirmed = false;
    let noneReason = "ผล H/C ไม่เข้าเกณฑ์";
    if (p.bsi_hc_result === "negative") {
      noneReason = "ผล H/C ไม่พบเชื้อ";
    } else if (p.bsi_hc_result === "positive") {
      if (p.bsi_org_count === "gt2") {
        noneReason = "พบเชื้อมากกว่า 2 ชนิด (ปนเปื้อน)";
      } else if (p.bsi_org_count === "le2") {
        if (p.bsi_org_type === "pathogen") {
          // เชื้อก่อโรคจาก central line → ยืนยันได้ทันที; จาก peripheral → ต้องพบซ้ำ
          if (p.bsi_pathogen_source === "central") organismConfirmed = true;
          else if (p.bsi_pathogen_source === "peripheral") { organismConfirmed = confirmedRepeat; if (!confirmedRepeat) noneReason = "พบเชื้อก่อโรค (peripheral) เพียงครั้งเดียว"; }
        } else if (p.bsi_org_type === "flora") {
          // normal flora ต้องพบซ้ำ ≥ 2 ครั้ง
          organismConfirmed = confirmedRepeat;
          if (!confirmedRepeat) noneReason = "พบ normal flora เพียงครั้งเดียว";
        }
      }
    }

    if (organismConfirmed && hasSym) {
      const clabsi = p.bsi_line === "central_ge2";

      // ตรวจสอบ Secondary BSI (2'BSI):
      // ถ้าเชื้อใน 10.3 (BSI) พบซ้ำใน site อื่น → BSI เป็นแบบ secondary (2'BSI)
      const bsiOrgs = (p.organismsBySite?.["10.3"] ?? []).map((o) => o.trim().toLowerCase()).filter(Boolean);
      const otherSiteOrgs = Object.entries(p.organismsBySite ?? {})
        .filter(([site]) => site !== "10.3")
        .flatMap(([, orgs]) => orgs.map((o) => o.trim().toLowerCase()));
      const isSecondary = bsiOrgs.length > 0 && bsiOrgs.some((o) => otherSiteOrgs.includes(o));

      if (isSecondary) {
        // 2'BSI — เชื้อในกระแสเลือดมาจากแหล่งติดเชื้ออื่น
        if (isHAI) results.push({ label: "HAI / 2'BSI", category: "HAI", tone: "danger", detail: "Secondary BSI — เชื้อในกระแสเลือดตรงกับเชื้อที่พบในตำแหน่งติดเชื้ออื่น" });
        else if (isCI) results.push({ label: "CI / 2'BSI", category: "CI", tone: "ok", detail: "Secondary BSI (community)" });
      } else if (isHAI && clabsi) {
        results.push({ label: "HAI / CLABSI", category: "HAI", tone: "danger", detail: "ติดเชื้อจากสายสวนหลอดเลือดดำส่วนกลาง (> 2 วัน)" });
      } else if (isHAI) {
        results.push({ label: "HAI / BSI", category: "HAI", tone: "danger", detail: "ติดเชื้อในกระแสเลือด" });
      } else if (isCI) {
        results.push({ label: "CI / BSI", category: "CI", tone: "ok", detail: "" });
      }
    } else if (organismConfirmed && !hasSym) {
      results.push(none("ยืนยันเชื้อแล้วแต่ไม่มีอาการแสดง"));
    } else {
      results.push(none(noneReason));
    }
  }

  // 10.4 SSI
  if (p.sites.includes("10.4")) {
    // ข้อ 6 = "ไม่มีลักษณะ..." ไม่นับเป็นอาการ; นับเฉพาะข้อ 1-5
    const hasSym          = (p.ssi_symptoms ?? []).some((n) => n >= 1 && n <= 5);
    const sup33 = !!p.ssi_sup_crit33_opened && (p.ssi_sup_crit33_sym?.length ?? 0) >= 1;
    const hasSupCriteria  = (p.ssi_sup_criteria  ?? []).length >= 1 || sup33;
    const hasDeepCriteria = (p.ssi_deep_criteria ?? []).length >= 1;
    const hasOsCriteria   = (p.ssi_os_criteria   ?? []).length >= 1;
    const isSuperficial   = p.ssi_type === "superficial";
    const isDeep          = p.ssi_type === "deep";
    const isOrganSpace    = p.ssi_type === "organ_space";
    const criteriaOk      = isOrganSpace  ? (hasOsCriteria && !!p.ssi_os_criterion4)
                          : isSuperficial ? hasSupCriteria
                          : isDeep        ? hasDeepCriteria
                          : hasSym;
    // วันที่ผ่าตัด (รองรับหลายครั้ง + ข้อมูลเก่าช่องเดียว)
    const surgeryDates = [...(p.ssi_surgeryDates ?? []), ...(p.ssi_surgeryDate ? [p.ssi_surgeryDate] : [])].filter(Boolean);
    // ช่วงเฝ้าระวังตามชนิดผ่าตัด (30/90 วัน); อยู่ในช่วงถ้าวันที่มีอาการอยู่ภายใน window หลังการผ่าตัดครั้งใดครั้งหนึ่ง
    const windowDays = ssiWindowDays(p.ssi_procedure);
    const inWindow = (p.ssi_signDate && surgeryDates.length)
      ? surgeryDates.some((d) => { const g = daysBetween(d, p.ssi_signDate); return g !== null && g >= 0 && g <= windowDays; })
      : !!p.ssi_in_window;
    const hadSurgery = surgeryDates.length > 0 || !!p.ssi_surgery;
    if (hadSurgery && inWindow && criteriaOk) {
      const ssiTypeLabel =
        p.ssi_type === "superficial" ? "Superficial Incisional SSI" :
        p.ssi_type === "deep"        ? "Deep Incisional SSI" :
        p.ssi_type === "organ_space" ? `Organ/Space SSI${p.ssi_organ_space_site ? ` (${p.ssi_organ_space_site})` : ""}` :
        "SSI";
      results.push({ label: ssiTypeLabel, category: "HAI", tone: "warn", detail: `การติดเชื้อแผลผ่าตัด (ภายใน ${windowDays} วัน)` });
    } else {
      results.push({ label: "ไม่มีการติดเชื้อ SSI", category: "NONE", tone: "info", detail: "" });
    }
  }

  // 10.5 GI
  if (p.sites.includes("10.5")) {
    const giNone = (detail: string): RuleResult => ({ label: "ไม่มีการติดเชื้อระบบทางเดินอาหาร", category: "NONE", tone: "info", detail });

    if (p.gi_appendicitis) {
      results.push(giNone("วินิจฉัย appendicitis"));
    } else {
      let infected = false;
      let variant = "";

      if (p.gi_type === "gastroenteritis") {
        const crit1 = !!p.gi_gast_crit1;
        const crit2 = (p.gi_gast_symptoms?.length ?? 0) >= 2 && (p.gi_gast_evidence?.length ?? 0) >= 1;
        infected = crit1 || crit2;
        variant = " (Gastroenteritis)";
      } else if (p.gi_type === "cdiff_pseudo") {
        infected = (p.gi_cdiff_criteria?.length ?? 0) >= 1;
        const hasPseudo = (p.gi_cdiff_criteria ?? []).includes(2);
        variant = hasPseudo ? " (Pseudomembranous colitis)" : " (C. difficile)";
      } else if (p.gi_type === "nec") {
        const necClin = (p.gi_nec_clinical?.length ?? 0) >= 1;
        const necXray = (p.gi_nec_xray_items?.length ?? 0) >= 1;
        const necSurg = (p.gi_nec_surgical_items?.length ?? 0) >= 1;
        infected = (necClin && necXray) || necSurg;
        variant = " (NEC)";
      } else if (p.gi_type === "gi_tract") {
        infected = (p.gi_tract_criteria?.length ?? 0) >= 1;
        variant = "";
      } else {
        // Backward compat with legacy fields
        const cdiff    = p.gi_cdiff_status === "yes";
        const pseudo   = !!p.gi_pseudo;
        const noCdiff  = p.gi_cdiff_status === "no";
        const anatomical = noCdiff && p.gi_evidence === "anatomical";
        const clinical   = noCdiff && p.gi_evidence === "clinical"
          && (p.gi_clinical_symptoms?.length ?? 0) >= 2 && (p.gi_pathogen?.length ?? 0) >= 1;
        let acuteDiarrhea = false, nec = false;
        if (noCdiff && p.gi_evidence === "none") {
          acuteDiarrhea = !!p.gi_diarrhea_acute;
          const age = typeof p.age === "number" ? p.age : 99;
          if (age < 1) {
            const necClin = (p.gi_nec_clinical?.length ?? 0) >= 1;
            const necXray = p.gi_nec_xray === "has" && (p.gi_nec_xray_items?.length ?? 0) >= 1;
            const surgical = p.gi_nec_xray === "none" && p.gi_nec_surgical === "found"
              && (p.gi_nec_surgical_items?.length ?? 0) >= 1;
            nec = necClin && (necXray || surgical);
          }
        }
        infected = cdiff || pseudo || anatomical || clinical || acuteDiarrhea || nec;
        variant = cdiff ? " (C. difficile)" : pseudo ? " (Pseudomembranous colitis)" : nec ? " (NEC)" : "";
      }

      if (infected) {
        if (isHAI) results.push({ label: `HAI / GI${variant}`, category: "HAI", tone: "danger", detail: "ติดเชื้อระบบทางเดินอาหาร" });
        else if (isCI) results.push({ label: `CI / GI${variant}`, category: "CI", tone: "ok", detail: "" });
        else results.push({ label: `GI${variant}`, category: "HAI", tone: "warn", detail: "กรุณากรอกวัน Admit/DOE เพื่อจำแนก HAI/CI" });
      } else {
        results.push(giNone("ไม่เข้าเกณฑ์การติดเชื้อระบบทางเดินอาหาร"));
      }
    }
  }

  if (results.length === 0) {
    results.push({ label: "ยังไม่ได้เลือกตำแหน่งติดเชื้อ", category: "UNKNOWN", tone: "info", detail: "กรุณาเลือกข้อ 10" });
  }
  return results;
}