import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Pencil, Trash2, ShieldCheck, ShieldOff, Eye, EyeOff, Building2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  useUsers, createUser, updateUser, deleteUser, generateWardAccounts, type User,
} from "@/lib/auth-store";
import { useWardNames, wardNames } from "@/lib/ward-store";
import { OR_DEPTS } from "@/lib/or-store";
import { cn } from "@/lib/utils";

const EMOJI_CHOICES = ["👩‍⚕️", "👨‍⚕️", "🧑‍⚕️", "🧑‍💻", "👩‍💼", "👨‍💼", "🧸", "🐰"];
const OTHER_DEPTS = ["OPD", "แพทย์ที่ปรึกษา", "หัวหน้างาน/ที่ปรึกษา", "LAP", "แผนกอื่นๆ"];

export function UsersView({ currentUserId }: { currentUserId: string }) {
  const users = useUsers();
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [toDelete, setToDelete] = useState<User | null>(null);

  const confirmDelete = () => {
    if (!toDelete) return;
    const res = deleteUser(toDelete.id);
    if (!res.ok) toast.error(res.error);
    else toast.success(`ลบผู้ใช้ ${toDelete.name} แล้ว`);
    setToDelete(null);
  };

  return (
    <div className="card-soft p-5">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="font-bold text-primary">👥 จัดการผู้ใช้ ({users.length})</div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const { created } = generateWardAccounts(wardNames());
              if (created === 0) toast.info("ทุกแผนกมีบัญชีอยู่แล้ว");
              else toast.success(`สร้างบัญชีรายแผนกใหม่ ${created} บัญชี`);
            }}
            className="btn-soft bg-mint text-mint-foreground gap-2 px-4 text-sm"
            title="สร้างบัญชี 1 บัญชีต่อแผนกที่ยังไม่มี">
            <Building2 className="w-4 h-4" />
            สร้างบัญชีรายแผนก
          </button>
          <button
            onClick={() => setEditing("new")}
            className="btn-soft bg-primary text-primary-foreground gap-2 px-4 text-sm">
            <UserPlus className="w-4 h-4" />
            เพิ่มผู้ใช้
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          return (
            <div key={u.id} className="rounded-2xl p-4 bg-white border border-border/60 flex flex-col">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-sky/20 grid place-items-center text-2xl shrink-0">{u.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-foreground truncate">{u.name}</span>
                    {isSelf && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-lemon/60 text-lemon-foreground font-semibold">คุณ</span>}
                  </div>
                  <div className="text-xs text-foreground/60 truncate">@{u.username}</div>
                  <div className="text-xs text-foreground/60 truncate">{u.role || "—"}</div>
                </div>
              </div>

              {/* password (admin-visible) */}
              <PasswordRow password={u.password} />

              <div className="mt-3 flex items-center justify-between">
                <span className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full",
                  u.isAdmin ? "bg-pink/50 text-pink-foreground" : "bg-muted text-foreground/60"
                )}>
                  {u.isAdmin ? <ShieldCheck className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                  {u.isAdmin ? "แอดมิน" : "ผู้ใช้ทั่วไป"}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditing(u)}
                    className="p-2 rounded-lg hover:bg-sky/30 text-sky-foreground"
                    aria-label="แก้ไข">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setToDelete(u)}
                    disabled={isSelf}
                    className="p-2 rounded-lg hover:bg-pink/30 text-pink-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="ลบ"
                    title={isSelf ? "ไม่สามารถลบบัญชีของตนเองได้" : "ลบ"}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit dialog */}
      {editing !== null && (
        <UserFormDialog
          user={editing === "new" ? null : editing}
          isSelf={editing !== "new" && editing.id === currentUserId}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Delete confirm */}
      <Dialog open={toDelete !== null} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader>
            <div className="mx-auto text-4xl mb-1">🗑️</div>
            <DialogTitle className="text-center">ลบผู้ใช้</DialogTitle>
            <DialogDescription className="text-center">
              ต้องการลบ <span className="font-semibold text-foreground">{toDelete?.name}</span> (@{toDelete?.username}) ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button onClick={() => setToDelete(null)} className="btn-soft bg-muted text-foreground flex-1 justify-center">ยกเลิก</button>
            <button onClick={confirmDelete} className="btn-soft bg-pink text-pink-foreground flex-1 justify-center">ลบ</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Password row (admin-visible, with reveal toggle + copy) ── */
function PasswordRow({ password }: { password?: string }) {
  const [show, setShow] = useState(false);

  if (!password) {
    return (
      <div className="mt-2.5 text-[11px] text-muted-foreground">
        รหัสผ่าน: <span className="italic">— (ถูกเข้ารหัส ดูไม่ได้)</span>
      </div>
    );
  }

  return (
    <div className="mt-2.5 flex items-center gap-2 bg-muted/50 rounded-lg px-2.5 py-1.5">
      <span className="text-[11px] text-foreground/60 shrink-0">รหัสผ่าน</span>
      <code className="text-xs font-bold text-foreground tabular-nums tracking-wide truncate flex-1">
        {show ? password : "•".repeat(Math.min(password.length, 10))}
      </code>
      <button
        onClick={() => setShow((s) => !s)}
        className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={() => { navigator.clipboard?.writeText(password); toast.success("คัดลอกรหัสผ่านแล้ว"); }}
        className="text-[10px] text-primary font-semibold px-1.5 py-0.5 rounded hover:bg-sky/20 transition-colors shrink-0">
        คัดลอก
      </button>
    </div>
  );
}

/* ── Add / Edit form dialog ── */
function UserFormDialog({
  user, isSelf, onClose,
}: {
  user: User | null;     // null = create
  isSelf: boolean;
  onClose: () => void;
}) {
  const isEdit = user !== null;
  const wards = useWardNames();
  const [username, setUsername] = useState(user?.username ?? "");
  const [name, setName]         = useState(user?.name ?? "");
  const [role, setRole]         = useState(user?.role ?? "");
  const [emoji, setEmoji]       = useState(user?.emoji ?? EMOJI_CHOICES[0]);
  const [isAdmin, setIsAdmin]   = useState(user?.isAdmin ?? false);
  const [password, setPassword] = useState("");

  const save = () => {
    if (isEdit) {
      const res = updateUser(user!.id, { name, role, emoji, isAdmin, password });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("บันทึกการแก้ไขแล้ว");
    } else {
      const res = createUser({ username, name, role, emoji, isAdmin, password });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`เพิ่มผู้ใช้ ${name || username} แล้ว`);
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}</DialogTitle>
          <DialogDescription>
            {isEdit ? `กำลังแก้ไข @${user!.username}` : "กรอกข้อมูลเพื่อสร้างบัญชีผู้ใช้"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          {/* emoji picker */}
          <Field label="รูปประจำตัว">
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "w-10 h-10 rounded-xl text-xl grid place-items-center border-2 transition-all",
                    emoji === e ? "bg-sky/40 border-sky-foreground/50 scale-105" : "bg-white border-border hover:bg-muted"
                  )}>
                  {e}
                </button>
              ))}
            </div>
          </Field>

          <Field label="ชื่อผู้ใช้ (username) *">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isEdit}
              placeholder="เช่น nurse01"
              className={cn(inputCls, isEdit && "opacity-60 cursor-not-allowed")}
            />
            {isEdit && <p className="text-[11px] text-muted-foreground mt-1">ไม่สามารถเปลี่ยนชื่อผู้ใช้ได้</p>}
          </Field>

          <Field label="ชื่อ-นามสกุล">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อที่แสดง" className={inputCls} />
          </Field>

          <Field label="แผนก / หอผู้ป่วย">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={cn(inputCls, "cursor-pointer", !role && "text-muted-foreground/50")}>
              <option value="">เลือกแผนก / หอผู้ป่วย</option>
              <optgroup label="หอผู้ป่วย">
                {wards.map((w) => (
                  <option key={w} value={w} className="text-foreground">{w}</option>
                ))}
              </optgroup>
              <optgroup label="ห้องผ่าตัด (OR)">
                {OR_DEPTS.map((d) => (
                  <option key={d} value={d} className="text-foreground">{d}</option>
                ))}
              </optgroup>
              <optgroup label="หน่วยงานอื่น">
                {OTHER_DEPTS.map((d) => (
                  <option key={d} value={d} className="text-foreground">{d}</option>
                ))}
              </optgroup>
            </select>
          </Field>

          <Field label={isEdit ? "รหัสผ่านใหม่ (เว้นว่างหากไม่เปลี่ยน)" : "รหัสผ่าน *"}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? "••••••" : "อย่างน้อย 4 ตัวอักษร"}
              autoComplete="new-password"
              className={inputCls}
            />
          </Field>

          {/* admin toggle */}
          <label className={cn(
            "flex items-center gap-3 rounded-xl border-2 p-3 transition-all",
            isSelf ? "opacity-60 cursor-not-allowed bg-muted/40 border-border" : "cursor-pointer bg-white border-border hover:bg-muted/40"
          )}>
            <input
              type="checkbox"
              checked={isAdmin}
              disabled={isSelf}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-pink-foreground" />
                สิทธิ์แอดมิน
              </div>
              <div className="text-[11px] text-muted-foreground">จัดการผู้ใช้และเข้าถึงทุกหน้าได้</div>
            </div>
          </label>
          {isSelf && <p className="text-[11px] text-muted-foreground -mt-2">ไม่สามารถเปลี่ยนสิทธิ์ของบัญชีตนเองได้</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 mt-2">
          <button onClick={onClose} className="btn-soft bg-muted text-foreground flex-1 justify-center">ยกเลิก</button>
          <button onClick={save} className="btn-soft bg-primary text-primary-foreground flex-1 justify-center">
            {isEdit ? "บันทึก" : "เพิ่มผู้ใช้"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-xl border border-border bg-white text-sm transition-shadow " +
  "focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-foreground/60">{label}</label>
      {children}
    </div>
  );
}
