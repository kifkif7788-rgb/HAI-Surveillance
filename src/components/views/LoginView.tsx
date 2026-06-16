import { useState } from "react";
import { toast } from "sonner";
import { User as UserIcon, Lock, LogIn, Eye, EyeOff } from "lucide-react";
import mascot from "@/assets/mascot.png";
import { login } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

export function LoginView() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow]         = useState(false);
  const [busy, setBusy]         = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }
    setBusy(true);
    // tiny delay for UX feedback
    setTimeout(() => {
      const user = login(username, password);
      setBusy(false);
      if (!user) {
        toast.error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        return;
      }
      toast.success(`ยินดีต้อนรับ ${user.name} 🎉`);
    }, 300);
  };

  return (
    <div className="min-h-screen grid place-items-center p-4">
      {/* floating decorations */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden select-none">
        <span className="absolute text-4xl opacity-40" style={{ top: "12%", left: "10%" }}>🌸</span>
        <span className="absolute text-5xl opacity-30" style={{ top: "20%", right: "12%" }}>🌈</span>
        <span className="absolute text-4xl opacity-40" style={{ bottom: "14%", left: "16%" }}>🐰</span>
        <span className="absolute text-3xl opacity-40" style={{ bottom: "20%", right: "18%" }}>🌿</span>
        <span className="absolute text-2xl opacity-30" style={{ top: "44%", left: "6%" }}>⭐</span>
        <span className="absolute text-2xl opacity-30" style={{ top: "60%", right: "8%" }}>✨</span>
      </div>

      <div className="relative w-full max-w-sm">
        {/* Rainbow top accent */}
        <div
          className="h-1.5 rounded-t-3xl mx-4"
          style={{ background: "linear-gradient(90deg,oklch(0.85 0.18 350),oklch(0.88 0.18 40),oklch(0.92 0.17 90),oklch(0.88 0.14 150),oklch(0.84 0.13 220),oklch(0.84 0.11 280),oklch(0.85 0.13 310))" }}
        />

        <div className="card-soft p-7 -mt-0.5">
          {/* Logo */}
          <div className="flex flex-col items-center text-center mb-6">
            <img src={mascot} width={72} height={72} alt="" className="rounded-full ring-4 ring-sky/30 bg-sky/10 shadow-sm" />
            <h1 className="mt-3 text-xl font-bold text-primary">HAI Surveillance</h1>
            <p className="text-xs text-muted-foreground">ระบบเฝ้าระวังการติดเชื้อในโรงพยาบาลเด็ก</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground/60">ชื่อผู้ใช้</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="กรอกชื่อผู้ใช้"
                  autoComplete="username"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground/60">รหัสผ่าน</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  autoComplete="current-password"
                  className={cn(inputCls, "pr-10")}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted-foreground/60 hover:bg-muted transition-colors"
                  aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="btn-soft w-full justify-center bg-primary text-primary-foreground py-2.5 mt-1 disabled:opacity-60">
              <LogIn className="w-4 h-4" />
              {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          {/* Demo hint */}
          <div className="mt-5 pt-4 border-t border-border/50 text-center">
            <p className="text-[11px] text-muted-foreground">
              บัญชีทดลอง: <span className="font-semibold text-foreground/70">admin</span> / <span className="font-semibold text-foreground/70">1234</span>
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-4">v1.0 • โรงพยาบาลเด็ก 💖</p>
      </div>
    </div>
  );
}

const inputCls =
  "w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-white/80 text-sm transition-shadow " +
  "focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50";
