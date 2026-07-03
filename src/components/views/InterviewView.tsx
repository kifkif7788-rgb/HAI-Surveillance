import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  submitInterview, useInterviews, blobToBase64,
  type InterviewSession, type InterviewAnswer,
} from "@/lib/interview-store";
import { cn } from "@/lib/utils";

/* ── Sections & questions ── */
interface Question { text: string; probe?: string }
interface Section  { title: string; subtitle?: string; color: string; questions: Question[] }

const SECTIONS: Section[] = [
  {
    title: "ส่วนที่ 1 — ข้อมูลทั่วไปของผู้ให้ข้อมูล",
    color: "sky",
    questions: [
      { text: "กรุณาเล่าบทบาทหน้าที่หลักของท่านที่เกี่ยวข้องกับงานควบคุมหรือรายงานการติดเชื้อ" },
      { text: "ท่านมีประสบการณ์ในการรายงานข้อมูลการติดเชื้อในโรงพยาบาลมากี่ปี" },
    ],
  },
  {
    title: "ส่วนที่ 2 — ประสบการณ์กับระบบรายงานแบบเดิม (Paper-based)",
    color: "lemon",
    questions: [
      { text: "ท่านมีขั้นตอนในการรายงานข้อมูลการติดเชื้อด้วยระบบเดิมอย่างไร" },
      { text: "ปัญหาหรืออุปสรรคที่พบบ่อยจากการใช้ระบบรายงานแบบเอกสารมีอะไรบ้าง" },
      { text: "ระบบเดิมส่งผลต่อภาระงาน เวลาในการทำงาน หรือความถูกต้องของข้อมูลอย่างไร",
        probe: "มีขั้นตอนใดที่ซ้ำซ้อนหรือใช้เวลานานเป็นพิเศษหรือไม่" },
    ],
  },
  {
    title: "ส่วนที่ 3 — ประสบการณ์การใช้งานระบบเว็บแอปพลิเคชัน",
    color: "mint",
    questions: [
      { text: "หลังจากทดลองใช้ระบบเว็บแอปพลิเคชัน ท่านรู้สึกอย่างไรกับการใช้งานโดยรวม" },
      { text: "ระบบเว็บแอปพลิเคชันมีส่วนช่วยให้การบันทึกหรือรายงานข้อมูลสะดวกขึ้นหรือไม่ อย่างไร" },
      { text: "ท่านเห็นว่าระบบมีข้อดีหรือจุดเด่นใดเมื่อเทียบกับระบบรายงานแบบเดิม",
        probe: "ฟังก์ชันใดที่ใช้งานบ่อยหรือมีประโยชน์มากที่สุด" },
    ],
  },
  {
    title: "ส่วนที่ 4 — ความง่ายต่อการใช้งานและความเป็นไปได้ (Usability & Feasibility)",
    color: "lavender",
    questions: [
      { text: "ท่านคิดว่าระบบเว็บแอปพลิเคชันใช้งานง่ายหรือยากอย่างไร" },
      { text: "เมนูและขั้นตอนการใช้งานมีความชัดเจนเพียงพอหรือไม่" },
      { text: "ในบริบทการทำงานจริงของท่าน ระบบนี้สามารถนำไปใช้ได้จริงหรือไม่ เพราะเหตุใด" },
    ],
  },
  {
    title: "ส่วนที่ 5 — ปัจจัยเอื้อและอุปสรรคในการนำระบบไปใช้",
    color: "pink",
    questions: [
      { text: "ปัจจัยใดที่ท่านคิดว่าจะช่วยสนับสนุนการนำระบบเว็บแอปพลิเคชันไปใช้จริงในโรงพยาบาล" },
      { text: "อุปสรรคหรือข้อจำกัดที่อาจทำให้การนำระบบไปใช้ไม่ประสบความสำเร็จมีอะไรบ้าง",
        probe: "ด้านบุคลากร เทคโนโลยี เวลา หรือการสนับสนุนจากองค์กร" },
    ],
  },
  {
    title: "ส่วนที่ 6 — ข้อเสนอแนะและการพัฒนาในอนาคต",
    color: "sky",
    questions: [
      { text: "ท่านมีข้อเสนอแนะใดในการปรับปรุงระบบเว็บแอปพลิเคชันให้เหมาะสมกับการใช้งานมากยิ่งขึ้น" },
      { text: "หากโรงพยาบาลมีการนำระบบนี้ไปใช้จริง ท่านมีความเห็นหรือความคาดหวังอย่างไร" },
    ],
  },
  {
    title: "คำถามปิดการสัมภาษณ์",
    color: "mint",
    questions: [
      { text: "มีประเด็นอื่นใดเกี่ยวกับการรายงานหรือเฝ้าระวังการติดเชื้อที่ท่านอยากเพิ่มเติมหรือไม่" },
    ],
  },
];

/* ── Types ── */
type RecordStatus = "idle" | "recording" | "done";
interface QState {
  status: RecordStatus;
  audioUrl:  string | null;
  audioBlob: Blob | null;
  note: string;
  duration: number;
}

function makeKey(si: number, qi: number) { return `${si}-${qi}`; }
function initStates(): Record<string, QState> {
  const m: Record<string, QState> = {};
  SECTIONS.forEach((s, si) =>
    s.questions.forEach((_, qi) => {
      m[makeKey(si, qi)] = { status: "idle", audioUrl: null, audioBlob: null, note: "", duration: 0 };
    })
  );
  return m;
}

/* ── TTS ── */
let voicesLoaded = false;
function speak(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "th-TH";
  utter.rate = 0.88;
  utter.pitch = 1.05;
  if (voicesLoaded) {
    const thVoice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("th"));
    if (thVoice) utter.voice = thVoice;
  }
  if (onEnd) utter.onend = onEnd;
  window.speechSynthesis.speak(utter);
}
function stopSpeech() { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }

/* ── Props ── */
interface Props {
  currentUser: { id: string; name: string; role: string; isAdmin: boolean };
}

/* ── Main export ── */
export function InterviewView({ currentUser }: Props) {
  const [mode, setMode] = useState<"form" | "results">("form");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setMode("form")}
          className={cn("px-5 py-2 rounded-2xl text-sm font-semibold transition-all border-2",
            mode === "form"
              ? "bg-lavender/30 border-lavender-foreground/40 text-lavender-foreground"
              : "bg-white/70 border-border text-muted-foreground hover:bg-muted/50"
          )}>
          🎙️ บันทึกสัมภาษณ์
        </button>
        {currentUser.isAdmin && (
          <button
            onClick={() => setMode("results")}
            className={cn("px-5 py-2 rounded-2xl text-sm font-semibold transition-all border-2",
              mode === "results"
                ? "bg-mint/20 border-mint-foreground/30 text-mint-foreground"
                : "bg-white/70 border-border text-muted-foreground hover:bg-muted/50"
            )}>
            📋 ผลสัมภาษณ์ทั้งหมด (Admin)
          </button>
        )}
      </div>

      {mode === "form"
        ? <InterviewForm currentUser={currentUser} />
        : <InterviewResults />}
    </div>
  );
}

/* ════════════════════════════════ FORM ════════════════════════════════ */
function InterviewForm({ currentUser }: Props) {
  const [states, setStates]       = useState<Record<string, QState>>(initStates);
  const [speaking, setSpeaking]   = useState<string | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const [elapsed, setElapsed]     = useState(0);
  const [saving, setSaving]       = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const chunksRef   = useRef<BlobPart[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = () => { voicesLoaded = true; };
    window.speechSynthesis?.getVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);

  useEffect(() => () => { stopSpeech(); stopRecording(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function setQ(key: string, patch: Partial<QState>) {
    setStates((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  /* TTS */
  function handleSpeak(key: string, text: string, probe?: string) {
    if (speaking === key) { stopSpeech(); setSpeaking(null); return; }
    setSpeaking(key);
    speak(probe ? `${text} คำถามต่อยอด: ${probe}` : text, () => setSpeaking(null));
  }

  /* Recording */
  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current = null;
    streamRef.current = null;
    timerRef.current = null;
  }, []);

  async function handleRecord(key: string) {
    if (recording === key) { stopRecording(); setRecording(null); return; }
    if (recording) { stopRecording(); setRecording(null); }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url  = URL.createObjectURL(blob);
        setQ(key, { status: "done", audioUrl: url, audioBlob: blob });
      };
      recorder.start(200);
      setRecording(key);
      setQ(key, { status: "recording", audioUrl: null, audioBlob: null });
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      toast.error("ไม่สามารถเข้าถึงไมโครโฟน กรุณาอนุญาตการเข้าถึงก่อน");
    }
  }

  function handleDelete(key: string) {
    const url = states[key]?.audioUrl;
    if (url) URL.revokeObjectURL(url);
    setQ(key, { status: "idle", audioUrl: null, audioBlob: null, duration: 0 });
  }

  /* Submit session */
  async function handleSubmit() {
    setSaving(true);
    try {
      const answers: InterviewAnswer[] = [];
      for (const [si, section] of SECTIONS.entries()) {
        for (const [qi, q] of section.questions.entries()) {
          const key    = makeKey(si, qi);
          const qState = states[key];
          let audioBase64: string | undefined;
          if (qState.audioBlob) {
            const b64 = await blobToBase64(qState.audioBlob);
            audioBase64 = b64.length <= 2_000_000 ? b64 : undefined;
          }
          answers.push({
            si, qi,
            sectionTitle: section.title,
            questionText: q.text,
            note: qState.note,
            audioBase64,
            audioDurationSec: qState.duration > 0 ? qState.duration : undefined,
          });
        }
      }
      const totalRecorded = answers.filter((a) => !!a.audioBase64).length;
      await submitInterview({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        answers,
        totalRecorded,
      });
      setSubmitted(true);
      toast.success("บันทึกผลสัมภาษณ์เรียบร้อยแล้ว 🎙️");
    } catch {
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  function fmtTime(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  }

  const SECTION_STYLE: Record<string, { banner: string; num: string }> = {
    sky:      { banner: "bg-sky/15 border-sky/40",      num: "bg-sky text-sky-foreground" },
    lemon:    { banner: "bg-lemon/20 border-lemon/40",  num: "bg-lemon text-lemon-foreground" },
    mint:     { banner: "bg-mint/15 border-mint/40",    num: "bg-mint text-mint-foreground" },
    lavender: { banner: "bg-lavender/15 border-lavender/40", num: "bg-lavender text-lavender-foreground" },
    pink:     { banner: "bg-pink/15 border-pink/40",    num: "bg-pink text-pink-foreground" },
  };

  if (submitted) {
    return (
      <div className="card-soft p-10 text-center space-y-4">
        <div className="text-6xl">🎙️</div>
        <div className="font-bold text-primary text-xl">บันทึกผลสัมภาษณ์แล้ว!</div>
        <p className="text-sm text-muted-foreground">ผู้ดูแลระบบสามารถดูผลได้ในแท็บ "ผลสัมภาษณ์ทั้งหมด"</p>
        <button
          onClick={() => { setStates(initStates); setSubmitted(false); }}
          className="mt-2 px-6 py-2.5 rounded-2xl bg-lavender/20 text-lavender-foreground font-semibold text-sm hover:bg-lavender/30 transition-all border-2 border-lavender-foreground/20">
          สัมภาษณ์ใหม่
        </button>
      </div>
    );
  }

  let globalQ = 0;

  return (
    <div className="space-y-5">
      {/* Hint */}
      <div className="card-soft p-4 flex items-start gap-3">
        <span className="text-2xl shrink-0">🎙️</span>
        <div className="text-sm text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">แนวคำถามสัมภาษณ์เชิงลึก (In-depth Interview Guide)</p>
          <p>กดปุ่ม <span className="font-semibold text-sky-foreground">🔊 ฟังคำถาม</span> เพื่อให้ระบบอ่านออกเสียงเป็นภาษาไทย
          และกด <span className="font-semibold text-pink-foreground">🎤 บันทึก</span> เพื่อบันทึกเสียงคำตอบ</p>
        </div>
      </div>

      {SECTIONS.map((section, si) => {
        const style = SECTION_STYLE[section.color] ?? SECTION_STYLE.sky;
        return (
          <div key={si} className="card-soft overflow-hidden">
            <div className={cn("border-b px-5 py-3.5 flex items-center gap-3", style.banner)}>
              <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0", style.num)}>
                {si + 1}
              </span>
              <div>
                <p className="text-sm font-bold text-foreground leading-snug">{section.title}</p>
                {section.subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5">{section.subtitle}</p>
                )}
              </div>
            </div>

            <div className="pt-4 pb-4 px-4 space-y-3">
              {section.questions.map((q, qi) => {
                globalQ++;
                const key    = makeKey(si, qi);
                const qState = states[key];
                const isSpeaking  = speaking === key;
                const isRecording = recording === key;

                return (
                  <div key={qi} className="rounded-2xl border border-border/50 bg-white/70 overflow-hidden">
                    <div className="px-4 pt-3 pb-2">
                      <p className="text-sm font-semibold text-foreground leading-relaxed">
                        <span className="text-primary font-black mr-2">{globalQ}.</span>{q.text}
                      </p>
                      {q.probe && (
                        <p className="text-xs text-muted-foreground mt-1 pl-5 border-l-2 border-muted ml-1">
                          <span className="font-semibold">คำถามต่อยอด:</span> {q.probe}
                        </p>
                      )}
                    </div>

                    <div className="px-4 pb-3 flex flex-wrap gap-2 items-center">
                      {/* TTS */}
                      <button
                        type="button"
                        onClick={() => handleSpeak(key, q.text, q.probe)}
                        className={cn(
                          "flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 text-xs font-semibold transition-all",
                          isSpeaking
                            ? "bg-sky/30 border-sky-foreground/50 text-sky-foreground animate-pulse"
                            : "bg-white/80 border-border text-muted-foreground hover:bg-sky/10 hover:border-sky-foreground/30"
                        )}>
                        {isSpeaking ? "⏹ หยุดเสียง" : "🔊 ฟังคำถาม"}
                      </button>

                      {/* Record */}
                      {qState.status !== "done" ? (
                        <button
                          type="button"
                          onClick={() => handleRecord(key)}
                          className={cn(
                            "flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 text-xs font-semibold transition-all",
                            isRecording
                              ? "bg-pink/30 border-pink-foreground/50 text-pink-foreground"
                              : "bg-white/80 border-border text-muted-foreground hover:bg-pink/10 hover:border-pink-foreground/30"
                          )}>
                          {isRecording ? (
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block w-2 h-2 rounded-full bg-pink-foreground animate-pulse" />
                              {fmtTime(elapsed)} — กดหยุด
                            </span>
                          ) : "🎤 บันทึกเสียง"}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-mint-foreground font-semibold">✅ บันทึกแล้ว</span>
                          {qState.audioUrl && (
                            <audio src={qState.audioUrl} controls className="h-8" style={{ maxWidth: "220px" }} />
                          )}
                          <button type="button" onClick={() => handleDelete(key)}
                            className="text-xs px-2.5 py-1.5 rounded-xl border border-border text-muted-foreground hover:bg-pink/10 hover:text-pink-foreground transition-all">
                            🗑 ลบ
                          </button>
                          <button type="button" onClick={() => handleRecord(key)}
                            className="text-xs px-2.5 py-1.5 rounded-xl border border-border text-muted-foreground hover:bg-muted/50 transition-all">
                            🔄 อัดใหม่
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="px-4 pb-3">
                      <textarea
                        value={qState.note}
                        onChange={(e) => setQ(key, { note: e.target.value })}
                        rows={2}
                        placeholder="จดบันทึกคำตอบ / ข้อสังเกต..."
                        className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-white/80 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={saving}
        className={cn(
          "w-full py-3.5 rounded-2xl font-bold text-sm transition-all",
          saving
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-lavender text-lavender-foreground hover:opacity-90 shadow-md"
        )}>
        {saving ? "⏳ กำลังบันทึก..." : "💾 ส่งผลสัมภาษณ์"}
      </button>
      <p className="text-center text-xs text-muted-foreground -mt-2 pb-1">
        🎙️ เสียงที่บันทึกจะหายไปเมื่อปิดหน้านี้ — กดส่งผลก่อนออก
      </p>
    </div>
  );
}

/* ════════════════════════════════ ADMIN RESULTS ════════════════════════════════ */
const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
}

function InterviewResults() {
  const sessions  = useInterviews();
  const [sub, setSub] = useState<"summary" | "sessions">("summary");

  return (
    <div className="space-y-4">
      {/* sub-tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setSub("summary")}
          className={cn("px-4 py-1.5 rounded-xl text-xs font-semibold transition-all border-2",
            sub === "summary"
              ? "bg-mint/20 border-mint-foreground/30 text-mint-foreground"
              : "bg-white/70 border-border text-muted-foreground hover:bg-muted/50"
          )}>
          📊 สรุปรายข้อคำถาม
        </button>
        <button
          onClick={() => setSub("sessions")}
          className={cn("px-4 py-1.5 rounded-xl text-xs font-semibold transition-all border-2",
            sub === "sessions"
              ? "bg-lavender/30 border-lavender-foreground/40 text-lavender-foreground"
              : "bg-white/70 border-border text-muted-foreground hover:bg-muted/50"
          )}>
          👤 รายบุคคล ({sessions.length})
        </button>
      </div>

      {sub === "summary" ? <QuestionSummary sessions={sessions} /> : <SessionList sessions={sessions} />}
    </div>
  );
}

/* ── Summary by question ── */
interface AnswerRow {
  userName: string;
  userRole: string;
  submittedAt: string;
  note: string;
  audioBase64?: string;
}

function QuestionSummary({ sessions }: { sessions: InterviewSession[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (sessions.length === 0) {
    return <div className="card-soft p-10 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลการสัมภาษณ์</div>;
  }

  /* Build map: "si-qi" → AnswerRow[] */
  const map = new Map<string, AnswerRow[]>();
  for (const session of sessions) {
    for (const a of session.answers) {
      const k = makeKey(a.si, a.qi);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push({
        userName: session.userName,
        userRole: session.userRole,
        submittedAt: session.submittedAt,
        note: a.note,
        audioBase64: a.audioBase64,
      });
    }
  }

  const SECTION_STYLE: Record<string, { banner: string; num: string }> = {
    sky:      { banner: "bg-sky/15 border-sky/40",           num: "bg-sky text-sky-foreground" },
    lemon:    { banner: "bg-lemon/20 border-lemon/40",       num: "bg-lemon text-lemon-foreground" },
    mint:     { banner: "bg-mint/15 border-mint/40",         num: "bg-mint text-mint-foreground" },
    lavender: { banner: "bg-lavender/15 border-lavender/40", num: "bg-lavender text-lavender-foreground" },
    pink:     { banner: "bg-pink/15 border-pink/40",         num: "bg-pink text-pink-foreground" },
  };

  let globalQ = 0;

  return (
    <div className="space-y-4">
      {SECTIONS.map((section, si) => {
        const style = SECTION_STYLE[section.color] ?? SECTION_STYLE.sky;
        return (
          <div key={si} className="card-soft overflow-hidden">
            <div className={cn("border-b px-5 py-3 flex items-center gap-3", style.banner)}>
              <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0", style.num)}>
                {si + 1}
              </span>
              <p className="text-sm font-bold text-foreground">{section.title}</p>
            </div>

            <div className="px-4 py-3 space-y-2">
              {section.questions.map((q, qi) => {
                globalQ++;
                const key   = makeKey(si, qi);
                const rows  = map.get(key) ?? [];
                const withNote  = rows.filter((r) => r.note.trim()).length;
                const withAudio = rows.filter((r) => r.audioBase64).length;
                const isOpen = openKey === key;

                return (
                  <div key={qi} className="rounded-2xl border border-border/50 overflow-hidden bg-white/70">
                    <button
                      type="button"
                      onClick={() => setOpenKey(isOpen ? null : key)}
                      className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-all">
                      <p className="text-sm font-semibold text-foreground leading-snug">
                        <span className="text-primary font-black mr-2">{globalQ}.</span>{q.text}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        {withAudio > 0 && (
                          <span className="bg-pink/15 text-pink-foreground rounded-lg px-2 py-0.5 text-xs font-medium">🎤 {withAudio}</span>
                        )}
                        {withNote > 0 && (
                          <span className="bg-sky/15 text-sky-foreground rounded-lg px-2 py-0.5 text-xs font-medium">📝 {withNote}</span>
                        )}
                        <span className="text-xs text-muted-foreground">{isOpen ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border/30 divide-y divide-border/20">
                        {rows.length === 0 && (
                          <p className="px-4 py-3 text-xs text-muted-foreground italic">ไม่มีคำตอบสำหรับข้อนี้</p>
                        )}
                        {rows.map((r, ri) => (
                          <div key={ri} className="px-4 py-3 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">
                              {r.userName} · {r.userRole} · {fmtDate(r.submittedAt)}
                            </p>
                            {r.audioBase64 && (
                              <audio src={r.audioBase64} controls className="h-8 w-full max-w-xs" />
                            )}
                            {r.note.trim() && (
                              <div className="bg-sky/10 rounded-xl px-3 py-2 text-xs text-foreground/80 italic">
                                📝 {r.note}
                              </div>
                            )}
                            {!r.audioBase64 && !r.note.trim() && (
                              <p className="text-xs text-muted-foreground italic">— ไม่มีข้อมูล</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Session list (per person) ── */
function SessionList({ sessions }: { sessions: InterviewSession[] }) {
  const sorted = [...sessions].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {sessions.length === 0 && (
        <div className="card-soft p-10 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลการสัมภาษณ์</div>
      )}
      {sorted.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          expanded={open === session.id}
          onToggle={() => setOpen(open === session.id ? null : session.id)}
        />
      ))}
    </div>
  );
}

function SessionCard({
  session, expanded, onToggle,
}: { session: InterviewSession; expanded: boolean; onToggle: () => void }) {
  const withNotes = session.answers.filter((a) => a.note.trim()).length;
  const withAudio = session.totalRecorded;

  return (
    <div className="border border-border/50 rounded-2xl overflow-hidden bg-white/60">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-all">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-lavender/30 grid place-items-center text-sm font-bold text-lavender-foreground shrink-0">
            {session.userName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{session.userName}</p>
            <p className="text-xs text-muted-foreground">{session.userRole} · {fmtDate(session.submittedAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
          {withAudio > 0 && (
            <span className="bg-pink/15 text-pink-foreground rounded-lg px-2 py-0.5 font-medium">🎤 {withAudio} เสียง</span>
          )}
          {withNotes > 0 && (
            <span className="bg-sky/15 text-sky-foreground rounded-lg px-2 py-0.5 font-medium">📝 {withNotes} บันทึก</span>
          )}
          <span>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/30 divide-y divide-border/20">
          {session.answers.map((a, i) => {
            const hasContent = a.note.trim() || a.audioBase64;
            if (!hasContent) return null;
            return (
              <div key={i} className="px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">{a.sectionTitle}</p>
                <p className="text-sm font-medium text-foreground leading-snug">
                  <span className="text-primary font-black mr-1.5">{i + 1}.</span>{a.questionText}
                </p>
                {a.audioBase64 && (
                  <audio src={a.audioBase64} controls className="h-8 w-full max-w-xs" />
                )}
                {a.note && (
                  <div className="bg-sky/10 rounded-xl px-3 py-2 text-xs text-foreground/80 italic">
                    📝 {a.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
