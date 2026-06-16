import type { PatientRecord } from "@/lib/hai-types";
import { cn } from "@/lib/utils";

export type Updater = (p: Partial<PatientRecord>) => void;

export function SiteCard({ title, emoji, color, children }: { title: string; emoji: string; color: string; children: React.ReactNode }) {
  return (
    <section className="card-soft p-5 relative">
      <div className={cn("absolute -top-3 left-5 rounded-full px-4 py-1 text-sm font-semibold shadow", color)}>
        {emoji} {title}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function Radio({ checked, label, onChange, hint }: { checked: boolean; label: string; onChange: () => void; hint?: string }) {
  return (
    <button type="button" onClick={onChange} className={cn(
      "w-full text-left p-3 rounded-2xl border-2 flex items-start gap-3 transition-all",
      checked ? "bg-sky/40 border-primary" : "bg-white/60 border-transparent hover:bg-muted"
    )}>
      <span className={cn("mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 grid place-items-center",
        checked ? "bg-primary border-primary" : "border-border")}>
        {checked && <span className="w-2 h-2 rounded-full bg-white" />}
      </span>
      <span>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </span>
    </button>
  );
}

/** Toggle styled like Radio (pill button) but with a square ✓ indicator — for checkbox semantics. */
export function CheckButton({ checked, label, onChange, hint }: { checked: boolean; label: string; onChange: () => void; hint?: string }) {
  return (
    <button type="button" onClick={onChange} className={cn(
      "w-full text-left p-3 rounded-2xl border-2 flex items-start gap-3 transition-all",
      checked ? "bg-sky/40 border-primary" : "bg-white/60 border-transparent hover:bg-muted"
    )}>
      <span className={cn("mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 grid place-items-center",
        checked ? "bg-primary border-primary" : "border-border")}>
        {checked && <span className="text-white text-[11px] leading-none font-bold">✓</span>}
      </span>
      <span>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </span>
    </button>
  );
}

export function Check({ checked, label, onChange, disabled }: { checked: boolean; label: string; onChange: () => void; disabled?: boolean }) {
  return (
    <label className={cn(
      "flex items-start gap-2 p-2.5 rounded-xl transition",
      disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      checked && !disabled ? "bg-mint/40" : !disabled ? "hover:bg-muted" : ""
    )}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={() => { if (!disabled) onChange(); }} className="mt-1 accent-primary w-4 h-4" />
      <span className="text-sm">{label}</span>
    </label>
  );
}

export function toggle<T>(arr: T[] | undefined, v: T): T[] {
  const a = arr ?? [];
  return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
}