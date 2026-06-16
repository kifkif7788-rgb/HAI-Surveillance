import { useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Save, BarChart3 } from "lucide-react";
import { PatientForm } from "../PatientForm";
import { InfectionSiteSelector } from "../InfectionSiteSelector";
import { RespiratoryForm } from "../forms/RespiratoryForm";
import { UTIForm, BSIForm, SSIForm, GIForm } from "../forms/OtherForms";
import { ResultSummaryPanel } from "../ResultSummaryPanel";
import { HAIAlertDialog } from "../HAIAlertDialog";
import { EvaluationResultDialog } from "../EvaluationResultDialog";
import { HeaderActionsContext } from "../AppLayout";
import { emptyRecord, loadDraft, saveDraft, saveRecord, clearDraft } from "@/lib/hai-store";
import { evaluate, type RuleResult } from "@/lib/rule-engine";
import { categorize } from "@/lib/hai-stats";
import { SITES, type PatientRecord } from "@/lib/hai-types";

// หมวดผลตรวจ → ตำแหน่งติดเชื้อ
const SITE_OF_CAT: Record<string, string> = {
  VAP: "10.1", HAP: "10.1", UTI: "10.2", CAUTI: "10.2",
  CLABSI: "10.3", BSI: "10.3", SSI: "10.4", GI: "10.5",
};
const SITE_LABEL: Record<string, string> = Object.fromEntries(SITES.map((s) => [s.id, s.label]));

/** ตำแหน่งติดเชื้อที่มีผลเป็น HAI */
function haiSiteIds(r: PatientRecord): string[] {
  return [...new Set(
    evaluate(r).filter((x) => x.category === "HAI").map((x) => SITE_OF_CAT[categorize(x.label)]).filter(Boolean),
  )];
}

export function RecordView() {
  const [data, setData] = useState<PatientRecord>(() => loadDraft() ?? emptyRecord());
  const update = (p: Partial<PatientRecord>) => setData((d) => ({ ...d, ...p }));
  const [haiAlert, setHaiAlert]     = useState<{ open: boolean; results: RuleResult[] }>({ open: false, results: [] });
  const [saveAlert, setSaveAlert]   = useState<{ open: boolean; results: RuleResult[]; record: PatientRecord | null }>({ open: false, results: [], record: null });
  const [evalOpen, setEvalOpen]     = useState(false);
  const lastSigRef = useRef<string>("");

  // Auto-save draft
  useEffect(() => {
    const t = setTimeout(() => saveDraft(data), 600);
    return () => clearTimeout(t);
  }, [data]);

  // Auto-popup whenever the evaluation concludes any HAI infection
  useEffect(() => {
    const t = setTimeout(() => {
      const hai = evaluate(data).filter((r) => r.category === "HAI");
      if (hai.length === 0) { lastSigRef.current = ""; return; }
      const sig = hai.map((r) => r.label).join(",") + `|${data.hn}|${data.an}|${data.admitDate}|${data.doeDate}`;
      if (lastSigRef.current === sig) return; // already shown for this conclusion
      lastSigRef.current = sig;
      setHaiAlert({ open: true, results: hai });
    }, 500);
    return () => clearTimeout(t);
  }, [data]);

  // Stable handler refs (always point to latest closures)
  const handlersRef = useRef({ onSave: () => {}, onEvaluate: () => {} });

  handlersRef.current.onSave = () => {
    if (!data.hn || !data.an || !data.admitDate || !data.doeDate) {
      toast.error("กรุณากรอก HN, AN, วัน Admit และ DOE");
      return;
    }
    const results = evaluate(data);
    // ผลเป็น HAI ต้องบันทึกเชื้อก่อโรคของทุกตำแหน่ง
    const haiSites = haiSiteIds(data);
    const orgMap = data.organismsBySite ?? {};
    const mdroMap = data.mdroBySite ?? {};
    const cleanedOrgs: Record<string, string[]> = {};
    const cleanedMdro: Record<string, string[]> = {};
    haiSites.forEach((s) => {
      cleanedOrgs[s] = (orgMap[s] ?? []).map((o) => o.trim()).filter(Boolean);
      const m = (mdroMap[s] ?? []).map((o) => o.trim()).filter(Boolean);
      if (m.length) cleanedMdro[s] = m;
    });
    // ไม่บังคับเชื้อก่อโรค: 10.1 (VAP/HAP), 10.4 SSI เมื่อแพทย์วินิจฉัย (ข้อ 5), 10.5 GI เมื่อผลเป็น NEC
    const ssiPhysicianDx = (data.ssi_symptoms ?? []).includes(5);
    const necResult = results.some((r) => r.label.includes("NEC"));
    const missing = haiSites.filter((s) =>
      cleanedOrgs[s].length === 0 && s !== "10.1" && !(s === "10.4" && ssiPhysicianDx) && !(s === "10.5" && necResult));
    if (missing.length) {
      toast.error("ผลเป็น HAI — กรุณาบันทึกเชื้อก่อโรคของทุกตำแหน่ง: " + missing.map((s) => SITE_LABEL[s] ?? s).join(", "));
      return;
    }
    const result  = results[0]?.label ?? "—";
    const savedData = { ...data, organismsBySite: cleanedOrgs, mdroBySite: cleanedMdro, status: "saved" as const, result };
    const { merged } = saveRecord(savedData);
    clearDraft();
    setData(emptyRecord());
    if (merged) {
      toast.success(`รวมข้อมูลสำเร็จ • HN ${data.hn} / AN ${data.an} มีบันทึกอยู่แล้ว — เพิ่มเฉพาะข้อมูลที่ต่างกัน`);
    } else {
      toast.success(`บันทึกสำเร็จ • สรุปผล: ${result}`);
    }
    // popup + เสียงเตือนเมื่อผลเป็น HAI
    const haiResults = results.filter((r) => r.category === "HAI");
    if (haiResults.length > 0) {
      setSaveAlert({ open: true, results: haiResults, record: savedData });
    }
  };

  handlersRef.current.onEvaluate = () => {
    const missing: string[] = [];
    if (!data.hn)            missing.push("HN");
    if (!data.an)            missing.push("AN");
    if (!data.admitDate)     missing.push("วัน Admit");
    if (!data.doeDate)       missing.push("วัน DOE");
    if (!data.sites.length)  missing.push("ตำแหน่งติดเชื้อ (ข้อ 10)");
    if (missing.length) { toast.error("กรุณากรอก: " + missing.join(", ")); return; }
    setEvalOpen(true);
  };

  // No buttons injected into header on this view
  const setHeaderActions = useContext(HeaderActionsContext);
  useEffect(() => { setHeaderActions(null); }, [setHeaderActions]);

  return (
    <>
      {/*
       * Layout:
       *   ┌─────────────────────────────────────────────────────────┐
       *   │  HEADER  (sticky top-0, z-30, height measured → --header-h) │
       *   ├──────────────────────────────────┬──────────────────────┤
       *   │  ACTION BAR (sticky below header)│                      │
       *   ├──────────────────────────────────┤  SUMMARY PANEL       │
       *   │  PatientForm                     │  (fixed, aligned with│
       *   │  InfectionSiteSelector           │   header bottom +    │
       *   │  Forms…                          │   panel-gap)         │
       *   └──────────────────────────────────┴──────────────────────┘
       *
       * All top values derive from CSS var(--header-h) set by ResizeObserver.
       * Panel width/gap use --panel-w and --panel-gap.
       *)
       */}

      {/* ── Center content column — .record-center adds xl right padding for fixed panel ── */}
      <div className="record-center space-y-5">

        {/* ── Sticky action bar — card aligned with the forms, sticks flush below header ── */}
        <div
          className="sticky z-20 card-soft px-4 py-2.5
                     flex flex-wrap items-center justify-between gap-3"
          style={{ top: "var(--header-h)" }}>
          <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2 select-none pl-1">
            <span>📝</span>
            <span className="hidden sm:inline">แบบฟอร์มบันทึกข้อมูลการติดเชื้อ</span>
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handlersRef.current.onSave()}
              className="btn-soft bg-primary text-primary-foreground gap-2 px-4">
              <Save className="w-4 h-4" />
              บันทึกข้อมูล
            </button>
            <button
              onClick={() => handlersRef.current.onEvaluate()}
              className="btn-soft bg-mint text-mint-foreground gap-2 px-4">
              <BarChart3 className="w-4 h-4" />
              สรุปผลการประเมิน
            </button>
          </div>
        </div>

        {/* ── Forms ── */}
        <PatientForm data={data} onChange={update} />
        <InfectionSiteSelector value={data.sites} onChange={(sites) => update({ sites })} />

        {data.sites.includes("10.1") && <RespiratoryForm data={data} onChange={update} />}
        {data.sites.includes("10.2") && <UTIForm         data={data} onChange={update} />}
        {data.sites.includes("10.3") && <BSIForm         data={data} onChange={update} />}
        {data.sites.includes("10.4") && <SSIForm         data={data} onChange={update} />}
        {data.sites.includes("10.5") && <GIForm          data={data} onChange={update} />}

        {/* เชื้อก่อโรค — แสดงเมื่อผลเป็น HAI (แยกตามตำแหน่ง) */}
        {haiSiteIds(data).length > 0 && (
          <OrganismCard
            siteIds={haiSiteIds(data)}
            value={data.organismsBySite ?? {}}
            onChange={(organismsBySite) => update({ organismsBySite })}
            mdro={data.mdroBySite ?? {}}
            onMdroChange={(mdroBySite) => update({ mdroBySite })}
            optionalSites={[
              "10.1",
              ...((data.ssi_symptoms ?? []).includes(5) ? ["10.4"] : []),
              ...(evaluate(data).some((r) => r.label.includes("NEC")) ? ["10.5"] : []),
            ]}
          />
        )}

        {/* Mobile: summary panel in-flow below forms */}
        <div className="xl:hidden">
          <ResultSummaryPanel data={data} />
        </div>
      </div>

      {/* ── Fixed summary panel (xl+) — aligned with CSS variables ──
       *   top   = header bottom + content-gap  → aligns with first content card
       *   right = panel-gap                    → comfortable gutter from edge
       *   maxH  = viewport minus header, top gap, and a matching bottom gap
       */}
      <div
        className="hidden xl:flex flex-col fixed z-10"
        style={{
          top:       "calc(var(--header-h) + 1.25rem)",
          right:     "var(--panel-gap)",
          width:     "var(--panel-w)",
          maxHeight: "calc(100vh - var(--header-h) - 2.5rem)",
          overflowY: "auto",
        }}>
        <ResultSummaryPanel data={data} />
      </div>

      {/* ── Dialogs ── */}
      {/* popup real-time ขณะกรอกข้อมูล */}
      <HAIAlertDialog
        open={haiAlert.open}
        onOpenChange={(o) => setHaiAlert((s) => ({ ...s, open: o }))}
        data={data}
        results={haiAlert.results}
      />
      {/* popup + เสียงเตือนหลังบันทึกสำเร็จ */}
      {saveAlert.record && (
        <HAIAlertDialog
          open={saveAlert.open}
          onOpenChange={(o) => setSaveAlert((s) => ({ ...s, open: o }))}
          data={saveAlert.record}
          results={saveAlert.results}
          playSound
        />
      )}
      <EvaluationResultDialog
        open={evalOpen}
        onOpenChange={setEvalOpen}
        data={data}
        onSave={handlersRef.current.onSave}
      />
    </>
  );
}

const COMMON_ORGANISMS = [
  "Escherichia coli", "Klebsiella pneumoniae", "Acinetobacter baumannii", "Pseudomonas aeruginosa",
  "Staphylococcus aureus", "MRSA", "Coagulase-negative staphylococci", "Enterococcus spp.",
  "Enterobacter spp.", "Streptococcus spp.", "Candida albicans", "Candida spp.",
];

const COMMON_MDRO = [
  "MRSA", "MRCoNs", "VRE", "ESBL-producing", "CRE (Carbapenem-resistant Enterobacterales)",
  "CRAB (Carbapenem-resistant A. baumannii)", "CRPA (Carbapenem-resistant P. aeruginosa)",
  "MDR-Acinetobacter", "MDR-Pseudomonas", "MDR", "XDR", "PXDR", "CoRO", "Steno", "C.diff",
];

function OrgList({ label, rows, onChange, listId, placeholder }: {
  label: string; rows: string[]; onChange: (next: string[]) => void; listId: string; placeholder: string;
}) {
  const r = rows.length ? rows : [""];
  return (
    <div>
      <div className="text-xs font-semibold text-foreground/60 mb-1">{label}</div>
      <div className="space-y-2">
        {r.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              list={listId}
              value={v}
              onChange={(e) => onChange(r.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 rounded-xl border border-border bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {r.length > 1 && (
              <button type="button" aria-label="ลบ" onClick={() => onChange(r.filter((_, j) => j !== i))}
                className="px-2.5 py-2 rounded-xl text-pink-foreground hover:bg-pink/20 transition-colors">✕</button>
            )}
          </div>
        ))}
      </div>
      <button type="button"
        onClick={() => onChange([...r, ""])}
        className="mt-1.5 text-xs font-semibold text-primary px-3 py-1 rounded-lg bg-sky/30 hover:bg-sky/50 transition-colors">
        + เพิ่ม
      </button>
    </div>
  );
}

function OrganismCard({ siteIds, value, onChange, mdro, onMdroChange, optionalSites = [] }: {
  siteIds: string[];
  value: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
  mdro: Record<string, string[]>;
  onMdroChange: (next: Record<string, string[]>) => void;
  optionalSites?: string[];
}) {
  return (
    <section className="card-soft p-5 relative border-2 border-pink-foreground/30">
      <div className="absolute -top-3.5 left-5 bg-pink text-pink-foreground rounded-full px-5 py-1 text-sm font-bold shadow-md flex items-center gap-1.5">
        🦠 เชื้อก่อโรค (HAI)
      </div>
      <div className="mt-3 text-xs text-muted-foreground mb-3">ผลเป็น HAI — บันทึกเชื้อก่อโรคแยกตามตำแหน่ง (อย่างน้อย 1 รายการ/ตำแหน่ง) · เชื้อดื้อยากรอกเมื่อมี</div>

      <div className="space-y-4">
        {siteIds.map((siteId) => (
          <div key={siteId} className="bg-white/60 rounded-2xl p-3 border border-border/50 space-y-3">
            <div className="text-sm font-bold text-primary">{siteId} {SITE_LABEL[siteId] ?? ""}</div>
            <OrgList label={optionalSites.includes(siteId) ? "เชื้อก่อโรค (ไม่บังคับ)" : "เชื้อก่อโรค *"}
              rows={value[siteId] ?? []} listId="organism-list" placeholder="เช่น Escherichia coli"
              onChange={(list) => onChange({ ...value, [siteId]: list })} />
            <OrgList label="เชื้อดื้อยา (MDRO)" rows={mdro[siteId] ?? []} listId="mdro-list" placeholder="เช่น MRSA, CRE, ESBL"
              onChange={(list) => onMdroChange({ ...mdro, [siteId]: list })} />
          </div>
        ))}
      </div>

      <datalist id="organism-list">
        {COMMON_ORGANISMS.map((o) => <option key={o} value={o} />)}
      </datalist>
      <datalist id="mdro-list">
        {COMMON_MDRO.map((o) => <option key={o} value={o} />)}
      </datalist>
    </section>
  );
}
