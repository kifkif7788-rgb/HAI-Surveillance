import { useEffect, useState } from "react";
import { sbAll, sbUpsert } from "./supabase";

export interface InterviewAnswer {
  si: number;
  qi: number;
  sectionTitle: string;
  questionText: string;
  note: string;
  audioBase64?: string;      // data URL — omitted if blob > 1.5 MB base64
  audioDurationSec?: number;
}

export interface InterviewSession {
  id: string;
  submittedAt: string;
  userId: string;
  userName: string;
  userRole: string;
  answers: InterviewAnswer[];
  totalRecorded: number;
}

const KEY   = "hai-interview-sessions-v1";
const EVENT = "hai-interview-changed";

function read(): InterviewSession[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(sessions: InterviewSession[]) {
  localStorage.setItem(KEY, JSON.stringify(sessions));
  window.dispatchEvent(new Event(EVENT));
}

export async function pullInterviews(): Promise<void> {
  const rows = await sbAll<InterviewSession>("interview_sessions");
  if (rows) write(rows);
}

export async function submitInterview(
  session: Omit<InterviewSession, "id" | "submittedAt">
): Promise<void> {
  const full: InterviewSession = {
    ...session,
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
  };
  write([...read(), full]);
  await sbUpsert("interview_sessions", full);
}

export function useInterviews(): InterviewSession[] {
  const [sessions, setSessions] = useState<InterviewSession[]>(() => read());
  useEffect(() => {
    const sync = () => setSessions(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return sessions;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
