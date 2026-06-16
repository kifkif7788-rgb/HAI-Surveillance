import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { AppLayout, type ViewKey } from "@/components/AppLayout";
import { RecordView } from "@/components/views/RecordView";
import { PatientListView } from "@/components/views/PatientListView";
import { DashboardView } from "@/components/views/DashboardView";
import { ReportsView, SettingsView } from "@/components/views/SimpleViews";
import { UsersView } from "@/components/views/UsersView";
import { MonthlyDataView } from "@/components/views/MonthlyDataView";
import { KPIView } from "@/components/views/KPIView";
import { LoginView } from "@/components/views/LoginView";
import { pullKPI } from "@/lib/kpi-store";
import { OR_DEPTS, pullOrStats } from "@/lib/or-store";
import { wardNames, syncWards } from "@/lib/ward-store";
import { seedIfEmpty, migrateWards, pullRecords } from "@/lib/hai-store";
import { migrateMonthlyWards, pullMonthly } from "@/lib/monthly-store";
import { seedUsersIfEmpty, useAuth, logout, pullUsers } from "@/lib/auth-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HAI Surveillance – ระบบเฝ้าระวังการติดเชื้อในโรงพยาบาลเด็ก" },
      { name: "description", content: "ระบบบันทึกและประเมินการติดเชื้อในโรงพยาบาลเด็กแบบอัตโนมัติ HAI/CI/VAP/HAP/UTI/BSI/SSI/GI" },
      { property: "og:title", content: "HAI Surveillance" },
      { property: "og:description", content: "Pediatric Infection Surveillance System" },
    ],
  }),
  component: Index,
});

function Index() {
  const [view, setView] = useState<ViewKey>("record");
  const { user, ready } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Pull from Supabase into the local cache first (no-op if not configured)
      await Promise.all([
        pullRecords(), pullMonthly(), pullOrStats(), pullUsers(),
        syncWards(), pullKPI(),
      ]);
      if (cancelled) return;
      seedIfEmpty();         // seed only if still empty after pull
      seedUsersIfEmpty();
      migrateWards();        // patient records: ม.6ก → ม.6ก observe
      migrateMonthlyWards(); // monthly stats: same rename
    })();
    return () => { cancelled = true; };
  }, []);

  const titleMap: Record<ViewKey, string> = {
    record: "บันทึกข้อมูลการติดเชื้อ",
    patients: "รายการผู้ป่วย",
    reports: "รายงานสรุป",
    dashboard: "Dashboard ภาพรวม",
    monthly: "ข้อมูลรายเดือน",
    kpi: "ตัวชี้วัดหลัก (KPI)",
    settings: "ตั้งค่าระบบ",
    users: "จัดการผู้ใช้",
  };

  return (
    <>
      {!ready ? null
        : !user ? <LoginView />
        : (
          <AppLayout view={view} setView={setView} title={titleMap[view]} user={user} onLogout={logout}>
            {view === "record" && <RecordView />}
            {view === "patients" && <PatientListView />}
            {view === "reports" && <ReportsView />}
            {view === "dashboard" && <DashboardView />}
            {view === "monthly" && (user.isAdmin
                || wardNames().includes(user.role)
                || (OR_DEPTS as readonly string[]).includes(user.role)
              ? <MonthlyDataView currentUser={{ isAdmin: user.isAdmin, ward: user.role }} />
              : <AccessDenied />)}
            {view === "kpi" && <KPIView isAdmin={user.isAdmin} />}
            {view === "settings" && <SettingsView isAdmin={user.isAdmin} />}
            {view === "users" && (user.isAdmin
              ? <UsersView currentUserId={user.id} />
              : <AccessDenied />)}
          </AppLayout>
        )}
      <Toaster position="top-right" richColors />
    </>
  );
}

function AccessDenied() {
  return (
    <div className="card-soft p-10 text-center">
      <div className="text-5xl mb-3">🔒</div>
      <div className="font-bold text-primary text-lg">ไม่มีสิทธิ์เข้าถึง</div>
      <p className="text-sm text-muted-foreground mt-1">หน้าจัดการผู้ใช้สงวนสิทธิ์เฉพาะผู้ดูแลระบบ (แอดมิน) เท่านั้น</p>
    </div>
  );
}
