import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน",
  "พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม",
  "กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];
const MONTHS_SHORT = [
  "ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
  "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค.",
];
const DAYS = ["อา","จ","อ","พ","พฤ","ศ","ส"];

const POPUP_W  = 280;
const POPUP_H  = 355; // estimated calendar height

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseIso(iso: string): Date | null {
  if (!iso || iso.length < 10) return null;
  const d = new Date(iso + "T12:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function toIso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function formatDateThai(iso: string, short = false): string {
  const d = parseIso(iso);
  if (!d) return "—";
  const m = short ? MONTHS_SHORT[d.getMonth()] : MONTHS[d.getMonth()];
  return `${d.getDate()} ${m} ${d.getFullYear() + 543}`;
}

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
}

export function ThaiDatePicker({
  value,
  onChange,
  placeholder = "วว เดือน ปปปป",
}: Props) {
  const today    = new Date();
  const selected = parseIso(value);

  const [open, setOpen]           = useState(false);
  const [viewYear, setViewYear]   = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth()    ?? today.getMonth());
  const [editYear, setEditYear]   = useState(false);
  const [yearDraft, setYearDraft] = useState("");

  // popup position (fixed, relative to viewport)
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false });

  const triggerRef   = useRef<HTMLButtonElement>(null);
  const popupRef     = useRef<HTMLDivElement>(null);
  const yearInputRef = useRef<HTMLInputElement>(null);

  // ── position calculation ───────────────────────────────────────────────────
  const calcPos = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;

    const spaceBelow = window.innerHeight - r.bottom;
    const openUp     = spaceBelow < POPUP_H + 10;

    let top  = openUp ? r.top - POPUP_H - 2 : r.bottom + 2;
    let left = r.left;

    // clamp horizontally
    if (left + POPUP_W > window.innerWidth - 8) left = window.innerWidth - POPUP_W - 8;
    if (left < 8) left = 8;

    setPos({ top, left, openUp });
  };

  // ── close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !popupRef.current?.contains(t)) {
        setOpen(false);
        setEditYear(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  // ── close on any scroll (trigger has moved) ───────────────────────────────
  useEffect(() => {
    if (!open) return;
    const fn = () => { setOpen(false); setEditYear(false); };
    window.addEventListener("scroll", fn, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", fn, { capture: true });
  }, [open]);

  // ── focus year input ──────────────────────────────────────────────────────
  useEffect(() => { if (editYear) yearInputRef.current?.select(); }, [editYear]);

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleOpen = () => {
    if (open) { setOpen(false); return; }
    if (selected) { setViewYear(selected.getFullYear()); setViewMonth(selected.getMonth()); }
    calcPos();
    setOpen(true);
    setEditYear(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const commitYear = () => {
    const be = parseInt(yearDraft);
    if (!isNaN(be) && be >= 2400 && be <= 2600) setViewYear(be - 543);
    setEditYear(false);
  };

  const pickDay = (day: number) => { onChange(toIso(viewYear, viewMonth, day)); setOpen(false); };
  const pickToday = () => { onChange(toIso(today.getFullYear(), today.getMonth(), today.getDate())); setOpen(false); };

  // ── calendar grid ─────────────────────────────────────────────────────────
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevTotal   = new Date(viewYear, viewMonth, 0).getDate();

  type Cell = { d: number; cur: boolean };
  const cells: Cell[] = [];
  for (let i = firstDow - 1; i >= 0; i--) cells.push({ d: prevTotal - i, cur: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ d, cur: true });
  const rem = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let d = 1; d <= rem; d++) cells.push({ d, cur: false });

  // ── popup (rendered via portal → always on top) ───────────────────────────
  const popup = open ? createPortal(
    <div
      ref={popupRef}
      style={{ position: "fixed", top: pos.top, left: pos.left, width: POPUP_W, zIndex: 9999,
               boxShadow: "0 20px 60px -8px oklch(0.55 0.12 280 / 0.32), 0 4px 16px oklch(0.55 0.1 280 / 0.14)" }}
      className="bg-white rounded-2xl p-3.5 border border-border/40 select-none">

      {/* Month / Year header */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth}
          className="w-8 h-8 rounded-xl hover:bg-sky/30 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground">{MONTHS[viewMonth]}</span>

          {editYear ? (
            <input
              ref={yearInputRef}
              value={yearDraft}
              onChange={e => setYearDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={e => { if (e.key === "Enter") commitYear(); if (e.key === "Escape") setEditYear(false); }}
              onBlur={commitYear}
              className="w-[52px] text-center border-2 border-primary rounded-lg px-1 py-0.5 text-sm font-bold text-primary focus:outline-none"
            />
          ) : (
            <button type="button"
              onClick={() => { setYearDraft(String(viewYear + 543)); setEditYear(true); }}
              className="text-sm font-bold text-primary hover:bg-primary/10 rounded-lg px-2 py-0.5 transition-colors">
              {viewYear + 543}
            </button>
          )}
        </div>

        <button type="button" onClick={nextMonth}
          className="w-8 h-8 rounded-xl hover:bg-sky/30 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d, i) => (
          <div key={d} className={cn(
            "text-center text-[11px] font-bold py-1",
            i === 0 ? "text-pink-foreground" : i === 6 ? "text-sky-foreground" : "text-muted-foreground"
          )}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-[2px]">
        {cells.map(({ d, cur }, i) => {
          const col     = i % 7;
          const isSun   = col === 0;
          const isSat   = col === 6;
          const isSel   = cur && !!selected
            && selected.getFullYear() === viewYear
            && selected.getMonth()    === viewMonth
            && selected.getDate()     === d;
          const isToday = cur
            && today.getFullYear() === viewYear
            && today.getMonth()    === viewMonth
            && today.getDate()     === d;

          return (
            <button key={i} type="button" disabled={!cur} onClick={() => cur && pickDay(d)}
              className={cn(
                "h-8 w-full rounded-xl text-xs font-medium transition-all",
                !cur       && "text-border/50 cursor-default",
                cur && !isSel && !isToday && "hover:bg-sky/25 active:scale-95",
                cur && isSun && !isSel && "text-pink-foreground",
                cur && isSat && !isSel && "text-sky-foreground",
                isToday && !isSel && "bg-lemon/60 font-bold ring-1 ring-lemon-foreground/40",
                isSel  && "bg-primary text-primary-foreground shadow-md scale-110 font-bold z-10 relative",
              )}>
              {d}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2.5 border-t border-border/30 flex items-center justify-between">
        <button type="button" onClick={pickToday}
          className="text-xs text-primary font-semibold px-2.5 py-1 rounded-lg hover:bg-sky/20 transition-colors">
          📅 วันนี้
        </button>
        {value && (
          <button type="button" onClick={() => { onChange(""); setOpen(false); }}
            className="text-xs text-pink-foreground font-medium px-2.5 py-1 rounded-lg hover:bg-pink/20 transition-colors">
            ล้างข้อมูล
          </button>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={cn(
          "w-full px-3 py-2 rounded-xl border border-border bg-white/80 text-sm",
          "flex items-center justify-between gap-2 transition-all text-left",
          "hover:border-ring/40 focus:outline-none focus:ring-2 focus:ring-ring",
          open && "ring-2 ring-ring/60 border-ring/40"
        )}>
        <span className={value ? "text-foreground" : "text-muted-foreground/50"}>
          {value ? formatDateThai(value) : placeholder}
        </span>
        <CalendarDays className={cn(
          "w-4 h-4 shrink-0 transition-colors",
          open ? "text-primary" : "text-muted-foreground/40"
        )} />
      </button>

      {popup}
    </div>
  );
}
