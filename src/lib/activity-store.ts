import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export interface ActivityLog {
  id: string;
  userId: string;
  username: string;
  name: string;
  role: string;
  action: "login" | "logout";
  timestamp: string;   // ISO
}

/** บันทึก activity ขึ้น Supabase โดยตรง (append-only, no localStorage) */
export async function logActivity(entry: Omit<ActivityLog, "id" | "timestamp">): Promise<void> {
  if (!supabase) return;
  const row: ActivityLog = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  await supabase.from("activity_log").insert({ id: row.id, data: row, updated_at: row.timestamp });
}

/** ดึงประวัติ (limit ล่าสุด) */
export async function fetchActivityLogs(limit = 200): Promise<ActivityLog[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, data")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({ ...(r.data as object), id: r.id })) as ActivityLog[];
}

/** Reactive hook สำหรับ admin ดู log */
export function useActivityLogs(): { logs: ActivityLog[]; loading: boolean; refresh: () => void } {
  const [logs, setLogs]       = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setLogs(await fetchActivityLogs());
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);
  return { logs, loading, refresh: load };
}
