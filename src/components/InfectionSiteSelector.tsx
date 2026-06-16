import { SITES } from "@/lib/hai-types";
import { cn } from "@/lib/utils";

/* Per-color active styling */
const ACTIVE: Record<string, { card: string; badge: string; border: string }> = {
  sky:     { card: "bg-sky/40",     badge: "bg-sky-foreground text-white",     border: "border-sky-foreground/50" },
  lavender:{ card: "bg-lavender/40",badge: "bg-lavender-foreground text-white",border: "border-lavender-foreground/50" },
  pink:    { card: "bg-pink/40",    badge: "bg-pink-foreground text-white",    border: "border-pink-foreground/50" },
  lemon:   { card: "bg-lemon/50",   badge: "bg-lemon-foreground text-white",   border: "border-lemon-foreground/50" },
  mint:    { card: "bg-mint/40",    badge: "bg-mint-foreground text-white",    border: "border-mint-foreground/50" },
};

export function InfectionSiteSelector({
  value, onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <section className="card-soft p-5 relative">
      {/* Badge header */}
      <div className="absolute -top-3.5 left-5 bg-lemon text-lemon-foreground rounded-full px-5 py-1 text-sm font-bold shadow-md flex items-center gap-1.5">
        ☀️ <span>10. สงสัยมีการติดเชื้อในตำแหน่งใด</span>
        <span className="text-xs font-normal opacity-75">(เลือกได้มากกว่า 1)</span>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SITES.map((s) => {
          const active = value.includes(s.id);
          const style  = ACTIVE[s.color] ?? ACTIVE.sky;

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              className={cn(
                "relative flex flex-col items-center text-center gap-2 pt-5 pb-3 px-2 rounded-2xl border-2 transition-all",
                "hover:scale-[1.04] hover:-translate-y-0.5 active:scale-[0.98]",
                active
                  ? cn(style.card, style.border, "shadow-md")
                  : "bg-white/80 border-border/60 hover:bg-white hover:border-border"
              )}>

              {/* Indicator (top-right) */}
              <div className={cn(
                "absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center",
                "transition-all text-[9px] font-black",
                active
                  ? cn("border-transparent shadow-sm", style.badge)
                  : "border-border/50 bg-white"
              )}>
                {active && "✓"}
              </div>

              {/* Icon */}
              <span className="text-[2rem] leading-none">{s.icon}</span>

              {/* Number */}
              <span className={cn(
                "text-[10px] font-bold",
                active ? "text-foreground/70" : "text-muted-foreground"
              )}>{s.id}</span>

              {/* Label */}
              <span className="text-xs font-semibold leading-tight text-foreground">{s.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
