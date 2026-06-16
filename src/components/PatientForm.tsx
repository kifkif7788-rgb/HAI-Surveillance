import { type ReactNode } from "react";
import { type PatientRecord } from "@/lib/hai-types";
import { useWardNames } from "@/lib/ward-store";
import { ThaiDatePicker } from "@/components/ui/ThaiDatePicker";
import { cn } from "@/lib/utils";

interface Props {
  data: PatientRecord;
  onChange: (p: Partial<PatientRecord>) => void;
}

export function PatientForm({ data, onChange }: Props) {
  const wards = useWardNames();
  return (
    <section className="card-soft p-5 lg:p-6 relative">
      {/* Section badge */}
      <div className="absolute -top-3.5 left-5 bg-pink text-pink-foreground rounded-full px-5 py-1 text-sm font-bold shadow-md flex items-center gap-1.5">
        🧸 ข้อมูลผู้ป่วย
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">

        {/* 1. HN */}
        <Field label="1. HN *">
          <IconInput icon="👤">
            <input
              value={data.hn}
              onChange={(e) => onChange({ hn: e.target.value })}
              placeholder="กรอก HN"
              className={inputCls}
            />
          </IconInput>
        </Field>

        {/* 2. AN */}
        <Field label="2. AN *">
          <IconInput icon="📋">
            <input
              value={data.an}
              onChange={(e) => onChange({ an: e.target.value })}
              placeholder="กรอก AN"
              className={inputCls}
            />
          </IconInput>
        </Field>

        {/* 3. ชื่อ */}
        <Field label="3. ชื่อ">
          <IconInput icon="🧒">
            <input
              value={data.firstName ?? ""}
              onChange={(e) => onChange({ firstName: e.target.value })}
              placeholder="ชื่อ"
              className={inputCls}
            />
          </IconInput>
        </Field>

        {/* 4. นามสกุล */}
        <Field label="4. นามสกุล">
          <IconInput icon="🧒">
            <input
              value={data.lastName ?? ""}
              onChange={(e) => onChange({ lastName: e.target.value })}
              placeholder="นามสกุล"
              className={inputCls}
            />
          </IconInput>
        </Field>

        {/* 5. อายุ */}
        <Field label="5. อายุ (ปี) *">
          <IconInput icon="😊">
            <input
              type="number"
              step="0.1"
              min="0"
              value={data.age}
              onChange={(e) => onChange({ age: e.target.value === "" ? "" : Number(e.target.value) })}
              placeholder="0"
              className={inputCls}
            />
          </IconInput>
        </Field>

        {/* 5. เลขเตียง */}
        <Field label="6. เลขเตียง">
          <IconInput icon="🛏️">
            <input
              value={data.bed}
              onChange={(e) => onChange({ bed: e.target.value })}
              placeholder="เตียง"
              className={inputCls}
            />
          </IconInput>
        </Field>

        {/* 4. เพศ */}
        <Field label="7. เพศ *">
          <div className="flex gap-2">
            {(["male", "female"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ sex: s })}
                className={cn(
                  "flex-1 px-3 py-2 rounded-2xl border-2 transition-all text-sm font-semibold flex items-center justify-center gap-1.5",
                  data.sex === s
                    ? s === "male"
                      ? "bg-sky border-sky-foreground/50 text-sky-foreground shadow-md scale-[1.03]"
                      : "bg-pink border-pink-foreground/50 text-pink-foreground shadow-md scale-[1.03]"
                    : "bg-white/60 border-border hover:bg-muted"
                )}>
                <span className="text-base">{s === "male" ? "👦" : "👧"}</span>
                {s === "male" ? "ชาย" : "หญิง"}
              </button>
            ))}
          </div>
        </Field>

        {/* 6. หอผู้ป่วย */}
        <Field label="8. หอผู้ป่วย *" className="sm:col-span-2 lg:col-span-3">
          <div className="flex flex-wrap gap-1.5">
            {wards.map((w) => (
              <button
                type="button"
                key={w}
                onClick={() => onChange({ ward: w })}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-full border-2 transition-all font-medium",
                  data.ward === w
                    ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                    : "bg-white/80 border-border hover:bg-sky/30 hover:border-sky-foreground/30"
                )}>
                {w}
              </button>
            ))}
          </div>
        </Field>

        {/* 7. วัน Admit */}
        <Field label="9. วันแรกของการนอนโรงพยาบาล (Admit) *" className="lg:col-span-2">
          <ThaiDatePicker
            value={data.admitDate}
            onChange={(iso) => onChange({ admitDate: iso })}
            placeholder="วัน เดือน ปี (พ.ศ.)"
          />
        </Field>

        {/* 8. วัน DOE */}
        <Field label="10. วันแรกที่มีอาการแสดงการติดเชื้อ (DOE) *" className="lg:col-span-2">
          <ThaiDatePicker
            value={data.doeDate}
            onChange={(iso) => onChange({ doeDate: iso })}
            placeholder="วัน เดือน ปี (พ.ศ.)"
          />
        </Field>

        {/* จำนวนยาฆ่าเชื้อ */}
        <Field label="จำนวนยาฆ่าเชื้อที่ได้รับ (ตลอดการแอดมิท)" className="sm:col-span-2 lg:col-span-2">
          <IconInput icon="💊">
            <input
              type="number"
              min="0"
              step="1"
              value={data.antibioticCount ?? ""}
              onChange={(e) => onChange({ antibioticCount: e.target.value === "" ? "" : Math.max(0, Math.floor(Number(e.target.value))) })}
              placeholder="0 (จำนวนชนิด/ตัว)"
              className={inputCls}
            />
          </IconInput>
        </Field>

        {/* 9. การวินิจฉัยแรกรับ */}
        <Field label="11. การวินิจฉัยแรกรับ" className="sm:col-span-2 lg:col-span-2">
          <div className="relative">
            <textarea
              value={data.firstDx}
              onChange={(e) => onChange({ firstDx: e.target.value })}
              placeholder="กรอกการวินิจฉัยแรกรับ..."
              rows={2}
              className={cn(inputCls, "resize-none pr-10")}
            />
            <span className="absolute right-3 top-3 text-base opacity-40 pointer-events-none select-none">✏️</span>
          </div>
        </Field>

        {/* การวินิจฉัยสุดท้าย */}
        <Field label="11.1 การวินิจฉัยสุดท้าย" className="sm:col-span-2 lg:col-span-2">
          <div className="relative">
            <textarea
              value={data.lastDx ?? ""}
              onChange={(e) => onChange({ lastDx: e.target.value })}
              placeholder="กรอกการวินิจฉัยสุดท้าย..."
              rows={2}
              className={cn(inputCls, "resize-none pr-10")}
            />
            <span className="absolute right-3 top-3 text-base opacity-40 pointer-events-none select-none">📝</span>
          </div>
        </Field>

        {/* ผลการรักษา */}
        <Field label="12. ผลการรักษา" className="sm:col-span-2 lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            {([
              { value: "home",     label: "กลับบ้าน",       emoji: "🏠" },
              { value: "admit",    label: "ยังคง Admit",     emoji: "🛏️" },
              { value: "deceased", label: "เสียชีวิต",       emoji: "⚠️" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ outcome: data.outcome === opt.value ? undefined : opt.value })}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-2xl border-2 text-sm font-semibold transition-all",
                  data.outcome === opt.value
                    ? opt.value === "deceased"
                      ? "bg-pink border-pink-foreground/50 text-pink-foreground shadow-md scale-[1.03]"
                      : opt.value === "admit"
                      ? "bg-lemon border-lemon-foreground/50 text-lemon-foreground shadow-md scale-[1.03]"
                      : "bg-mint border-mint-foreground/50 text-mint-foreground shadow-md scale-[1.03]"
                    : "bg-white/60 border-border hover:bg-muted",
                )}>
                <span>{opt.emoji}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

      </div>
    </section>
  );
}

/* ── helpers ── */

const inputCls =
  "w-full px-3 py-2 pr-9 rounded-xl border border-border bg-white/80 focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-shadow placeholder:text-muted-foreground/60";

function IconInput({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base opacity-40 pointer-events-none select-none">
        {icon}
      </span>
    </div>
  );
}

function Field({
  label, children, className,
}: {
  label: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-xs font-semibold text-muted-foreground leading-tight">{label}</label>
      {children}
    </div>
  );
}
