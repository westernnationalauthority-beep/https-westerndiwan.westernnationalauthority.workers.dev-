// ============================================================
// MotivationTab.tsx - نظام التحفيز الرقمي وإنتاجية الموظفين
// ============================================================

import { useState, useEffect, useMemo, useCallback } from "react";
import { type Session, addLog, mergeAllEmployees } from "../../lib/storage";
import { type Employee, fetchEmployeesFromSheet } from "../../data/employees";
import {
  type MotivationProfile,
  type EmployeeType,
  type CodeSize,
  type PointTier,
  getProfile,
  addPoints,
  getEmployeeType,
  setEmployeeType,
  issueInitiativeCode,
  redeemInitiativeCode,
  getPointTier,
  getTierColor,
  getNickname,
  getPointsToNextTier,
  getAllProfiles,
  getTopEmployees,
  getTopDepartmentHeads,
  getTierStats,
  simulateAttendance,
  getAttendance,
  calculateAttendancePoints,
  POINTS_CONFIG,
  POINT_TIERS,
} from "../../lib/motivation";
import { getMissingFields } from "../../utils";
import confetti from "canvas-confetti";

type ViewMode = "employee" | "head" | "admin";

export function MotivationTab({ session }: { session: Session }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("employee");
  const [selectedEmployeeNN, setSelectedEmployeeNN] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEmployeesFromSheet();
      const merged = mergeAllEmployees(data) as Employee[];
      setEmployees(merged);

      // إنشاء profiles لكل موظف لم يتم إنشاء profile له بعد
      merged.forEach((emp) => {
        if (emp.nationalNumber) {
          getProfile(emp.nationalNumber, emp.fullName, getEmployeeType(emp.nationalNumber));
        }
      });

      if (merged.length > 0 && !selectedEmployeeNN) {
        setSelectedEmployeeNN(merged[0].nationalNumber);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedEmployeeNN]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <div className="inline-block h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400">جاري تحميل نظام التحفيز...</p>
        </div>
      </div>
    );
  }

  const modes = [
    { id: "employee" as const, label: "الموظف", icon: "👤", desc: "لوحتك الشخصية" },
    { id: "head"     as const, label: "رئيس القسم", icon: "🎖️", desc: "متابعة الفريق" },
    { id: "admin"    as const, label: "مدير الديوان", icon: "👑", desc: "لوحة الأداء" },
  ];

  return (
    <div className="space-y-4">
      {/* رأس التبويب (مدمج وعصري) */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex-1">
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">🏆 نظام التحفيز الرقمي</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">النقاط، المبادرات، الحضور، التميز</p>
        </div>
        {/* تبديل سريع بين الواجهات */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-1">
          {modes.map(m => (
            <button
              key={m.id}
              onClick={() => setViewMode(m.id)}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-[10px] font-black transition-all ${
                viewMode === m.id
                  ? "bg-white dark:bg-slate-700 shadow-md text-indigo-700 dark:text-indigo-300"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
              }`}
            >
              <span className="text-base">{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* اختيار الموظف - تصميم مدمج */}
      {viewMode !== "admin" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">الموظف</span>
          <select
            value={selectedEmployeeNN}
            onChange={(e) => setSelectedEmployeeNN(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-slate-50 dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {employees.map((emp) => (
              <option key={emp.nationalNumber} value={emp.nationalNumber}>
                {emp.fullName} ({emp.department})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* المحتوى */}
      {viewMode === "employee" && selectedEmployeeNN && (
        <EmployeeDashboard nationalNumber={selectedEmployeeNN} employees={employees} session={session} onUpdate={load} />
      )}
      {viewMode === "head" && selectedEmployeeNN && (
        <DepartmentHeadDashboard nationalNumber={selectedEmployeeNN} employees={employees} session={session} onUpdate={load} />
      )}
      {viewMode === "admin" && <AdminDashboard employees={employees} session={session} onUpdate={load} />}
    </div>
  );
}



// ════════════════════════════════════════════════════════════
// 1. لوحة الموظف الشخصية
// ════════════════════════════════════════════════════════════
function EmployeeDashboard({ nationalNumber, employees, session, onUpdate }: { nationalNumber: string; employees: Employee[]; session: Session; onUpdate: () => void }) {
  const employee = employees.find((e) => e.nationalNumber === nationalNumber);
  const [profile, setProfile] = useState<MotivationProfile | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [codeMessage, setCodeMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (employee) {
      const p = getProfile(employee.nationalNumber, employee.fullName, getEmployeeType(employee.nationalNumber));
      setProfile(p);
    }
  }, [employee]);

  if (!employee || !profile) return <div className="text-center py-10 text-slate-500 dark:text-slate-400">لم يتم العثور على الموظف</div>;

  const tier = getPointTier(profile.points);
  const colors = getTierColor(tier);
  const nickname = getNickname(profile.points);
  const next = getPointsToNextTier(profile.points);
  const missingFields = getMissingFields(employee);
  const totalFields = 15;
  const completionPercent = Math.max(0, Math.round(((totalFields - missingFields.length) / totalFields) * 100));

  const handleUploadDoc = () => {
    if (missingFields.length === 0) {
      setCodeMessage({ type: "error", text: "بياناتك مكتملة بالفعل!" });
      return;
    }
    addPoints(profile.nationalNumber, POINTS_CONFIG.UPLOAD_MISSING_DOC, `رفع مستند ناقص (محاكاة)`, session.fullName);
    fireConfetti();
    setCodeMessage({ type: "success", text: `🎉 رائع! تمت إضافة +${POINTS_CONFIG.UPLOAD_MISSING_DOC} نقطة` });
    const updated = getAllProfiles()[profile.nationalNumber];
    setProfile(updated);
    addLog(session, "save_employee", `رفع مستند للموظف ${profile.fullName}`);
    onUpdate();
    setTimeout(() => setCodeMessage(null), 4000);
  };

  const handleRedeemCode = () => {
    if (!codeInput.trim()) {
      setCodeMessage({ type: "error", text: "أدخل كود المبادرة" });
      return;
    }
    const result = redeemInitiativeCode(profile.nationalNumber, codeInput.trim().toUpperCase());
    if (result.ok) {
      fireConfetti();
      setCodeMessage({ type: "success", text: result.message });
      setCodeInput("");
      const updated = getAllProfiles()[profile.nationalNumber];
      setProfile(updated);
      addLog(session, "add_code", `تفعيل كود مبادرة: ${profile.fullName}`);
      onUpdate();
    } else {
      setCodeMessage({ type: "error", text: result.message });
    }
    setTimeout(() => setCodeMessage(null), 4000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* بطاقة الموظف الرئيسية */}
      <div className={`lg:col-span-2 rounded-2xl border-2 ${colors.border} ${colors.bg} shadow-md overflow-hidden`}>
        <div className={`bg-gradient-to-l ${colors.gradient} p-6 text-white`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs opacity-90 mb-1">{POINT_TIERS[tier].emoji} {POINT_TIERS[tier].label}</div>
              <h3 className="text-3xl font-bold">{profile.fullName}</h3>
              <p className="text-sm opacity-90 mt-1">{employee.department || "غير محدد"} {employee.section && `- ${employee.section}`}</p>
              <div className="mt-3 inline-flex items-center gap-2 bg-white/20 backdrop-blur px-3 py-1.5 rounded-full">
                <span>🏅</span>
                <span className="font-bold text-sm">{nickname}</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold">{profile.points}</div>
              <div className="text-xs opacity-80 mt-1">نقطة</div>
            </div>
          </div>
        </div>

        {next.nextTier && (
          <div className="p-4 bg-white/50 dark:bg-slate-800/50">
            <div className="flex justify-between text-xs mb-2">
              <span className={`font-bold ${colors.text}`}>المتبقي للوصول لـ {POINT_TIERS[next.nextTier].label}</span>
              <span className="font-mono font-bold">{next.needed} نقطة</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-l ${colors.gradient} transition-all duration-1000`}
                style={{ width: `${next.progress}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 text-center">{next.progress}% من الطريق إلى {POINT_TIERS[next.nextTier].label}</p>
          </div>
        )}
      </div>

      {/* الإحصائيات السريعة */}
      <div className="space-y-3">
        <StatBox icon="📋" label="أكواد ممنوحة" value={profile.initiativeCodes.length} color="indigo" />
        <StatBox icon="✅" label="أكواد مفعّلة" value={profile.initiativeCodes.filter((c) => c.used).length} color="emerald" />
        <StatBox icon="📊" label="عمليات النقاط" value={profile.history.length} color="violet" />
      </div>

      {/* شريط استكمال البيانات */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>📋</span> اكتمال الملف الشخصي
          </h3>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            completionPercent === 100 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          }`}>
            {completionPercent}%
          </span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-4 overflow-hidden mb-3">
          <div
            className={`h-full bg-gradient-to-l ${completionPercent === 100 ? "from-emerald-500 to-teal-600" : "from-amber-400 to-orange-500"} transition-all duration-700`}
            style={{ width: `${completionPercent}%` }}
          />
        </div>
        {missingFields.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-600 dark:text-slate-300">يوجد <strong>{missingFields.length}</strong> حقل ناقص في ملفك:</p>
            <div className="flex flex-wrap gap-1">
              {missingFields.slice(0, 8).map((f, i) => (
                <span key={i} className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-1 rounded text-[10px] border border-amber-200 dark:border-amber-800">{f}</span>
              ))}
              {missingFields.length > 8 && <span className="text-[10px] text-slate-400">+{missingFields.length - 8} أخرى</span>}
            </div>
            <button onClick={handleUploadDoc} className="mt-3 w-full py-2.5 bg-gradient-to-l from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-bold text-sm shadow-md transition">
              📤 محاكاة رفع مستند (+{POINTS_CONFIG.UPLOAD_MISSING_DOC} نقطة)
            </button>
          </div>
        ) : (
          <div className="text-center py-2 text-emerald-600 dark:text-emerald-400 text-sm font-bold">
            ✅ ملفك الشخصي مكتمل 100%
          </div>
        )}
      </div>

      {/* بوابة تفعيل الكود */}
      <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-900/20 dark:to-fuchsia-900/20 rounded-2xl border-2 border-violet-300 dark:border-violet-700 shadow-sm p-5">
        <h3 className="font-bold text-violet-900 dark:text-violet-200 flex items-center gap-2 mb-3">
          <span>🎟️</span> تفعيل كود المبادرة
        </h3>
        <input
          type="text"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          placeholder="IDEA-2026-MXXXXX"
          className="w-full px-3 py-3 border-2 border-violet-300 dark:border-violet-700 rounded-xl text-sm font-mono text-center bg-white dark:bg-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-violet-500"
          dir="ltr"
        />
        <button
          onClick={handleRedeemCode}
          className="mt-3 w-full py-3 bg-gradient-to-l from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-xl font-bold text-sm shadow-md transition"
        >
          ✨ تفعيل الكود
        </button>
        <p className="text-[10px] text-violet-700 dark:text-violet-300 mt-2 text-center">احصل على الكود من رئيس قسمك بعد إنجاز خطتك</p>
      </div>

      {/* رسالة نجاح/خطأ */}
      {codeMessage && (
        <div className={`lg:col-span-3 rounded-xl p-4 text-center font-bold animate-bounce ${
          codeMessage.type === "success" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border-2 border-emerald-300 dark:border-emerald-700" : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-2 border-red-300 dark:border-red-700"
        }`}>
          {codeMessage.text}
        </div>
      )}

      {/* سجل الأكواد الممنوحة */}
      {profile.initiativeCodes.length > 0 && (
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
            <span>📜</span> أكوادي
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {profile.initiativeCodes.slice(-6).reverse().map((c) => (
              <div key={c.id} className={`p-3 rounded-xl border ${c.used ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 opacity-60" : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700"}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-mono font-bold text-sm" dir="ltr">{c.code}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{c.size === "small" ? "صغير" : c.size === "medium" ? "متوسط" : "ضخم"} - {c.points} نقطة</div>
                  </div>
                  {c.used ? (
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">مستخدم</span>
                  ) : (
                    <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded animate-pulse">جديد</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* سجل النقاط */}
      {profile.history.length > 0 && (
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
            <span>📊</span> آخر النشاطات
          </h3>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {profile.history.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{a.reason}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{new Date(a.date).toLocaleString("ar-LY")}</div>
                </div>
                <span className={`font-bold ${a.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {a.amount >= 0 ? "+" : ""}{a.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 2. لوحة رئيس القسم
// ════════════════════════════════════════════════════════════
function DepartmentHeadDashboard({ nationalNumber, employees, session, onUpdate }: { nationalNumber: string; employees: Employee[]; session: Session; onUpdate: () => void }) {
  const head = employees.find((e) => e.nationalNumber === nationalNumber);
  const teamMembers = useMemo(
    () => employees.filter((e) => head?.department && e.department === head.department && e.nationalNumber !== nationalNumber),
    [employees, head, nationalNumber]
  );

  const [generateModal, setGenerateModal] = useState<Employee | null>(null);
  const [showAttendance, setShowAttendance] = useState(false);

  const profiles = getAllProfiles();

  const generateAttendanceForTeam = () => {
    teamMembers.forEach((m) => {
      simulateAttendance(m.nationalNumber, 7);
      const attendancePts = calculateAttendancePoints(m.nationalNumber);
      const existing = profiles[m.nationalNumber];
      if (existing) {
        // إعادة احتساب نقاط الحضور
        const oldAttendancePoints = existing.history.filter((h) => h.reason.includes("حضور")).reduce((sum, h) => sum + h.amount, 0);
        existing.points = existing.points - oldAttendancePoints + attendancePts.total;
        existing.history.unshift({
          id: `att_${Date.now()}_${m.nationalNumber}`,
          type: attendancePts.total >= 0 ? "add" : "deduct",
          amount: attendancePts.total,
          reason: `حضور ${attendancePts.days} يوم + تأخير ${attendancePts.late} يوم`,
          date: new Date().toISOString(),
          by: session.fullName,
        });
      }
    });
    const allProfiles = { ...profiles };
    localStorage.setItem("nacc_motivation_profiles", JSON.stringify(allProfiles));
    addLog(session, "save_employee", `محاكاة حضور لـ ${teamMembers.length} موظف`);
    onUpdate();
    alert(`✅ تم محاكاة الحضور لـ ${teamMembers.length} موظف وحساب نقاطهم`);
  };

  if (!head) return <div className="text-center py-10 text-slate-500 dark:text-slate-400">لم يتم العثور على رئيس القسم</div>;

  return (
    <div className="space-y-4">
      {/* رأس الصفحة */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">🎖️ رئيس القسم: {head.fullName}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">إدارة: {head.department || "غير محدد"}</p>
            <p className="text-xs text-slate-400 mt-1">عدد أعضاء الفريق: {teamMembers.length}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={generateAttendanceForTeam} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm">
              🔄 محاكاة الحضور (7 أيام)
            </button>
            <button onClick={() => setShowAttendance(!showAttendance)} className={`px-3 py-2 rounded-xl text-xs font-bold ${showAttendance ? "bg-violet-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"}`}>
              {showAttendance ? "إخفاء الحضور" : "عرض الحضور"}
            </button>
          </div>
        </div>
      </div>

      {/* جدول الفريق */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">👥 متابعة الفريق ({teamMembers.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">الموظف</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">النوع</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">النقاط</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">النطاق</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">اكتمال البيانات</th>
                {showAttendance && <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">الحضور (7 أيام)</th>}
                <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {teamMembers.map((m) => {
                const profile = profiles[m.nationalNumber] || { points: 0, fullName: m.fullName };
                const tier = getPointTier(profile.points);
                const colors = getTierColor(tier);
                const missing = getMissingFields(m).length;
                const totalFields = 15;
                const completion = Math.max(0, Math.round(((totalFields - missing) / totalFields) * 100));
                const attendance = getAttendance(m.nationalNumber);
                const lateDays = attendance.filter((a) => a.late).length;
                const presentDays = attendance.length - lateDays;
                return (
                  <tr key={m.nationalNumber} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                    <td className="px-3 py-2">
                      <div className={`font-bold ${colors.text}`}>{m.fullName}</div>
                      <div className="text-[10px] text-slate-400 font-mono" dir="ltr">{m.nationalNumber}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{getEmployeeType(m.nationalNumber)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`font-bold text-lg ${colors.text}`}>{profile.points}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${colors.border} ${colors.text} ${colors.bg}`}>
                        {POINT_TIERS[tier].emoji} {POINT_TIERS[tier].label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="w-16 mx-auto bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div className={`h-full ${completion === 100 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${completion}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">{completion}%</span>
                    </td>
                    {showAttendance && (
                      <td className="px-3 py-2 text-center text-[10px]">
                        {attendance.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span>
                            <span className="text-emerald-600">✓{presentDays}</span> / <span className="text-amber-600">⚠{lateDays}</span>
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <button onClick={() => setGenerateModal(m)} className="px-2 py-1 bg-violet-100 dark:bg-violet-900/30 hover:bg-violet-200 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded text-[10px] font-bold">
                        🎟️ توليد كود
                      </button>
                    </td>
                  </tr>
                );
              })}
              {teamMembers.length === 0 && (
                <tr><td colSpan={showAttendance ? 7 : 6} className="px-3 py-12 text-center text-slate-400">لا يوجد أعضاء في فريقك (تأكد من تعيين رئيس قسم لإدارة فعلية)</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal توليد كود التميز */}
      {generateModal && (
        <GenerateCodeModal
          employee={generateModal}
          issuedBy={head.fullName}
          session={session}
          onClose={() => setGenerateModal(null)}
          onIssued={() => { onUpdate(); }}
        />
      )}
    </div>
  );
}

function GenerateCodeModal({ employee, issuedBy, session, onClose, onIssued }: { employee: Employee; issuedBy: string; session: Session; onClose: () => void; onIssued: () => void }) {
  const [size, setSize] = useState<CodeSize>("medium");
  const [description, setDescription] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);

  const generate = () => {
    if (!description.trim()) {
      alert("⚠️ أدخل وصف العمل");
      return;
    }
    const code = issueInitiativeCode(employee.nationalNumber, size, description.trim(), issuedBy);
    setGenerated(code.code);
    addLog(session, "add_code", `كود تميز ${size} للموظف ${employee.fullName}: ${code.code}`);
    fireConfetti();
    onIssued();
  };

  const sizeInfo = {
    small: { label: "صغير", points: POINTS_CONFIG.CODE_SMALL, color: "blue" },
    medium: { label: "متوسط", points: POINTS_CONFIG.CODE_MEDIUM, color: "violet" },
    large: { label: "ضخم", points: POINTS_CONFIG.CODE_LARGE, color: "emerald" },
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-l from-violet-600 to-fuchsia-600 text-white px-5 py-4 flex items-center justify-between">
          <h3 className="font-bold">🎟️ توليد كود التميز</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-xl">👤</div>
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">الموظف المستفيد</p>
                <p className="font-black text-slate-800 dark:text-slate-100 leading-tight">{employee.fullName}</p>
              </div>
            </div>
          </div>

          {!generated ? (
            <>
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-300 font-medium mb-2 block">حجم العمل المنجز</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(sizeInfo) as CodeSize[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`p-3 rounded-xl border-2 transition ${
                        size === s
                          ? `bg-${sizeInfo[s].color}-500 text-white border-${sizeInfo[s].color}-600`
                          : "bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-slate-400"
                      }`}
                    >
                      <div className="text-xs font-bold">{sizeInfo[s].label}</div>
                      <div className="text-lg font-bold mt-1">+{sizeInfo[s].points}</div>
                      <div className="text-[10px] opacity-80">نقطة</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-slate-300 font-medium mb-1 block">وصف العمل المنجز <span className="text-red-500">*</span></label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="مثال: إنجاز تقرير الربع الأول قبل الموعد..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <button onClick={generate} className="w-full py-3 bg-gradient-to-l from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-xl font-bold shadow-md transition">
                ✨ توليد كود التميز
              </button>
            </>
          ) : (
            <div className="text-center space-y-4 py-4">
              <div className="text-5xl">🎉</div>
              <p className="text-slate-800 dark:text-slate-100 font-bold">تم توليد الكود بنجاح!</p>
              <div className="bg-gradient-to-br from-violet-900 to-fuchsia-900 text-white rounded-xl p-5">
                <p className="text-[10px] opacity-70 mb-2">كود التميز</p>
                <p className="font-mono text-2xl font-bold tracking-wider" dir="ltr">{generated}</p>
                <p className="text-xs mt-2 opacity-80">+{sizeInfo[size].points} نقطة</p>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">سلّم الكود للموظف يداً بيد ليفعّله من حسابه</p>
              <button onClick={onClose} className="w-full py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold">إغلاق</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 3. لوحة مدير الديوان
// ════════════════════════════════════════════════════════════
function AdminDashboard({ employees, session, onUpdate }: { employees: Employee[]; session: Session; onUpdate: () => void }) {
  const stats = getTierStats();
  const topEmployees = getTopEmployees(5);
  const topHeads = getTopDepartmentHeads(3);
  const profiles = getAllProfiles();

  const [showTypeManager, setShowTypeManager] = useState(false);

  return (
    <div className="space-y-4">
      {/* خريطة الأداء - Heatmap */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>🗺️</span> خريطة أداء الديوان
          </h3>
          <button onClick={() => setShowTypeManager(!showTypeManager)} className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold">
            👥 تصنيف الموظفين
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <TierStat tier="green" count={stats.green} total={stats.total} />
          <TierStat tier="blue" count={stats.blue} total={stats.total} />
          <TierStat tier="red" count={stats.red} total={stats.total} />
        </div>

        {/* شبكة Heatmap */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 font-bold">جميع الموظفين ({stats.total}):</p>
          <div className="grid grid-cols-12 md:grid-cols-20 gap-1">
            {employees.map((emp) => {
              const profile = profiles[emp.nationalNumber];
              const tier = profile ? getPointTier(profile.points) : "red";
              return (
                <div
                  key={emp.nationalNumber}
                  className={`aspect-square rounded ${
                    tier === "green" ? "bg-emerald-500 hover:bg-emerald-600" :
                    tier === "blue" ? "bg-blue-500 hover:bg-blue-600" :
                    "bg-red-500 hover:bg-red-600"
                  } transition-all cursor-pointer hover:scale-125 hover:z-10 relative group`}
                  title={`${emp.fullName} - ${profile?.points || 0} نقطة - ${POINT_TIERS[tier].label}`}
                >
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-20">
                    {emp.fullName} ({profile?.points || 0})
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* المبدعين */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* أفضل 5 موظفين */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span>🌟</span> أفضل 5 موظفين
          </h3>
          <div className="space-y-2">
            {topEmployees.length === 0 ? (
              <p className="text-center py-6 text-slate-400">لا توجد بيانات بعد</p>
            ) : topEmployees.map((p, idx) => {
              const tier = getPointTier(p.points);
              const colors = getTierColor(tier);
              const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
              return (
                <div key={p.nationalNumber} className={`flex items-center gap-3 p-3 rounded-xl ${colors.bg} border ${colors.border}`}>
                  <span className="text-2xl">{medals[idx]}</span>
                  <div className="flex-1">
                    <div className={`font-bold ${colors.text}`}>{p.fullName}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{p.employeeType} - {getNickname(p.points)}</div>
                  </div>
                  <div className={`font-bold text-xl ${colors.text}`}>{p.points}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* أفضل 3 رؤساء أقسام */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span>🎖️</span> أفضل 3 رؤساء أقسام
          </h3>
          <div className="space-y-2">
            {topHeads.length === 0 ? (
              <p className="text-center py-6 text-slate-400">لم يتم تصنيف رؤساء أقسام بعد. اضغط "تصنيف الموظفين" لإضافتهم.</p>
            ) : topHeads.map((p, idx) => {
              const tier = getPointTier(p.points);
              const colors = getTierColor(tier);
              const medals = ["🥇", "🥈", "🥉"];
              return (
                <div key={p.nationalNumber} className={`flex items-center gap-3 p-3 rounded-xl ${colors.bg} border ${colors.border}`}>
                  <span className="text-2xl">{medals[idx]}</span>
                  <div className="flex-1">
                    <div className={`font-bold ${colors.text}`}>{p.fullName}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{getNickname(p.points)}</div>
                  </div>
                  <div className={`font-bold text-xl ${colors.text}`}>{p.points}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* مدير تصنيف الموظفين */}
      {showTypeManager && (
        <EmployeeTypeManager employees={employees} session={session} onClose={() => setShowTypeManager(false)} onUpdate={onUpdate} />
      )}
    </div>
  );
}

function TierStat({ tier, count, total }: { tier: PointTier; count: number; total: number }) {
  const colors = getTierColor(tier);
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={`rounded-xl p-4 border-2 ${colors.border} ${colors.bg} text-center`}>
      <div className="text-3xl mb-1">{POINT_TIERS[tier].emoji}</div>
      <div className={`text-3xl font-bold ${colors.text}`}>{count}</div>
      <div className={`text-xs font-bold mt-1 ${colors.text}`}>{POINT_TIERS[tier].label}</div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{percent}% من الإجمالي</div>
    </div>
  );
}

function EmployeeTypeManager({ employees, session, onClose, onUpdate }: { employees: Employee[]; session: Session; onClose: () => void; onUpdate: () => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<EmployeeType | "all">("all");
  const [types, setTypes] = useState<Record<string, EmployeeType>>(() => {
    const map: Record<string, EmployeeType> = {};
    employees.forEach((e) => { map[e.nationalNumber] = getEmployeeType(e.nationalNumber); });
    return map;
  });

  const handleChange = (nn: string, type: EmployeeType) => {
    setEmployeeType(nn, type);
    setTypes((prev) => ({ ...prev, [nn]: type }));
    addLog(session, "update_user", `تصنيف الموظف ${nn} كـ ${type}`);
  };

  const filtered = employees.filter((e) => {
    if (search && !e.fullName.toLowerCase().includes(search.toLowerCase()) && !e.nationalNumber.includes(search)) return false;
    if (filter !== "all" && types[e.nationalNumber] !== filter) return false;
    return true;
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-indigo-300 dark:border-indigo-700 shadow-lg p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">👥 تصنيف الموظفين حسب النوع</h3>
        <button onClick={() => { onUpdate(); onClose(); }} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold">حفظ وإغلاق</button>
      </div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث..."
          className="flex-1 min-w-[150px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-slate-100 outline-none"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="all">كل الأنواع</option>
          <option value="إداري">إداري</option>
          <option value="ميداني">ميداني</option>
          <option value="رئيس قسم">رئيس قسم</option>
          <option value="مدير ديوان">مدير ديوان</option>
        </select>
      </div>
      <div className="max-h-96 overflow-y-auto space-y-1">
        {filtered.map((e) => (
          <div key={e.nationalNumber} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <div className="flex-1">
              <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{e.fullName}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">{e.department}</div>
            </div>
            <select
              value={types[e.nationalNumber] || "إداري"}
              onChange={(ev) => handleChange(e.nationalNumber, ev.target.value as EmployeeType)}
              className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="إداري">إداري</option>
              <option value="ميداني">ميداني</option>
              <option value="رئيس قسم">رئيس قسم</option>
              <option value="مدير ديوان">مدير ديوان</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// مكونات مساعدة
// ════════════════════════════════════════════════════════════
function StatBox({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700",
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700",
    violet: "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700",
  };
  return (
    <div className={`rounded-xl border p-3 ${colorMap[color] || colorMap.indigo}`}>
      <div className="text-2xl">{icon}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      <div className="text-[11px] mt-1 opacity-80">{label}</div>
    </div>
  );
}

function fireConfetti() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"],
  });
}
