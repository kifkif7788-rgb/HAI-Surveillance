import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SITES, ssiWindowDays, type PatientRecord } from "@/lib/hai-types";
import { daysBetween, evaluate, type RuleResult } from "@/lib/rule-engine";
import { formatDateThai } from "@/components/ui/ThaiDatePicker";
import { cn } from "@/lib/utils";

const TONE: Record<RuleResult["tone"], { box: string; dot: string }> = {
  danger: { box: "bg-pink/50 text-pink-foreground border-pink-foreground/40",   dot: "bg-pink-foreground" },
  warn:   { box: "bg-lemon/50 text-lemon-foreground border-lemon-foreground/40", dot: "bg-lemon-foreground" },
  ok:     { box: "bg-mint/50 text-mint-foreground border-mint-foreground/40",   dot: "bg-mint-foreground" },
  info:   { box: "bg-sky/50 text-sky-foreground border-sky-foreground/40",      dot: "bg-sky-foreground" },
};

const SITE_LABEL: Record<string, { label: string; icon: string }> =
  Object.fromEntries(SITES.map((s) => [s.id, { label: s.label, icon: s.icon }]));

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  record: PatientRecord | null;
}

export function PatientDetailDialog({ open, onOpenChange, record }: Props) {
  if (!record) return null;
  const r = record;
  const diff    = daysBetween(r.admitDate, r.doeDate);
  const results = evaluate(r);
  const isHAI   = diff !== null && diff >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-white p-0 gap-0">

        {/* Header band */}
        <DialogHeader className="space-y-0 px-6 pt-6 pb-5 bg-gradient-to-br from-sky/30 to-lavender/25 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white grid place-items-center text-2xl shadow-sm shrink-0">
              {r.sex === "male" ? "👦" : r.sex === "female" ? "👧" : "🧸"}
            </div>
            <div className="min-w-0 text-left">
              <DialogTitle className="text-lg font-bold text-foreground leading-tight">
                {[r.firstName, r.lastName].filter(Boolean).join(" ") || "รายละเอียดผู้ป่วย"}
              </DialogTitle>
              <DialogDescription className="text-sm text-foreground/60 font-medium">
                HN {r.hn || "—"} · AN {r.an || "—"}
              </DialogDescription>
            </div>
            {r.result && (
              <span className="ml-auto shrink-0 px-3 py-1 rounded-full bg-white text-primary text-xs font-bold shadow-sm border border-border/60">
                {r.result}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">

          {/* Demographics */}
          <Section title="ข้อมูลผู้ป่วย" emoji="🧸">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Item label="HN"        value={r.hn || "—"} />
              <Item label="AN"        value={r.an || "—"} />
              <Item label="ชื่อ"      value={r.firstName || "—"} />
              <Item label="นามสกุล"   value={r.lastName || "—"} />
              <Item label="อายุ"      value={r.age === "" ? "—" : `${r.age} ปี`} />
              <Item label="เพศ"       value={r.sex === "male" ? "ชาย" : r.sex === "female" ? "หญิง" : "—"} />
              <Item label="เลขเตียง"  value={r.bed || "—"} />
              <Item label="หอผู้ป่วย" value={r.ward || "—"} />
              <Item label="วัน Admit" value={formatDateThai(r.admitDate)} />
              <Item label="วัน DOE"   value={formatDateThai(r.doeDate)} />
              <Item label="ยาฆ่าเชื้อที่ได้รับ" value={r.antibioticCount == null || r.antibioticCount === "" ? "—" : `${r.antibioticCount} ชนิด`} />
              <Item label="ผลการรักษา" value={r.outcome === "deceased" ? "เสียชีวิต ⚠️" : r.outcome === "admit" ? "ยังคง Admit 🛏️" : r.outcome === "home" ? "กลับบ้าน 🏠" : "—"} />
            </dl>
            {(r.firstDx || r.lastDx) && (
              <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                {r.firstDx && (
                  <div>
                    <dt className="text-xs font-semibold text-foreground/50 mb-0.5">การวินิจฉัยแรกรับ</dt>
                    <dd className="text-sm font-medium text-foreground">{r.firstDx}</dd>
                  </div>
                )}
                {r.lastDx && (
                  <div>
                    <dt className="text-xs font-semibold text-foreground/50 mb-0.5">การวินิจฉัยสุดท้าย</dt>
                    <dd className="text-sm font-medium text-foreground">{r.lastDx}</dd>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* DOE − Admit summary */}
          <div className={cn(
            "rounded-2xl px-4 py-3 border flex items-center gap-3",
            isHAI       ? "bg-pink/30 border-pink-foreground/30" :
            diff !== null ? "bg-mint/30 border-mint-foreground/30" :
                          "bg-muted border-border"
          )}>
            <span className="text-2xl shrink-0">🏥</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground/60">ระยะเวลา DOE − Admit</div>
              <div className="text-sm font-bold text-foreground">
                {diff === null ? "ยังไม่ระบุวันที่" : isHAI ? "ติดเชื้อในโรงพยาบาล (HAI)" : "ติดเชื้อในชุมชน (CI)"}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-2xl font-extrabold text-foreground tabular-nums">{diff ?? "—"}</span>
              <span className="text-xs font-semibold text-foreground/60 ml-1">วัน</span>
            </div>
          </div>

          {/* Selected sites */}
          <Section title="ตำแหน่งที่สงสัยติดเชื้อ" emoji="🌈">
            {r.sites.length === 0 ? (
              <p className="text-sm text-foreground/50">— ไม่ได้เลือกตำแหน่ง —</p>
            ) : (
              <div className="space-y-2.5">
                {r.sites.map((id) => (
                  <div key={id} className="rounded-2xl border border-border/70 overflow-hidden">
                    <div className="px-3 py-2 bg-sky/20 text-sm font-bold text-foreground flex items-center gap-2">
                      <span className="text-base">{SITE_LABEL[id]?.icon}</span>
                      <span>{id}</span>
                      <span className="font-semibold text-foreground/80">{SITE_LABEL[id]?.label}</span>
                    </div>
                    <div className="px-3 py-2.5 flex flex-wrap gap-1.5">
                      {siteFlags(id, r).map((f, i) => (
                        <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-muted text-foreground/80">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Evaluation */}
          <Section title="ผลการประเมิน" emoji="🤖">
            <div className="space-y-2">
              {results.map((res, i) => {
                const t = TONE[res.tone];
                return (
                  <div key={i} className={cn("rounded-2xl px-3.5 py-3 border flex items-start gap-2.5", t.box)}>
                    <span className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", t.dot)} />
                    <div className="min-w-0">
                      <div className="font-bold text-sm">{res.label}</div>
                      {res.detail && <div className="text-xs opacity-90 mt-0.5">{res.detail}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Per-site recorded flags → readable chips ── */
function siteFlags(id: string, r: PatientRecord): string[] {
  const f: string[] = [];
  const n = (arr?: number[]) => arr?.length ?? 0;
  switch (id) {
    case "10.1":
      if (r.resp_intubated === true)  f.push("ใส่ท่อช่วยหายใจ");
      if (r.resp_intubated === false) f.push("ไม่ใส่ท่อช่วยหายใจ");
      if (r.resp_noxray)                  f.push("ไม่มีผล X-ray");
      else if (r.resp_xray?.length)       f.push(`X-ray: ${r.resp_xray.join(", ")}`);
      if (n(r.resp_symptoms))         f.push(`อาการ ${n(r.resp_symptoms)} ข้อ`);
      break;
    case "10.2":
      if (r.uti_catheter === true)    f.push(r.uti_catheter_ge2 ? "ใส่สายสวน > 2 วัน" : "ใส่สายสวน ≤ 2 วัน");
      if (r.uti_catheter === false)   f.push("ไม่ใส่สายสวน");
      if (r.uti_culture === "negative")   f.push("C/S: ไม่พบเชื้อ");
      else if (r.uti_culture === "multi") f.push("C/S: พบ >2 ชนิด");
      else if (r.uti_culture_positive)    f.push("Urine C/S บวก (≤2 ชนิด)");
      if (r.uti_candida)              f.push("พบ Candida");
      if (n(r.uti_symptoms))          f.push(`อาการ ${n(r.uti_symptoms)} ข้อ`);
      break;
    case "10.3":
      if (r.bsi_line === "central_ge2") f.push("สายสวนกลาง > 2 วัน");
      if (r.bsi_line === "none")        f.push("ไม่มีสายสวนกลาง");
      if (r.bsi_hc_result === "negative") f.push("H/C: ไม่พบเชื้อ");
      else if (r.bsi_hc_result === "positive") {
        f.push(r.bsi_org_count === "gt2" ? "H/C: พบ > 2 เชื้อ" : "H/C: พบ ≤ 2 เชื้อ");
        if (r.bsi_org_type === "pathogen") f.push(`เชื้อก่อโรค (${r.bsi_pathogen_source === "central" ? "central" : "peripheral"})`);
        if (r.bsi_org_type === "flora")    f.push("Normal flora");
      }
      if (n(r.bsi_symptoms))          f.push(`อาการ ${n(r.bsi_symptoms)} ข้อ`);
      break;
    case "10.4": {
      const surgN = [...(r.ssi_surgeryDates ?? []), ...(r.ssi_surgeryDate ? [r.ssi_surgeryDate] : [])].filter(Boolean).length;
      if (surgN)              f.push(`ผ่าตัด ${surgN} ครั้ง`);
      else if (r.ssi_surgery) f.push("ได้รับการผ่าตัด");
      if (r.ssi_procedure)    f.push(`${r.ssi_procedure} (เฝ้าระวัง ${ssiWindowDays(r.ssi_procedure)} วัน)`);
      if (r.ssi_wound_class)  f.push(`แผล: ${r.ssi_wound_class}`);
      const signN = (r.ssi_symptoms ?? []).filter((x) => x >= 1 && x <= 5).length;
      if (signN)              f.push(`อาการแสดง ${signN} ข้อ`);
      break;
    }
    case "10.5":
      if (r.gi_cdiff_status === "yes") f.push("C. difficile");
      if (r.gi_pseudo)                 f.push("Pseudomembranous");
      if (r.gi_appendicitis)           f.push("Appendicitis");
      if (r.gi_evidence === "anatomical") f.push("มีหลักฐานทางกายวิภาค/พยาธิ");
      if (r.gi_evidence === "clinical")   f.push(`อาการเข้าได้ ${n(r.gi_clinical_symptoms)} ข้อ`);
      if (n(r.gi_pathogen))            f.push(`ตรวจพบเชื้อ ${n(r.gi_pathogen)} ข้อ`);
      break;
  }
  // เชื้อก่อโรค + เชื้อดื้อยาของตำแหน่งนี้ (ถ้าผลเป็น HAI)
  const orgs = (r.organismsBySite?.[id] ?? []).filter((o) => o.trim());
  if (orgs.length) f.push(`🦠 ${orgs.join(", ")}`);
  const mdro = (r.mdroBySite?.[id] ?? []).filter((o) => o.trim());
  if (mdro.length) f.push(`⚠️ ดื้อยา: ${mdro.join(", ")}`);
  if (f.length === 0) f.push("ไม่มีข้อมูลเพิ่มเติม");
  return f;
}

/* ── layout helpers ── */
function Section({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-bold text-foreground mb-2.5 flex items-center gap-2">
        <span className="text-base">{emoji}</span>
        <span>{title}</span>
      </h3>
      {children}
    </section>
  );
}
function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-semibold text-foreground/50">{label}</dt>
      <dd className="text-sm font-semibold text-foreground mt-0.5">{value}</dd>
    </div>
  );
}
