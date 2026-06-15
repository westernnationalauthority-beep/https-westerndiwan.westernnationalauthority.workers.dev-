// ============================================================
// Dashboard.tsx - الهيكل العام للوحة التحكم
// ============================================================

import { useState, useEffect } from "react";
import { type Session } from "../lib/storage";
import { SYSTEM_NAME } from "../constants";
import { type TabName } from "../types";
import { getTheme, toggleTheme, type Theme } from "../lib/theme";
import { countPendingDeletes } from "../lib/employeeStatus";

// استيراد التبويبات - كل تبويب في ملفه المستقل
import { EmployeesTab } from "./tabs/EmployeesTab";
import { ReportsTab } from "./tabs/ReportsTab";
import { CodesTab } from "./tabs/CodesTab";
import { DeleteRequestsTab } from "./tabs/DeleteRequestsTab";
import { ArchiveTab } from "./tabs/ArchiveTab";
import { UsersTab } from "./tabs/UsersTab";
import { LogsTab } from "./tabs/LogsTab";
import { FieldsTab } from "./tabs/FieldsTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { WhatsAppTab } from "./tabs/WhatsAppTab";
import { AboutTab } from "./tabs/AboutTab";
import { MotivationTab } from "./tabs/MotivationTab";

// ──────────────────────────────────────────────
// Dashboard الرئيسي
// ──────────────────────────────────────────────
export function Dashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [tab, setTab] = useState<TabName>("employees");
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const perms = session.permissions;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors">
      <DashboardSidebar 
        session={session} 
        activeTab={tab} 
        setTab={setTab} 
        isOpen={isSidebarOpen} 
        onLogout={onLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardNavbar 
          session={session} 
          isSidebarOpen={isSidebarOpen} 
          setSidebarOpen={setSidebarOpen} 
        />

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto animate-fade-in">
          <div className="max-w-7xl mx-auto">
            {tab === "employees" && <EmployeesTab session={session} />}
            {tab === "reports" && <ReportsTab session={session} />}
            {tab === "motivation" && <MotivationTab session={session} />}
            {tab === "codes" && perms.canManageUsers && <CodesTab session={session} />}
            {tab === "delete_requests" && (perms.canRequestDelete || perms.canApproveDelete) && (
              <DeleteRequestsTab session={session} />
            )}
            {tab === "archive" && (perms.canViewArchive || perms.canRestoreArchive) && (
              <ArchiveTab session={session} />
            )}
            {tab === "users" && perms.canManageUsers && <UsersTab session={session} />}
            {tab === "logs" && perms.canViewLogs && <LogsTab />}
            {tab === "fields" && perms.canAddFields && <FieldsTab session={session} />}
            {tab === "whatsapp" && perms.canManageUsers && <WhatsAppTab session={session} />}
            {tab === "settings" && <SettingsTab session={session} />}
            {tab === "about" && <AboutTab />}
          </div>
        </main>

        <footer className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            © {new Date().getFullYear()} الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية | تصميم وتطوير: <span className="font-bold text-amber-500">{SYSTEM_NAME}</span>
          </p>
        </footer>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Sidebar (عصري ومدمج)
// ──────────────────────────────────────────────
interface SidebarItem {
  id: TabName;
  label: string;
  icon: string;
  show: boolean;
  badge?: number | null;
}

function DashboardSidebar({ 
  session, activeTab, setTab, isOpen, onLogout 
}: { 
  session: Session; activeTab: TabName; setTab: (t: TabName) => void; 
  isOpen: boolean; onLogout: () => void;
}) {
  const perms = session.permissions;
  const [pendingDeletes, setPendingDeletes] = useState(0);

  useEffect(() => {
    if (!perms.canApproveDelete) return;
    const loadPending = () => setPendingDeletes(countPendingDeletes());
    loadPending();
    window.addEventListener("delete-requests-changed", loadPending);
    window.addEventListener("employee-status-changed", loadPending);
    return () => {
      window.removeEventListener("delete-requests-changed", loadPending);
      window.removeEventListener("employee-status-changed", loadPending);
    };
  }, [perms.canApproveDelete]);

  const groups: { title: string; items: SidebarItem[] }[] = [
    {
      title: "الرئيسية",
      items: [
        { id: "employees", label: "الموظفين", icon: "👥", show: true },
        { id: "reports", label: "التقارير", icon: "📈", show: true },
        { id: "motivation", label: "التحفيز", icon: "🏆", show: true },
      ]
    },
    {
      title: "الإدارة",
      items: [
        { id: "codes", label: "الأكواد", icon: "🔑", show: perms.canManageUsers },
        { 
          id: "delete_requests", 
          label: "طلبات الحذف", 
          icon: "📋", 
          show: perms.canRequestDelete || perms.canApproveDelete,
          badge: pendingDeletes > 0 ? pendingDeletes : null
        },
        { id: "archive", label: "الأرشيف", icon: "🗄️", show: perms.canViewArchive || perms.canRestoreArchive },
      ]
    },
    {
      title: "النظام",
      items: [
        { id: "users", label: "المستخدمين", icon: "🔐", show: perms.canManageUsers },
        { id: "logs", label: "السجلات", icon: "📊", show: perms.canViewLogs },
        { id: "fields", label: "الحقول", icon: "➕", show: perms.canAddFields },
        { id: "whatsapp", label: "واتساب", icon: "💬", show: perms.canManageUsers },
      ]
    },
    {
      title: "أخرى",
      items: [
        { id: "settings", label: "الإعدادات", icon: "⚙️", show: true },
        { id: "about", label: "حول", icon: "ℹ️", show: true },
      ]
    }
  ];

  return (
    <aside className={`sticky top-0 h-screen flex flex-col transition-all duration-300 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-50 ${isOpen ? "w-64" : "w-20"}`}>
      {/* Logo Section */}
      <div className="h-16 flex items-center px-5 border-b border-slate-100 dark:border-slate-800 shrink-0 overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-200 dark:shadow-none shrink-0">S</div>
          {isOpen && (
            <div className="min-w-0">
              <p className="font-black text-slate-800 dark:text-white text-sm tracking-tighter">S-BUTTO SYSTEM</p>
              <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest leading-none">Management v2</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-6 scrollbar-none">
        {groups.map((group, idx) => {
          const visibleItems = group.items.filter(i => i.show);
          if (visibleItems.length === 0) return null;

          return (
            <div key={idx} className="space-y-1">
              {isOpen && <p className="px-3 text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">{group.title}</p>}
              {visibleItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative ${
                    activeTab === item.id
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <span className={`text-lg shrink-0 ${activeTab === item.id ? "scale-110" : "group-hover:scale-110 transition-transform"}`}>{item.icon}</span>
                  {isOpen && <span className="text-[13px] font-bold flex-1 text-right">{item.label}</span>}
                  
                  {/* Badge */}
                  {item.badge && (
                    <span className={`absolute ${isOpen ? "left-3" : "left-1 -top-1"} h-5 min-w-[20px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-black border-2 border-white dark:border-slate-900 animate-pulse`}>
                      {item.badge}
                    </span>
                  )}

                  {!isOpen && activeTab === item.id && (
                    <div className="absolute right-0 top-1.5 bottom-1.5 w-1 bg-white rounded-l-full" />
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Logout */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all font-black ${!isOpen && "justify-center"}`}
        >
          <span className="text-lg shrink-0">🚪</span>
          {isOpen && <span className="text-[13px]">تسجيل الخروج</span>}
        </button>
      </div>
    </aside>
  );
}

function DashboardNavbar({ 
  session, isSidebarOpen, setSidebarOpen 
}: { 
  session: Session; isSidebarOpen: boolean; setSidebarOpen: (o: boolean) => void;
}) {
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const handleToggleTheme = () => setThemeState(toggleTheme());

  return (
    <nav className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-4 lg:px-6 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
        >
          <div className="flex flex-col gap-1 items-center justify-center">
            <div className={`h-0.5 bg-current transition-all ${isSidebarOpen ? "w-5 rotate-45 translate-y-1.5" : "w-6"}`} />
            <div className={`h-0.5 bg-current transition-all ${isSidebarOpen ? "w-0 opacity-0" : "w-6"}`} />
            <div className={`h-0.5 bg-current transition-all ${isSidebarOpen ? "w-5 -rotate-45 -translate-y-1.5" : "w-6"}`} />
          </div>
        </button>
        
        <div className="hidden md:block">
          <h2 className="text-sm font-black text-slate-800 dark:text-white leading-none">ديوان المنطقة الغربية</h2>
          <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">الهيئة الوطنية لمكافحة الفساد</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <button
          onClick={handleToggleTheme}
          className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-xl"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 pr-3 border-r border-slate-200 dark:border-slate-800">
          <div className="hidden sm:block text-left">
            <p className="text-xs font-black text-slate-800 dark:text-white leading-none">{session.fullName}</p>
            <p className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 mt-1 uppercase tracking-tighter">
              {session.role === "admin" ? "General Manager" : "Employee"}
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-lg border border-indigo-200 dark:border-indigo-800">
            {session.username.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </nav>
  );
}
