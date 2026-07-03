import { useState } from "react";
import { toast } from "sonner";
import {
  submitSurvey, useSurveys, emptyRatings,
  RATING_ITEMS, DECISION_FACTORS,
  type SurveyEntry, type RatingKey, type SystemChoice, type ReworkChoice, type RecommendChoice,
} from "@/lib/survey-store";
import { InterviewView } from "./InterviewView";
import { cn } from "@/lib/utils";

interface Props {
  currentUser: { id: string; name: string; role: string; isAdmin: boolean };
}

const SCORE_LABELS = ["", "น้อยที่สุด", "น้อย", "ปานกลาง", "มาก", "มากที่สุด"];
const SCORE_COLORS = [
  "",
  "bg-pink/80 border-pink-foreground/50 text-pink-foreground",
  "bg-lemon/80 border-lemon-foreground/50 text-lemon-foreground",
  "bg-sky/70 border-sky-foreground/50 text-sky-foreground",
  "bg-mint/70 border-mint-foreground/50 text-mint-foreground",
  "bg-mint border-mint-foreground/70 text-mint-foreground",
];

const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export function SurveyView({ currentUser }: Props) {
  const [tab, setTab] = useState<"form" | "interview" | "results">("form");

  const TABS = [
    { key: "form",      label: "📝 กรอกแบบประเมิน",   activeClass: "bg-sky/20 border-sky-foreground/30 text-sky-foreground" },
    { key: "interview", label: "🎙️ แนวสัมภาษณ์",      activeClass: "bg-lavender/30 border-lavender-foreground/40 text-lavender-foreground" },
    ...(currentUser.isAdmin
      ? [{ key: "results", label: "📊 ผลสรุป (Admin)", activeClass: "bg-mint/20 border-mint-foreground/30 text-mint-foreground" }]
      : []),
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={cn("px-5 py-2 rounded-2xl text-sm font-semibold transition-all border-2",
              tab === t.key ? t.activeClass : "bg-white/70 border-border text-muted-foreground hover:bg-muted/50"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "form"      && <SurveyForm currentUser={currentUser} />}
      {tab === "interview" && <InterviewView currentUser={currentUser} />}
      {tab === "results"   && <SurveyResults />}
    </div>
  );
}

/* ── helpers ── */
function NumInput({
  value, onChange, placeholder, unit, presets,
}: {
  value: number | ""; onChange: (v: number | "") => void;
  placeholder?: string; unit?: string; presets?: number[];
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder={placeholder ?? "0"}
          className="w-20 px-2.5 py-1.5 rounded-xl border border-border bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right"
        />
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {presets && (
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={cn(
                "px-2.5 py-0.5 rounded-lg border text-xs font-medium transition-all",
                value === p
                  ? "bg-sky/20 border-sky-foreground/40 text-sky-foreground"
                  : "bg-white/70 border-border text-muted-foreground hover:bg-muted/50"
              )}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Score button strip ── */
function ScoreStrip({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            "flex flex-col items-center justify-center w-[58px] h-[54px] rounded-xl border-2 transition-all select-none",
            value === n
              ? cn(SCORE_COLORS[n], "shadow-md scale-105")
              : "bg-white/70 border-border text-muted-foreground hover:bg-muted/60 hover:border-muted-foreground/40"
          )}>
          <span className="text-base font-black leading-none">{n}</span>
          <span className="text-[10px] font-medium leading-tight text-center mt-0.5 px-0.5">
            {SCORE_LABELS[n]}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── Rating card for one criterion ── */
function RatingCard({
  no, label, paperScore, webappScore, onPaper, onWebapp,
}: {
  no: number; label: string;
  paperScore: number; webappScore: number;
  onPaper: (v: number) => void; onWebapp: (v: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-white/70 overflow-hidden">
      {/* Question header */}
      <div className="bg-muted/30 px-4 py-2.5 border-b border-border/30">
        <p className="text-sm font-bold text-foreground">
          <span className="text-primary font-black mr-2">{no}.</span>{label}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/30">
        {/* Paper */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-muted text-[10px] font-black">📄</span>
            ระบบแบบกระดาษ
            {paperScore > 0 && (
              <span className={cn("ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full border", SCORE_COLORS[paperScore])}>
                {paperScore} — {SCORE_LABELS[paperScore]}
              </span>
            )}
          </p>
          <ScoreStrip value={paperScore} onChange={onPaper} />
        </div>

        {/* Webapp */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-sky-foreground flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-sky/20 text-[10px] font-black">💻</span>
            ระบบเว็บแอปพลิเคชัน
            {webappScore > 0 && (
              <span className={cn("ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full border", SCORE_COLORS[webappScore])}>
                {webappScore} — {SCORE_LABELS[webappScore]}
              </span>
            )}
          </p>
          <ScoreStrip value={webappScore} onChange={onWebapp} />
        </div>
      </div>
    </div>
  );
}

/* ── Main Survey Form ── */
function SurveyForm({ currentUser }: { currentUser: { id: string; name: string; role: string } }) {
  const [ward,       setWard]       = useState(currentUser.role);
  const [age,        setAge]        = useState<number | "">("");
  const [icwnYears,  setIcwnYears]  = useState<number | "">("");
  const [surveyDate, setSurveyDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [ratings, setRatings] = useState(emptyRatings);

  const [systemPreference,     setSystemPreference]     = useState<SystemChoice>("");
  const [paperMinutes,         setPaperMinutes]         = useState<number | "">("");
  const [webappMinutes,        setWebappMinutes]        = useState<number | "">("");
  const [paperErrors,          setPaperErrors]          = useState<number | "">("");
  const [webappErrors,         setWebappErrors]         = useState<number | "">("");
  const [lessRework,           setLessRework]           = useState<ReworkChoice>("");
  const [recommendation,       setRecommendation]       = useState<RecommendChoice>("");

  const [preferredSystem, setPreferredSystem] = useState<"paper" | "webapp" | "">("");
  const [webappReason,    setWebappReason]    = useState("");
  const [paperReason,     setPaperReason]     = useState("");
  const [decisionFactors, setDecisionFactors] = useState<string[]>([]);
  const [otherFactor,     setOtherFactor]     = useState("");

  const [webappSuggestions, setWebappSuggestions] = useState("");
  const [paperProblems,     setPaperProblems]     = useState("");

  const [saving,    setSaving]    = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function setRating(key: RatingKey, system: "paper" | "webapp", val: number) {
    setRatings((prev) => ({ ...prev, [key]: { ...prev[key], [system]: val } }));
  }

  function toggleFactor(f: string) {
    setDecisionFactors((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : prev.length < 3 ? [...prev, f] : prev
    );
  }

  const allRated = RATING_ITEMS.every(
    ({ key }) => ratings[key].paper > 0 && ratings[key].webapp > 0
  );

  async function handleSubmit() {
    if (!allRated) { toast.error("กรุณาให้คะแนนทุกหัวข้อในตารางเปรียบเทียบก่อนส่ง"); return; }
    setSaving(true);
    try {
      await submitSurvey({
        userId: currentUser.id, userName: currentUser.name, userRole: currentUser.role,
        ward, age, icwnYears, surveyDate,
        ratings,
        systemPreference, paperMinutesPerCase: paperMinutes, webappMinutesPerCase: webappMinutes,
        paperErrors, webappErrors, lessRework, recommendation,
        preferredSystem, webappReason, paperReason, decisionFactors, otherFactor,
        webappSuggestions, paperProblems,
      });
      setSubmitted(true);
      toast.success("บันทึกแบบประเมินเรียบร้อยแล้ว 💖");
    } catch {
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <div className="card-soft p-10 text-center space-y-4">
        <div className="text-6xl">🎉</div>
        <div className="font-bold text-primary text-xl">ขอบคุณสำหรับการประเมิน!</div>
        <p className="text-sm text-muted-foreground">คำตอบถูกบันทึกแล้ว ข้อมูลจะนำไปปรับปรุงระบบต่อไป</p>
        <button
          onClick={() => {
            setRatings(emptyRatings);
            setSystemPreference(""); setPreferredSystem(""); setDecisionFactors([]);
            setWebappSuggestions(""); setPaperProblems("");
            setSubmitted(false);
          }}
          className="mt-2 px-6 py-2.5 rounded-2xl bg-sky/20 text-sky-foreground font-semibold text-sm hover:bg-sky/30 transition-all border-2 border-sky-foreground/20">
          ประเมินอีกครั้ง
        </button>
      </div>
    );
  }

  const inputCls = "w-full px-3 py-2 rounded-xl border border-border bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="card-soft p-5 lg:p-6 relative">
        <div className="absolute -top-3.5 left-5 bg-sky text-sky-foreground rounded-full px-5 py-1 text-sm font-bold shadow-md">
          📋 แบบสอบถามความพึงพอใจและการเปรียบเทียบการใช้งาน
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">อายุ (ปี)</label>
            <NumInput value={age} onChange={setAge} placeholder="อายุ" unit="ปี" presets={[25,30,35,40,45,50,55,60]} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">ประสบการณ์การทำงาน (ปี)</label>
            <NumInput value={icwnYears} onChange={setIcwnYears} placeholder="0" unit="ปี" presets={[1,2,3,5,10,15,20]} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">วันที่</label>
            <input
              type="date"
              value={surveyDate}
              onChange={(e) => setSurveyDate(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* ── Section 2A: ตารางเปรียบเทียบ ── */}
      <div className="card-soft p-5 lg:p-6 relative">
        <div className="absolute -top-3.5 left-5 bg-lavender text-lavender-foreground rounded-full px-5 py-1 text-sm font-bold shadow-md">
          ส่วนที่ 2 — ตารางเปรียบเทียบ
        </div>
        <div className="mt-3 space-y-1">
          <p className="text-xs text-muted-foreground mb-4">
            คำแนะนำ: กรุณาให้คะแนน <span className="font-bold text-foreground">1 (น้อยที่สุด) ถึง 5 (มากที่สุด)</span>{" "}
            ทั้งระบบแบบกระดาษ และระบบเว็บแอปพลิเคชัน
          </p>
          {!allRated && (
            <p className="text-xs text-pink-foreground font-semibold mb-3 bg-pink/10 rounded-xl px-3 py-2">
              ⚠ กรุณาให้คะแนนทุกหัวข้อทั้ง 2 ระบบ ก่อนส่งแบบสอบถาม
            </p>
          )}
          <div className="space-y-3">
            {RATING_ITEMS.map((item, i) => (
              <RatingCard
                key={item.key}
                no={i + 1}
                label={item.label}
                paperScore={ratings[item.key].paper}
                webappScore={ratings[item.key].webapp}
                onPaper={(v) => setRating(item.key, "paper", v)}
                onWebapp={(v) => setRating(item.key, "webapp", v)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 2B: คำถามเชิงเลือก ── */}
      <div className="card-soft p-5 lg:p-6 relative">
        <div className="absolute -top-3.5 left-5 bg-lemon text-lemon-foreground rounded-full px-5 py-1 text-sm font-bold shadow-md">
          ส่วนที่ 2 — คำถามเปรียบเทียบเชิงเลือก/เชิงข้อเท็จจริง
        </div>
        <div className="mt-3 space-y-6">

          {/* Q1 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              1. โดยรวมแล้ว ท่านชอบระบบใดมากกว่า?
            </p>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "paper",   label: "📄 ระบบแบบกระดาษ" },
                { value: "webapp",  label: "💻 ระบบเว็บแอปพลิเคชัน" },
                { value: "equal",   label: "↔ ไม่มีความต่าง / เสมอกัน" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSystemPreference(opt.value as SystemChoice)}
                  className={cn(
                    "px-4 py-2 rounded-2xl border-2 text-sm font-medium transition-all",
                    systemPreference === opt.value
                      ? "bg-sky/20 border-sky-foreground/40 text-sky-foreground shadow-sm scale-[1.02]"
                      : "bg-white/70 border-border text-muted-foreground hover:bg-muted/50"
                  )}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Q2 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              2. ระบบใดทำให้บันทึกข้อมูลเสร็จเร็วกว่า (โปรดระบุเวลาเฉลี่ยต่อการบันทึก 1 เคส)
            </p>
            <div className="flex flex-wrap gap-4 pl-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-20">📄 กระดาษ:</span>
                <NumInput value={paperMinutes} onChange={setPaperMinutes} unit="นาที/เคส" presets={[5,10,15,20,30,45,60]} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-20">💻 เว็บแอป:</span>
                <NumInput value={webappMinutes} onChange={setWebappMinutes} unit="นาที/เคส" presets={[5,10,15,20,30,45,60]} />
              </div>
            </div>
          </div>

          {/* Q3 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              3. ท่านพบข้อผิดพลาดหรือการละเลยข้อมูล (missing/omission) เท่าไร โดยประมาณ
            </p>
            <div className="flex flex-wrap gap-4 pl-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-20">📄 กระดาษ:</span>
                <NumInput value={paperErrors} onChange={setPaperErrors} unit="ครั้ง" presets={[0,1,2,3,5,10]} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-20">💻 เว็บแอป:</span>
                <NumInput value={webappErrors} onChange={setWebappErrors} unit="ครั้ง" presets={[0,1,2,3,5,10]} />
              </div>
            </div>
          </div>

          {/* Q4 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              4. ระบบใดทำให้เกิดการย้อนตรวจสอบ/แก้ไขข้อมูล (rework) น้อยกว่า?
            </p>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "paper",  label: "📄 กระดาษ" },
                { value: "webapp", label: "💻 เว็บแอป" },
                { value: "unsure", label: "ไม่แน่ใจ" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLessRework(opt.value as ReworkChoice)}
                  className={cn(
                    "px-4 py-2 rounded-2xl border-2 text-sm font-medium transition-all",
                    lessRework === opt.value
                      ? "bg-mint/20 border-mint-foreground/40 text-mint-foreground shadow-sm scale-[1.02]"
                      : "bg-white/70 border-border text-muted-foreground hover:bg-muted/50"
                  )}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Q5 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              5. หากต้องเลือกใช้เพียงระบบเดียวในหน่วยงาน ท่านจะแนะนำให้ใช้:
            </p>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "paper",       label: "📄 กระดาษ" },
                { value: "webapp",      label: "💻 เว็บแอป" },
                { value: "hybrid",      label: "🔀 ใช้ร่วมกัน (hybrid)" },
                { value: "situational", label: "🔄 ขึ้นกับสถานการณ์" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRecommendation(opt.value as RecommendChoice)}
                  className={cn(
                    "px-4 py-2 rounded-2xl border-2 text-sm font-medium transition-all",
                    recommendation === opt.value
                      ? "bg-lavender/30 border-lavender-foreground/40 text-lavender-foreground shadow-sm scale-[1.02]"
                      : "bg-white/70 border-border text-muted-foreground hover:bg-muted/50"
                  )}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: ความคิดเห็น ── */}
      <div className="card-soft p-5 lg:p-6 relative">
        <div className="absolute -top-3.5 left-5 bg-mint text-mint-foreground rounded-full px-5 py-1 text-sm font-bold shadow-md">
          ส่วนที่ 3 — คำถามเชิงความคิดเห็น (ระบุเหตุผล)
        </div>
        <div className="mt-3 space-y-6">

          {/* Q3.1 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              1. ท่านจะเลือกใช้ระบบใดในการกรอกข้อมูลเพื่อรายงานการติดเชื้อ (เลือกเพียง 1 ข้อ)
            </p>
            <div className="flex gap-3">
              {([
                { value: "paper",  label: "📄 กระดาษ" },
                { value: "webapp", label: "💻 เว็บแอป" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPreferredSystem(opt.value)}
                  className={cn(
                    "px-5 py-2 rounded-2xl border-2 text-sm font-semibold transition-all",
                    preferredSystem === opt.value
                      ? "bg-sky/20 border-sky-foreground/40 text-sky-foreground shadow-sm scale-[1.02]"
                      : "bg-white/70 border-border text-muted-foreground hover:bg-muted/50"
                  )}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Q3.2 เหตุผล */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">2. กรุณาระบุเหตุผลที่ท่านเลือกในข้อที่ 1</p>
            <div className="space-y-2">
              <label className="text-xs font-medium text-sky-foreground">
                💻 หากท่านเลือกระบบเว็บแอป กรุณาระบุเหตุผลสั้น ๆ:
              </label>
              <textarea
                value={webappReason}
                onChange={(e) => setWebappReason(e.target.value)}
                rows={2}
                placeholder="เหตุผลที่เลือกเว็บแอป..."
                className={cn(inputCls, "resize-none")}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                📄 หากท่านเลือกระบบแบบกระดาษ กรุณาระบุเหตุผลสั้น ๆ:
              </label>
              <textarea
                value={paperReason}
                onChange={(e) => setPaperReason(e.target.value)}
                rows={2}
                placeholder="เหตุผลที่เลือกกระดาษ..."
                className={cn(inputCls, "resize-none")}
              />
            </div>
          </div>

          {/* Q3.3 ปัจจัยสำคัญ */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              3. ปัจจัยที่สำคัญที่สุดในการตัดสินใจใช้ระบบ{" "}
              <span className="text-xs font-normal text-muted-foreground">(เลือกได้สูงสุด 3 ข้อ — เลือกแล้ว {decisionFactors.length}/3)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {DECISION_FACTORS.map((f) => {
                const sel = decisionFactors.includes(f);
                const maxed = decisionFactors.length >= 3 && !sel;
                return (
                  <button
                    key={f}
                    type="button"
                    disabled={maxed}
                    onClick={() => toggleFactor(f)}
                    className={cn(
                      "px-3.5 py-2 rounded-2xl border-2 text-xs font-medium transition-all",
                      sel
                        ? "bg-sky/20 border-sky-foreground/40 text-sky-foreground shadow-sm"
                        : maxed
                        ? "bg-muted/40 border-border/30 text-muted-foreground/50 cursor-not-allowed"
                        : "bg-white/70 border-border text-muted-foreground hover:bg-muted/50"
                    )}>
                    {sel ? "✓ " : ""}{f}
                  </button>
                );
              })}
              {/* อื่นๆ */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleFactor("อื่น ๆ")}
                  disabled={decisionFactors.length >= 3 && !decisionFactors.includes("อื่น ๆ")}
                  className={cn(
                    "px-3.5 py-2 rounded-2xl border-2 text-xs font-medium transition-all",
                    decisionFactors.includes("อื่น ๆ")
                      ? "bg-sky/20 border-sky-foreground/40 text-sky-foreground shadow-sm"
                      : decisionFactors.length >= 3
                      ? "bg-muted/40 border-border/30 text-muted-foreground/50 cursor-not-allowed"
                      : "bg-white/70 border-border text-muted-foreground hover:bg-muted/50"
                  )}>
                  {decisionFactors.includes("อื่น ๆ") ? "✓ " : ""}อื่น ๆ
                </button>
                {decisionFactors.includes("อื่น ๆ") && (
                  <input
                    value={otherFactor}
                    onChange={(e) => setOtherFactor(e.target.value)}
                    placeholder="ระบุ..."
                    className="px-2.5 py-1.5 rounded-xl border border-border bg-white/80 text-xs focus:outline-none focus:ring-1 focus:ring-ring w-36"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 4: ข้อเสนอแนะ ── */}
      <div className="card-soft p-5 lg:p-6 relative">
        <div className="absolute -top-3.5 left-5 bg-pink text-pink-foreground rounded-full px-5 py-1 text-sm font-bold shadow-md">
          ส่วนที่ 4 — ข้อเสนอแนะเชิงพัฒนา
        </div>
        <div className="mt-3 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
              ✏ ข้อเสนอแนะเพิ่มเติมเพื่อปรับปรุงระบบเว็บแอป (ถ้ามี):
            </label>
            <textarea
              value={webappSuggestions}
              onChange={(e) => setWebappSuggestions(e.target.value)}
              rows={4}
              placeholder="กรอกข้อเสนอแนะ..."
              className={cn(inputCls, "resize-none")}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
              ✏ ปัญหาหลักที่พบในการใช้ระบบแบบกระดาษ (ถ้ามี):
            </label>
            <textarea
              value={paperProblems}
              onChange={(e) => setPaperProblems(e.target.value)}
              rows={4}
              placeholder="กรอกปัญหา..."
              className={cn(inputCls, "resize-none")}
            />
          </div>
        </div>
      </div>

      {/* ── Submit ── */}
      <button
        onClick={handleSubmit}
        disabled={saving || !allRated}
        className={cn(
          "w-full py-3.5 rounded-2xl font-bold text-sm transition-all",
          allRated
            ? "bg-sky text-sky-foreground hover:opacity-90 shadow-md"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}>
        {saving ? "⏳ กำลังบันทึก..." : "✅ ส่งแบบสอบถาม"}
      </button>
    </div>
  );
}

/* ── Admin Results View ── */
function SurveyResults() {
  const entries = useSurveys();
  const [page, setPage] = useState(1);
  const PER_PAGE = 5;

  const sorted = [...entries].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const paged = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Averages per criterion
  function avgPair(key: RatingKey) {
    if (!entries.length) return { paper: 0, webapp: 0 };
    return {
      paper:  entries.reduce((s, e) => s + (e.ratings?.[key]?.paper  ?? 0), 0) / entries.length,
      webapp: entries.reduce((s, e) => s + (e.ratings?.[key]?.webapp ?? 0), 0) / entries.length,
    };
  }

  // Preference counts
  function countPref(field: "systemPreference" | "recommendation" | "lessRework" | "preferredSystem") {
    const counts: Record<string, number> = {};
    entries.forEach((e) => {
      const v = e[field] as string;
      if (v) counts[v] = (counts[v] ?? 0) + 1;
    });
    return counts;
  }

  const systemPrefCount  = countPref("systemPreference");
  const recommendCount   = countPref("recommendation");

  const PREF_LABELS: Record<string, string> = {
    paper: "📄 กระดาษ", webapp: "💻 เว็บแอป", equal: "↔ เสมอกัน",
    hybrid: "🔀 Hybrid", situational: "🔄 ขึ้นกับสถานการณ์",
    unsure: "ไม่แน่ใจ",
  };

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="card-soft p-5 relative">
        <div className="absolute -top-3.5 left-5 bg-mint text-mint-foreground rounded-full px-5 py-1 text-sm font-bold shadow-md">
          📊 สรุปผลการประเมิน
        </div>
        <div className="pt-2 flex items-center gap-2 mb-4">
          <span className="text-muted-foreground text-sm">จำนวนผู้ตอบทั้งหมด:</span>
          <span className="font-bold text-lg text-foreground">{entries.length} คน</span>
        </div>

        {entries.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-6">ยังไม่มีข้อมูลการประเมิน</p>
        )}

        {entries.length > 0 && (
          <>
            {/* Rating comparison table */}
            <div className="overflow-x-auto mb-5">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b-2 border-primary/20">
                    <th className="py-2 px-2 text-left font-bold text-foreground">หัวข้อ</th>
                    <th className="py-2 px-3 text-center font-bold text-muted-foreground">📄 กระดาษ (เฉลี่ย)</th>
                    <th className="py-2 px-3 text-center font-bold text-sky-foreground">💻 เว็บแอป (เฉลี่ย)</th>
                    <th className="py-2 px-3 text-center font-bold text-mint-foreground">ผลต่าง</th>
                  </tr>
                </thead>
                <tbody>
                  {RATING_ITEMS.map((item, i) => {
                    const { paper, webapp } = avgPair(item.key);
                    const diff = webapp - paper;
                    return (
                      <tr key={item.key} className="border-b border-border/30 even:bg-muted/20">
                        <td className="py-2 px-2">
                          <span className="text-xs text-muted-foreground mr-1">{i + 1}.</span>
                          {item.label}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <ScoreBadge value={paper} />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <ScoreBadge value={webapp} />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={cn("text-xs font-bold", diff > 0 ? "text-mint-foreground" : diff < 0 ? "text-pink-foreground" : "text-muted-foreground")}>
                            {diff > 0 ? "+" : ""}{diff.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Preference summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-muted/30 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">ระบบที่ชอบกว่า</p>
                {Object.entries(systemPrefCount).map(([k, n]) => (
                  <div key={k} className="flex justify-between items-center text-sm">
                    <span>{PREF_LABELS[k] ?? k}</span>
                    <span className="font-bold">{n} คน ({Math.round(n / entries.length * 100)}%)</span>
                  </div>
                ))}
              </div>
              <div className="bg-muted/30 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">คำแนะนำระบบที่ควรใช้</p>
                {Object.entries(recommendCount).map(([k, n]) => (
                  <div key={k} className="flex justify-between items-center text-sm">
                    <span>{PREF_LABELS[k] ?? k}</span>
                    <span className="font-bold">{n} คน ({Math.round(n / entries.length * 100)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Individual responses */}
      {entries.length > 0 && (
        <div className="card-soft p-5 relative">
          <div className="absolute -top-3.5 left-5 bg-lavender text-lavender-foreground rounded-full px-5 py-1 text-sm font-bold shadow-md">
            📋 รายการประเมินทั้งหมด
          </div>
          <div className="pt-2 space-y-3 mt-2">
            {paged.map((e) => (
              <ResponseCard key={e.id} entry={e} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-1.5 rounded-xl border text-sm font-medium disabled:opacity-40 hover:bg-muted/60 transition-all">
                ← ก่อนหน้า
              </button>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-1.5 rounded-xl border text-sm font-medium disabled:opacity-40 hover:bg-muted/60 transition-all">
                ถัดไป →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ value }: { value: number }) {
  if (!value) return <span className="text-xs text-muted-foreground">-</span>;
  const color = value >= 4.5 ? "text-mint-foreground" : value >= 3.5 ? "text-sky-foreground" : value >= 2.5 ? "text-lemon-foreground" : "text-pink-foreground";
  return <span className={cn("font-bold text-sm", color)}>{value.toFixed(2)}</span>;
}

function ResponseCard({ entry }: { entry: SurveyEntry }) {
  const [expanded, setExpanded] = useState(false);
  const PREF_LABELS: Record<string, string> = {
    paper: "📄 กระดาษ", webapp: "💻 เว็บแอป", equal: "↔ เสมอกัน",
    hybrid: "🔀 Hybrid", situational: "🔄 ขึ้นกับสถานการณ์", unsure: "ไม่แน่ใจ",
  };

  return (
    <div className="border border-border/50 rounded-2xl overflow-hidden bg-white/60">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-all">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-sky/20 grid place-items-center text-xs font-bold text-sky-foreground shrink-0">
            {entry.userName.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{entry.userName}</div>
            <div className="text-xs text-muted-foreground">{entry.ward || entry.userRole} · {fmtDate(entry.submittedAt)}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
          {entry.systemPreference && (
            <span className="bg-muted/60 rounded-lg px-2 py-0.5">{PREF_LABELS[entry.systemPreference]}</span>
          )}
          <span>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/30 px-4 py-3 space-y-4">
          {/* Rating comparison mini-table */}
          {entry.ratings && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[360px]">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="py-1 px-1 text-left text-muted-foreground font-medium">หัวข้อ</th>
                    <th className="py-1 px-2 text-center text-muted-foreground font-medium">📄</th>
                    <th className="py-1 px-2 text-center text-sky-foreground font-medium">💻</th>
                  </tr>
                </thead>
                <tbody>
                  {RATING_ITEMS.map((item) => (
                    <tr key={item.key} className="border-b border-border/20 even:bg-muted/10">
                      <td className="py-1 px-1">{item.label}</td>
                      <td className="py-1 px-2 text-center font-medium">{entry.ratings[item.key]?.paper || "-"}</td>
                      <td className="py-1 px-2 text-center font-medium text-sky-foreground">{entry.ratings[item.key]?.webapp || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Comparison answers */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {entry.paperMinutesPerCase !== "" && entry.paperMinutesPerCase !== undefined && (
              <div className="bg-muted/30 rounded-xl p-2">
                <div className="text-muted-foreground">เวลา (กระดาษ)</div>
                <div className="font-bold">{entry.paperMinutesPerCase} นาที/เคส</div>
              </div>
            )}
            {entry.webappMinutesPerCase !== "" && entry.webappMinutesPerCase !== undefined && (
              <div className="bg-sky/10 rounded-xl p-2">
                <div className="text-muted-foreground">เวลา (เว็บแอป)</div>
                <div className="font-bold text-sky-foreground">{entry.webappMinutesPerCase} นาที/เคส</div>
              </div>
            )}
            {entry.recommendation && (
              <div className="bg-lavender/20 rounded-xl p-2">
                <div className="text-muted-foreground">แนะนำใช้</div>
                <div className="font-bold">{PREF_LABELS[entry.recommendation] ?? entry.recommendation}</div>
              </div>
            )}
          </div>

          {entry.decisionFactors?.length > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground font-medium">ปัจจัยสำคัญ: </span>
              <span className="font-medium">{entry.decisionFactors.join(", ")}{entry.otherFactor ? `, ${entry.otherFactor}` : ""}</span>
            </div>
          )}

          {entry.webappSuggestions && (
            <div className="bg-sky/10 rounded-xl px-3 py-2 text-xs">
              <span className="font-semibold text-sky-foreground">ข้อเสนอแนะเว็บแอป: </span>
              <span className="italic">{entry.webappSuggestions}</span>
            </div>
          )}
          {entry.paperProblems && (
            <div className="bg-muted/30 rounded-xl px-3 py-2 text-xs">
              <span className="font-semibold">ปัญหากระดาษ: </span>
              <span className="italic">{entry.paperProblems}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
