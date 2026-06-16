import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client + thin JSONB helpers.
 *
 * Data model: each table has columns ( id text PK, data jsonb, updated_at timestamptz ).
 * A row's full domain object is stored in `data` (its own `id` field is mirrored to the PK).
 *
 * The app keeps localStorage as a working cache and syncs with Supabase:
 *   - pull*()  : load all rows from Supabase → cache (on startup / login)
 *   - sbUpsert : write one row
 *   - sbDelete : remove one row
 * If env vars are absent, `supabase` is null and the app runs purely on localStorage.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        realtime: { params: { eventsPerSecond: -1 } },  // disable realtime WebSocket (not used)
      })
    : null;

export const supabaseReady = !!supabase;

export type TableName = "records" | "users" | "monthly" | "or_monthly" | "departments" | "wards" | "kpi_manual";

/** Fetch all rows of a JSONB table → array of domain objects (with id). Returns null if not configured/failed. */
export async function sbAll<T extends { id: string }>(table: TableName): Promise<T[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from(table).select("id, data");
  if (error || !data) return null;
  return data.map((r) => ({ ...(r.data as object), id: r.id })) as T[];
}

/** Insert/update one row. */
export async function sbUpsert<T extends { id: string }>(table: TableName, row: T): Promise<void> {
  if (!supabase) return;
  await supabase.from(table).upsert({ id: row.id, data: row, updated_at: new Date().toISOString() });
}

/** Replace the entire contents of a table with `rows` (upsert all + delete the rest). */
export async function sbReplaceAll<T extends { id: string }>(table: TableName, rows: T[]): Promise<void> {
  if (!supabase) return;
  if (rows.length) {
    await supabase.from(table).upsert(rows.map((r) => ({ id: r.id, data: r, updated_at: new Date().toISOString() })));
  }
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    // delete rows not in the new set — PostgREST expects comma-separated values without quotes
    await supabase.from(table).delete().not("id", "in", `(${ids.join(",")})`);
  } else {
    await supabase.from(table).delete().neq("id", "__none__");
  }
}

export async function sbDelete(table: TableName, id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from(table).delete().eq("id", id);
}
