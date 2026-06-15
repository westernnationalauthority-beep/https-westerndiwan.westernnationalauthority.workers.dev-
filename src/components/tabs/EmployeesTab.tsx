// ============================================================
// EmployeesTab.tsx - النسخة الكاملة (Pagination + Modals)
// ============================================================

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  type Employee,
  fetchEmployeesFromSheet,
  updateEmployeeInSheet,
  addEmployeeToSheet,
  clearEmployeesCache,
  type DeleteRequest,
} from "../../data/employees";
import { 
  markAsPendingDelete, 
  filterActiveOnly,
} from "../../lib/employeeStatus";
import {
  type Session,
  type CustomField,
  addLog,
  getCustomFields,
  mergeAllEmployees,
  filterByUserDepartments,
} from "../../lib/storage";
import {
  getMissingFields,
  syncCustomFieldsFromSheet,
  openWhatsApp,
  exportCSV,
} from "../../utils";
import {
  printIndividualForm,
  printAllForms,
  printSummaryTable,
  printAlertTable,
  printDeleteRequestOrder,
} from "../../utils/print";
import { isEmpty } from "../../utils";
import {
  Th,
  SortIcon,
  Pagination,
  getStatusBadge,
  LoadingSpinner,
  ErrorCard,
} from "../ui";

const MINI_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  slate:   { bg: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700", text: "text-slate-700 dark:text-slate-100", icon: "bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-400", icon: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" },
  red:     { bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-400", icon: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400" },
  amber:   { bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", icon: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400" },
  indigo:  { bg: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800", text: "text-indigo-700 dark:text-indigo-400", icon: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400" },
  pink:    { bg: "bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800", text: "text-pink-700 dark:text-pink-400", icon: "bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400" },
};

function MiniStatCard({ label, value, color, icon, onClick }: { label: string; value: number; color: string; icon: string; onClick?: () => void }) {
  const c = MINI_COLORS[color] || MINI_COLORS.slate;
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-2 p-2 rounded-xl border transition-all text-right hover:shadow-sm active:scale-95 ${c.bg} ${onClick ? "cursor-pointer" : ""}`}
    >
      <span className={`text-base flex-shrink-0 ${c.icon} rounded-lg w-8 h-8 flex items-center justify-center`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className={`text-base font-black tabular-nums ${c.text}`}>{value.toLocaleString("en")}</div>
        <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 truncate uppercase tracking-wide">{label}</div>
      </div>
    </button>
  );
}

const EDITABLE_FIELDS: { key: string; label: string; mono?: boolean }[] = [
  { key: "fullName", label: "الاسم رباعي" },
  { key: "nationalNumber", label: "الرقم الوطني", mono: true },
  { key: "jobNumber", label: "الرقم الوظيفي", mono: true },
  { key: "jobGrade", label: "الدرجة الوظيفية" },
  { key: "qualification", label: "المؤهل العلمي" },
  { key: "specialization", label: "التخصص" },
  { key: "grade", label: "التقدير" },
  { key: "qualificationOrigin", label: "أصل المؤهل" },
  { key: "bankName", label: "المصرف" },
  { key: "iban", label: "IBAN", mono: true },
  { key: "receivesPension", label: "يتقاضى معاش" },
  { key: "appointmentDecision", label: "رقم قرار التعيين", mono: true },
  { key: "startDate", label: "تاريخ المباشرة" },
  { key: "promotionDate", label: "آخر ترقية" },
  { key: "phone", label: "رقم الهاتف", mono: true },
  { key: "department", label: "الإدارة" },
  { key: "section", label: "القسم" },
  { key: "jobStatus", label: "الحالة الوظيفية" },
  { key: "employmentType", label: "نوع التوظيف" },
  { key: "gender", label: "الجنس" },
  { key: "status", label: "الحالة" },
  { key: "dataComplete", label: "اكتمال البيانات" },
  { key: "notes", label: "ملاحظات" },
  { key: "requiredAction", label: "الإجراء المطلوب" },
];

const DELETE_REASONS = ["نقل لجهة أخرى", "استقالة", "تقاعد", "وفاة", "فصل", "انتهاء عقد", "أخرى"];

export function EmployeesTab({ session }: { session: Session }) {
  const [employeesRaw, setEmployeesRaw] = useState<Employee[]>([]);
  const [statusChangeKey, setStatusChangeKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchBy, setSearchBy] = useState<"nationalNumber" | "fullName" | "all">("nationalNumber");
  const [branchFilter, setBranchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [dataCompleteFilter, setDataCompleteFilter] = useState("");
  const [qualificationFilter, setQualificationFilter] = useState("");
  const [hasJobNumberFilter, setHasJobNumberFilter] = useState("");
  const [pensionFilter, setPensionFilter] = useState("");
  const [jobStatusFilter, setJobStatusFilter] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteRequestEmp, setDeleteRequestEmp] = useState<Employee | null>(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);

  const ROWS_PER_PAGE = 15;
  const perms = session.permissions;
  const customFields = getCustomFields();

  const loadData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError("");
    try {
      if (forceRefresh) clearEmployeesCache();
      const data = await fetchEmployeesFromSheet(forceRefresh);
      syncCustomFieldsFromSheet(data);
      setEmployeesRaw(data);
      addLog(session, "refresh_data", `تحميل ${data.length} موظف`);
      setCurrentPage(1);
    } catch {
      setError("فشل في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handleStatusChange = () => setStatusChangeKey(k => k + 1);
    window.addEventListener("employee-status-changed", handleStatusChange);
    window.addEventListener("employee-removed", handleStatusChange);
    return () => {
      window.removeEventListener("employee-status-changed", handleStatusChange);
      window.removeEventListener("employee-removed", handleStatusChange);
    };
  }, []);

  const employees = useMemo(() => {
    const merged = mergeAllEmployees(employeesRaw);
    const filtered = filterByUserDepartments(merged as Employee[], session);
    // ✅ فلترة باستخدام نظام الحالات: فقط الموظفين النشطين (active)
    return filterActiveOnly(filtered);
  }, [employeesRaw, session, statusChangeKey]);

  const allBranches = useMemo(() => Array.from(new Set(employees.map((e) => e.branch).filter(Boolean))).sort(), [employees]);
  const availableDepartments = useMemo(() => {
    const base = branchFilter ? employees.filter((e) => e.branch === branchFilter) : employees;
    return Array.from(new Set(base.map((e) => e.department).filter(Boolean))).sort();
  }, [employees, branchFilter]);
  const availableSections = useMemo(() => {
    let base = employees;
    if (branchFilter) base = base.filter((e) => e.branch === branchFilter);
    if (departmentFilter) base = base.filter((e) => e.department === departmentFilter);
    return Array.from(new Set(base.map((e) => e.section).filter(Boolean))).sort();
  }, [employees, branchFilter, departmentFilter]);

  const allStatuses = useMemo(() => Array.from(new Set(employees.map((e) => e.status).filter(Boolean))).sort(), [employees]);
  const allJobStatuses = useMemo(() => Array.from(new Set(employees.map((e) => e.jobStatus).filter(Boolean))).sort(), [employees]);
  const allGenders = useMemo(() => Array.from(new Set(employees.map((e) => e.gender).filter(Boolean))).sort(), [employees]);
  const allQualifications = useMemo(() => Array.from(new Set(employees.map((e) => e.qualification).filter(Boolean))).sort(), [employees]);

  const filtered = useMemo(() => {
    let result = [...employees];
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter((emp) => {
        if (searchBy === "nationalNumber") return emp.nationalNumber.includes(term);
        if (searchBy === "fullName") return emp.fullName.toLowerCase().includes(term);
        return emp.nationalNumber.includes(term) || emp.fullName.toLowerCase().includes(term) || emp.jobNumber.includes(term);
      });
    }
    if (branchFilter) result = result.filter((e) => e.branch === branchFilter);
    if (departmentFilter) result = result.filter((e) => e.department === departmentFilter);
    if (sectionFilter) result = result.filter((e) => e.section === sectionFilter);
    if (statusFilter) result = result.filter((e) => e.status === statusFilter);
    if (genderFilter) result = result.filter((e) => e.gender === genderFilter);
    if (dataCompleteFilter) result = result.filter((e) => e.dataComplete === dataCompleteFilter);
    if (qualificationFilter) result = result.filter((e) => e.qualification === qualificationFilter);
    if (hasJobNumberFilter === "yes") result = result.filter((e) => e.jobNumber?.trim());
    if (hasJobNumberFilter === "no") result = result.filter((e) => !e.jobNumber?.trim());
    if (pensionFilter === "yes") result = result.filter((e) => (e.p || e.receivesPension || "").toLowerCase().includes("نعم"));
    if (pensionFilter === "no") result = result.filter((e) => !(e.p || e.receivesPension || "").toLowerCase().includes("نعم"));
    if (jobStatusFilter) result = result.filter((e) => e.jobStatus === jobStatusFilter);
    if (missingOnly) result = result.filter((e) => getMissingFields(e).length > 0);

    if (sortKey) {
      result.sort((a, b) => {
        const va = (a as unknown as Record<string, string>)[sortKey] || "";
        const vb = (b as unknown as Record<string, string>)[sortKey] || "";
        return sortDir === "asc" ? String(va).localeCompare(String(vb), "ar") : String(vb).localeCompare(String(va), "ar");
      });
    }
    return result;
  }, [employees, searchTerm, searchBy, branchFilter, departmentFilter, sectionFilter, statusFilter, genderFilter, dataCompleteFilter, qualificationFilter, hasJobNumberFilter, pensionFilter, jobStatusFilter, missingOnly, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginated = useMemo(() => {
    const start = (safeCurrentPage - 1) * ROWS_PER_PAGE;
    return filtered.slice(start, start + ROWS_PER_PAGE);
  }, [filtered, safeCurrentPage]);

  const stats = useMemo(() => {
    // استخدام getMissingFields للحصول على الإحصاءات الحقيقية
    const complete = employees.filter((e) => {
      const val = (e.dataComplete || "").toLowerCase();
      return val === "نعم مكتملة" || val === "نعم" || val === "مكتملة" || getMissingFields(e).length === 0;
    }).length;
    
    const incomplete = employees.filter((e) => {
      const val = (e.dataComplete || "").toLowerCase();
      return val === "غير مكتملة" || val === "لا" || (val !== "نعم مكتملة" && val !== "نعم" && val !== "مكتملة" && getMissingFields(e).length > 0);
    }).length;

    return {
      total: employees.length,
      complete,
      incomplete,
      missing: employees.filter((e) => e.status === "ناقص").length,
      male: employees.filter((e) => e.gender === "ذكر").length,
      female: employees.filter((e) => e.gender === "أنثى").length,
    };
  }, [employees]);

  const missingEmployees = useMemo(
    () => employees.filter((e) => getMissingFields(e).length > 0),
    [employees]
  );

  // 📊 تقرير أكثر الحقول الناقصة تكراراً (يُطبع مرة واحدة فقط)
  useEffect(() => {
    if (employees.length === 0) return;

    console.group("📊 [Missing Fields Report] - تقرير الحقول الناقصة");
    console.log(`إجمالي الموظفين: ${employees.length}`);
    console.log(`موظفون بنواقص: ${missingEmployees.length}`);
    console.log(`موظفون مكتملون: ${employees.length - missingEmployees.length}`);

    // حساب أكثر الحقول الناقصة تكراراً
    const fieldMissingCount: Record<string, number> = {};
    missingEmployees.forEach((emp) => {
      const missing = getMissingFields(emp);
      missing.forEach((f) => {
        fieldMissingCount[f] = (fieldMissingCount[f] || 0) + 1;
      });
    });

    const sorted = Object.entries(fieldMissingCount).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      console.log("\n🔥 أكثر الحقول الناقصة تكراراً:");
      sorted.slice(0, 10).forEach(([field, count], idx) => {
        const pct = Math.round((count / missingEmployees.length) * 100);
        console.log(`   ${idx + 1}. "${field}" → ${count} موظف (${pct}%)`);
      });
    } else {
      console.log("🎉 لا توجد حقول ناقصة!");
    }
    console.groupEnd();
  }, [employees, missingEmployees]);

  const handleSort = (k: string) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm(""); setBranchFilter(""); setDepartmentFilter("");
    setSectionFilter(""); setStatusFilter(""); setGenderFilter("");
    setDataCompleteFilter(""); setQualificationFilter("");
    setHasJobNumberFilter(""); setPensionFilter(""); setJobStatusFilter("");
    setMissingOnly(false);
    setSortKey(""); setSortDir("asc"); setCurrentPage(1);
  };

  const handleView = (emp: Employee) => { setSelectedEmployee(emp); addLog(session, "view_employee", `عرض: ${emp.fullName}`); };
  
  const handleEdit = (emp: Employee) => {
    if (!perms.canEdit) { alert("ليس لديك صلاحية التعديل"); return; }
    setSelectedEmployee(null);
    setEditingEmployee(emp);
  };

  const handleSaveEdit = async (nn: string, overrides: Record<string, string>, name: string) => {
    const result = await updateEmployeeInSheet(nn, overrides);
    if (result.ok) {
      addLog(session, "save_employee", `تحديث: ${name}`);
      alert("✅ تم الحفظ بنجاح");
      setTimeout(() => loadData(true), 1500);
    } else {
      alert(`❌ فشل الحفظ: ${result.message}`);
    }
    setEditingEmployee(null);
  };

  const handleDeleteRequest = (emp: Employee) => {
    if (!perms.canRequestDelete) { alert("ليس لديك صلاحية طلب الحذف"); return; }
    setSelectedEmployee(null);
    setDeleteRequestEmp(emp);
  };

  const handlePrint = (emp: Employee) => { if (perms.canPrint) printIndividualForm(emp); };

  const handleExport = () => {
    if (!perms.canExport) return;
    exportCSV(filtered, "employees_filtered");
    addLog(session, "export_csv", `تصدير CSV: ${filtered.length} موظف`);
  };

  const handlePrintSummary = () => {
    if (!perms.canPrint) return;
    printSummaryTable(filtered);
    addLog(session, "print_summary", `طباعة ملخص: ${filtered.length} موظف`);
  };

  const handlePrintAll = () => {
    if (!perms.canPrint) return;
    if (filtered.length > 80 && !confirm(`سيتم تجهيز ${filtered.length} نموذج للطباعة. هل تريد المتابعة؟`)) return;
    printAllForms(filtered);
    addLog(session, "print_all", `طباعة نماذج: ${filtered.length} موظف`);
  };

  const handlePrintAlerts = () => {
    if (!perms.canPrint) return;
    printAlertTable(missingEmployees);
    addLog(session, "print_alerts", `طباعة تنبيهات النواقص: ${missingEmployees.length} موظف`);
  };

  if (loading) return <LoadingSpinner />;
  if (error && employees.length === 0) return <ErrorCard message={error} onRetry={loadData} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">قاعدة بيانات الموظفين</h2>
          {perms.canEdit && (
            <button onClick={() => setShowAddEmployee(true)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition">
              + إضافة موظف
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {perms.canPrint && (
            <>
              <button onClick={handlePrintSummary} className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-lg text-[10px] font-bold shadow-sm transition" title="طباعة ملخص الجدول الحالي">طباعة ملخص</button>
              <button onClick={handlePrintAll} className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-[10px] font-bold shadow-sm transition" title="طباعة نماذج الموظفين الظاهرين">طباعة النماذج</button>
            </>
          )}
          {perms.canExport && (
            <button onClick={handleExport} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition" title="تصدير الجدول الحالي CSV">تصدير CSV</button>
          )}
          <button onClick={() => loadData(false)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition" title="تحديث">🔄</button>
          <button onClick={() => loadData(true)} className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition" title="تحديث إجباري">⚡</button>
          <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-1.5 tabular-nums">{employees.length}</span>
        </div>
      </div>

      {/* بطاقات الإحصاء (2 أفقي × 3 عمودي) + التنبيه في نفس الصف */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3 items-start">
        {/* 2×3 grid */}
        <div className="grid grid-cols-2 gap-1.5">
          <MiniStatCard label="إجمالي الموظفين" value={stats.total} color="slate" icon="👥" onClick={clearFilters} />
          <MiniStatCard label="مستوفي" value={stats.complete} color="emerald" icon="✅" onClick={() => { clearFilters(); setDataCompleteFilter("نعم مكتملة"); }} />
          <MiniStatCard label="غير مكتمل" value={stats.incomplete} color="red" icon="⚠️" onClick={() => { clearFilters(); setMissingOnly(true); }} />
          <MiniStatCard label="معلّق" value={stats.missing} color="amber" icon="📋" onClick={() => { clearFilters(); setStatusFilter("ناقص"); }} />
          <MiniStatCard label="عدد الذكور" value={stats.male} color="indigo" icon="👨" onClick={() => { clearFilters(); setGenderFilter("ذكر"); }} />
          <MiniStatCard label="عدد الإناث" value={stats.female} color="pink" icon="👩" onClick={() => { clearFilters(); setGenderFilter("أنثى"); }} />
        </div>

        {/* تنبيه النواقص */}
        {missingEmployees.length > 0 && (
          <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-3 shadow-sm flex flex-col gap-2 h-full">
            <div className="flex items-start gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base">⚠️</div>
              <div>
                <h3 className="text-xs font-black text-amber-950 dark:text-amber-200">بحاجة لمراجعة الإدارة</h3>
                <p className="mt-0.5 text-[10px] leading-relaxed text-amber-800 dark:text-amber-300">
                  <strong>{missingEmployees.length}</strong> موظف لديهم بيانات ناقصة
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => { setMissingOnly((v) => !v); setCurrentPage(1); if (!missingOnly) { setSearchTerm(""); setBranchFilter(""); setDepartmentFilter(""); setSectionFilter(""); setStatusFilter(""); setGenderFilter(""); setDataCompleteFilter(""); setQualificationFilter(""); setHasJobNumberFilter(""); setPensionFilter(""); setJobStatusFilter(""); setSortKey(""); setSortDir("asc"); } }}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black border-2 transition ${missingOnly ? "bg-amber-700 text-white border-amber-700" : "bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 border-amber-300 hover:bg-amber-100"}`}
              >
                {missingOnly ? `↩ عرض الكل` : `👁 عرض الناقصين (${missingEmployees.length})`}
              </button>
              {perms.canPrint && (
                <button onClick={handlePrintAlerts} className="px-3 py-1.5 rounded-xl bg-slate-800 dark:bg-slate-600 text-white text-[10px] font-black hover:bg-slate-700 transition">
                  طباعة كشف المراجعة
                </button>
              )}
              {perms.canExport && (
                <button onClick={() => { exportCSV(missingEmployees, "employees_missing_fields"); addLog(session, "export_csv", `تصدير نواقص: ${missingEmployees.length} موظف`); }} className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[10px] font-black hover:bg-emerald-700 transition">
                  تصدير CSV النواقص
                </button>
              )}
            </div>
          </div>
        )}

        {missingEmployees.length === 0 && (
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center flex items-center justify-center h-full">
            <div>
              <div className="text-2xl">🎉</div>
              <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mt-1">جميع البيانات مكتملة!</p>
            </div>
          </div>
        )}
      </div>

      {/* (استبدل قسم missingEmployees القديم بهذا الفراغ) */}
      {missingOnly && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900 flex items-center justify-between gap-3">
          <span>🔍 تشاهد الآن <strong>{filtered.length}</strong> موظف ناقص من أصل {employees.length}</span>
          <button onClick={clearFilters} className="text-[10px] font-bold underline hover:no-underline">إلغاء التصفية</button>
        </div>
      )}



      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="text" placeholder="ابحث..." value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          <select value={searchBy} onChange={(e) => { setSearchBy(e.target.value as any); setCurrentPage(1); }}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
            <option value="nationalNumber">الرقم الوطني</option>
            <option value="fullName">الاسم</option>
            <option value="all">الكل</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {allBranches.length > 0 && (
            <select value={branchFilter} onChange={(e) => { setBranchFilter(e.target.value); setDepartmentFilter(""); setSectionFilter(""); setCurrentPage(1); }}
              className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
              <option value="">🏢 كل الفروع</option>
              {allBranches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          <select value={departmentFilter} onChange={(e) => { setDepartmentFilter(e.target.value); setSectionFilter(""); setCurrentPage(1); }}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
            <option value="">🏛️ كل الإدارات</option>
            {availableDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={sectionFilter} onChange={(e) => { setSectionFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
            <option value="">📂 كل الأقسام</option>
            {availableSections.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-3 py-2 border rounded-xl text-xs ${showAdvanced ? "bg-violet-100 text-violet-700 border-violet-300" : "bg-white text-slate-600 border-slate-300"}`}>
            ⚙️ فلاتر متقدمة
          </button>
          {(searchTerm || branchFilter || departmentFilter || missingOnly) && (
            <button onClick={clearFilters} className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs">✕ مسح</button>
          )}
        </div>

        {showAdvanced && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="px-3 py-2 border rounded-xl text-sm bg-white">
              <option value="">الحالة</option>
              {allStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={genderFilter} onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1); }} className="px-3 py-2 border rounded-xl text-sm bg-white">
              <option value="">الجنس</option>
              {allGenders.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={qualificationFilter} onChange={(e) => { setQualificationFilter(e.target.value); setCurrentPage(1); }} className="px-3 py-2 border rounded-xl text-sm bg-white">
              <option value="">المؤهل</option>
              {allQualifications.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
            <select value={pensionFilter} onChange={(e) => { setPensionFilter(e.target.value); setCurrentPage(1); }} className="px-3 py-2 border border-amber-300 rounded-xl text-sm bg-amber-50">
              <option value="">💰 معاش</option>
              <option value="yes">نعم</option>
              <option value="no">لا</option>
            </select>
            <select value={jobStatusFilter} onChange={(e) => { setJobStatusFilter(e.target.value); setCurrentPage(1); }} className="px-3 py-2 border rounded-xl text-sm bg-white">
              <option value="">الحالة الوظيفية</option>
              {allJobStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">عرض {paginated.length} من {filtered.length} (صفحة {safeCurrentPage}/{totalPages})</p>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <Th onClick={() => handleSort("nationalNumber")}>الرقم الوطني <SortIcon column="nationalNumber" sortKey={sortKey} sortDir={sortDir} /></Th>
                <Th onClick={() => handleSort("fullName")}>الاسم <SortIcon column="fullName" sortKey={sortKey} sortDir={sortDir} /></Th>
                <Th onClick={() => handleSort("department")}>الإدارة <SortIcon column="department" sortKey={sortKey} sortDir={sortDir} /></Th>
                <Th onClick={() => handleSort("status")}>الحالة <SortIcon column="status" sortKey={sortKey} sortDir={sortDir} /></Th>
                <Th>النواقص</Th>
                <Th>إجراءات</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {paginated.map((emp, idx) => {
                const missingCount = getMissingFields(emp).length;
                return (
                  <tr key={emp.nationalNumber + "-" + idx} className="hover:bg-indigo-50/50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors" onClick={() => handleView(emp)}>
                    <td className="px-3 py-2.5 font-mono font-medium text-indigo-700 dark:text-indigo-400 tabular-nums" dir="ltr">{emp.nationalNumber}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-100">{emp.fullName}</td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{emp.department || "-"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusBadge(emp.status)}`}>{emp.status || "-"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {missingCount > 0
                        ? <span className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-red-200 dark:border-red-800">{missingCount} ناقص</span>
                        : <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">مكتمل</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={(e) => { e.stopPropagation(); handleView(emp); }} className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg text-[10px] font-medium border border-indigo-200 dark:border-indigo-800 transition">عرض</button>
                        {perms.canEdit && <button onClick={(e) => { e.stopPropagation(); handleEdit(emp); }} className="text-amber-700 dark:text-amber-400 hover:bg-amber-600 hover:text-white bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 rounded-lg text-[10px] font-medium border border-amber-200 dark:border-amber-800 transition">تعديل</button>}
                        {perms.canPrint && <button onClick={(e) => { e.stopPropagation(); handlePrint(emp); }} className="text-blue-700 dark:text-blue-400 hover:bg-blue-600 hover:text-white bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-lg text-[10px] font-medium border border-blue-200 dark:border-blue-800 transition">طباعة</button>}
                        {perms.canRequestDelete && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteRequest(emp); }}
                            className="text-red-700 dark:text-red-400 hover:bg-red-600 hover:text-white bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-lg text-[10px] font-medium border border-red-200 dark:border-red-800 transition"
                            title="طلب حذف"
                          >
                            حذف
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400 dark:text-slate-500">لا توجد نتائج</td></tr>}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && <Pagination currentPage={safeCurrentPage} totalPages={totalPages} onChange={setCurrentPage} />}
      </div>

      {selectedEmployee && (
        <DetailModal
          employee={selectedEmployee}
          customFields={customFields}
          perms={perms}
          onClose={() => setSelectedEmployee(null)}
          onEdit={() => handleEdit(selectedEmployee)}
          onDelete={() => handleDeleteRequest(selectedEmployee)}
          onPrint={() => handlePrint(selectedEmployee)}
        />
      )}

      {editingEmployee && (
        <EditModal
          employee={editingEmployee}
          customFields={customFields}
          departments={availableDepartments}
          jobStatuses={allJobStatuses}
          statuses={allStatuses}
          onClose={() => setEditingEmployee(null)}
          onSave={(overrides: Record<string, string>) => handleSaveEdit(editingEmployee.nationalNumber, overrides, editingEmployee.fullName)}
        />
      )}

      {deleteRequestEmp && (
        <DeleteRequestModal
          employee={deleteRequestEmp}
          session={session}
          onClose={() => setDeleteRequestEmp(null)}
        />
      )}

      {showAddEmployee && (
        <AddModal
          customFields={customFields}
          departments={availableDepartments}
          jobStatuses={allJobStatuses}
          statuses={allStatuses}
          onClose={() => setShowAddEmployee(false)}
          onSave={async (data: Partial<Employee>) => {
            try {
              const result = await addEmployeeToSheet(data);
              if (result.ok) {
                addLog(session, "save_employee", `إضافة موظف جديد: ${data.fullName}`);
                alert(`✅ تمت إضافة الموظف "${data.fullName}" بنجاح في Google Sheets\n\nسيتم تحديث القائمة الآن.`);
                setTimeout(() => loadData(true), 1500);
              } else {
                alert(`❌ فشل الإضافة في Google Sheets:\n${result.message || "تأكد من اتصال الإنترنت وأن Apps Script يدعم action=add"}`);
              }
            } catch (err) {
              alert(`❌ خطأ في الاتصال بالخادم:\n${err instanceof Error ? err.message : "خطأ غير معروف"}`);
            }
            setShowAddEmployee(false);
          }}
        />
      )}
    </div>
  );
}

function DetailModal({ employee, customFields, perms, onClose, onEdit, onDelete, onPrint }: any) {
  const emp = employee as Record<string, string>;
  const missing = getMissingFields(employee);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{emp.fullName}</h2>
            <p className="text-xs text-slate-500 font-mono" dir="ltr">{emp.nationalNumber}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {perms.canRequestDelete && <button onClick={onDelete} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs">🗑️ طلب حذف</button>}
            {perms.canEdit && <button onClick={onEdit} className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs">✏️ تعديل</button>}
            {perms.canPrint && <button onClick={onPrint} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs">🖨️ طباعة</button>}
            {emp.phone && <button onClick={() => openWhatsApp(emp.phone, "")} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs">📱</button>}
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">✕</button>
          </div>
        </div>
        <div className="p-6 space-y-3">
          {missing.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="font-bold text-red-800 text-sm mb-2">⚠️ النواقص ({missing.length})</p>
              <div className="flex flex-wrap gap-1">{missing.map((m, i) => <span key={i} className="bg-white text-red-700 px-2 py-1 rounded text-[10px] border border-red-300">{m}</span>)}</div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EDITABLE_FIELDS.map((f) => (
              <div key={f.key} className="bg-slate-50 rounded-lg p-2">
                <p className="text-[10px] text-slate-400">{f.label}</p>
                <p className={`text-sm ${isEmpty(emp[f.key]) ? "text-red-400 italic" : "text-slate-800"}`} dir={f.mono ? "ltr" : undefined}>
                  {isEmpty(emp[f.key]) ? "— فارغ" : emp[f.key]}
                </p>
              </div>
            ))}
            {customFields.map((cf: CustomField) => (
              <div key={cf.id} className="bg-slate-50 rounded-lg p-2">
                <p className="text-[10px] text-slate-400">{cf.label}</p>
                <p className="text-sm text-slate-800">{emp[cf.label] || emp[cf.key] || "— فارغ"}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditModal({ employee, customFields, departments, jobStatuses, statuses, onClose, onSave }: any) {
  const emp = employee as Record<string, string>;
  const originalNN = emp.nationalNumber || "";
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    EDITABLE_FIELDS.forEach((f) => { v[f.key] = emp[f.key] || ""; });
    customFields.forEach((cf: CustomField) => { v[cf.label] = emp[cf.label] || emp[cf.key] || ""; });
    return v;
  });
  const [nnError, setNnError] = useState("");

  const isDropdownField = (key: string) => {
    if (key === "gender") return true;
    if (key === "receivesPension") return true;
    if (key === "department") return true;
    if (key === "jobStatus") return true;
    if (key === "status") return true;
    return false;
  };

  const getDropdownOptions = (key: string) => {
    if (key === "gender") return ["ذكر", "أنثى"];
    if (key === "receivesPension") return ["نعم", "لا"];
    if (key === "department") return departments || [];
    if (key === "jobStatus") return jobStatuses || [];
    if (key === "status") return statuses || [];
    return [];
  };

  const handleSubmit = () => {
    const nnDigits = (values.nationalNumber || "").replace(/[^\d]/g, "");
    if (!values.fullName?.trim()) { alert("⚠️ الاسم الرباعي مطلوب"); return; }
    if (nnDigits.length !== 12) {
      setNnError(`⚠️ الرقم الوطني يجب أن يكون 12 رقماً بالضبط (المدخل: ${nnDigits.length} رقم)`);
      return;
    }
    setNnError("");
    
    // إذا تغير الرقم الوطني، نضيف الرقم الأصلي للتعريف
    const dataToSave = { ...values };
    if (nnDigits !== originalNN) {
      dataToSave._originalNationalNumber = originalNN;
    }
    
    onSave(dataToSave);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">✏️ تعديل: {emp.fullName}</h2>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5" dir="ltr">الرقم الأصلي: {originalNN}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-amber-100 rounded-lg">✕</button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EDITABLE_FIELDS.map((f) => (
              <div key={f.key} className={f.key === "nationalNumber" ? "md:col-span-2" : ""}>
                <label className="text-xs text-slate-500 mb-1 block">
                  {f.label}
                  {f.key === "nationalNumber" && <span className="text-red-500 mr-1">*</span>}
                  {f.key === "fullName" && <span className="text-red-500 mr-1">*</span>}
                </label>
                {isDropdownField(f.key) ? (
                  <select
                    value={values[f.key] || ""}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                  >
                    <option value="">— اختر —</option>
                    {getDropdownOptions(f.key).map((opt: string) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={values[f.key] || ""}
                    onChange={(e) => {
                      if (f.key === "nationalNumber") {
                        const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 12);
                        setValues({ ...values, [f.key]: digits });
                        setNnError("");
                      } else {
                        setValues({ ...values, [f.key]: e.target.value });
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 outline-none ${
                      f.key === "nationalNumber" && nnError
                        ? "border-red-400 focus:ring-red-500 bg-red-50"
                        : "border-slate-300 focus:ring-amber-500"
                    }`}
                    dir={f.mono ? "ltr" : undefined}
                    maxLength={f.key === "nationalNumber" ? 12 : undefined}
                    placeholder={f.key === "nationalNumber" ? "12 رقم بالضبط" : ""}
                  />
                )}
                {f.key === "nationalNumber" && (
                  <div className="flex justify-between items-center mt-1">
                    <span className={`text-[10px] ${nnError ? "text-red-500 font-bold" : "text-slate-400"}`}>
                      {nnError || "يتكون من 12 رقماً بالضبط"}
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        (values.nationalNumber || "").replace(/[^\d]/g, "").length === 12
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }`}
                      dir="ltr"
                    >
                      {(values.nationalNumber || "").replace(/[^\d]/g, "").length}/12
                    </span>
                  </div>
                )}
              </div>
            ))}
            {customFields.map((cf: CustomField) => (
              <div key={cf.id}>
                <label className="text-xs text-slate-500 mb-1 block">{cf.label}</label>
                <input type="text" value={values[cf.label] || ""}
                  onChange={(e) => setValues({ ...values, [cf.label]: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
              </div>
            ))}
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t px-6 py-3 flex justify-end gap-2 z-10">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button onClick={handleSubmit} className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium"> حفظ</button>
        </div>
      </div>
    </div>
  );
}

function DeleteRequestModal({ employee, session, onClose }: any) {
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [docDate, setDocDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const buildRequestForPrint = (refNum: string, status: string): DeleteRequest => ({
    refNum,
    nationalNumber: employee.nationalNumber,
    employeeName: employee.fullName,
    reason: reason === "أخرى" ? otherReason.trim() : reason,
    docNumber: docNumber.trim(),
    docDate,
    submitDate: new Date().toLocaleDateString("ar-LY"),
    submittedBy: session.fullName,
    status,
    adminNote: "",
    adminDate: "",
  });

  const submit = async () => {
    const finalReason = reason === "أخرى" ? otherReason.trim() : reason;
    if (!finalReason) { alert("⚠️ اختر سبب الحذف أولاً"); return; }

    setSubmitting(true);
    try {
      // ✅ نظام Status-Based: تغيير الحالة إلى pending_delete (سجل واحد فقط)
      const result = markAsPendingDelete({
        nationalNumber: employee.nationalNumber,
        employeeName: employee.fullName,
        reason: finalReason,
        requestedBy: session.fullName,
        docNumber: docNumber.trim(),
        docDate,
      });
      
      if (!result.ok) {
        alert(`⚠️ ${result.error}`);
        return;
      }
      
      const refNum = result.refNum || `DEL-${Date.now()}`;
      addLog(session, "request_delete", `طلب حذف معلّق: ${employee.fullName} (${refNum})`);
      
      // ✅ في جميع الحالات، يتم فقط إنشاء الطلب المعلّق.
      // لا يتم أرشفة الموظف هنا. الأرشفة تتم فقط من شاشة "طلبات الحذف" بعد الموافقة.
      const printableRequest = buildRequestForPrint(refNum, "قيد المراجعة");
      printDeleteRequestOrder(printableRequest, "request", session.fullName);
      alert(`✅ تم إرسال طلب الحذف للمراجعة\n\nرقم الطلب: ${refNum}\nسيتم عرضه في "طلبات الحذف" للمدير.`);
      onClose();
      
    } catch (err) {
      console.error("Delete error:", err);
      alert("❌ حدث خطأ غير متوقع");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="bg-red-50 border-b border-red-200 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-red-800">طلب حذف موظف</h3>
            <p className="text-xs text-slate-500">
              سيتم إنشاء طلب حذف وإرساله للمراجعة. لن ينتقل الموظف إلى الأرشيف إلا بعد اعتماد الطلب من شاشة طلبات الحذف.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-100 rounded">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="font-bold text-slate-800">{employee.fullName}</p>
            <p className="text-xs font-mono text-indigo-600" dir="ltr">{employee.nationalNumber}</p>
          </div>

          <div>
            <label className="text-xs text-slate-600 font-medium mb-1.5 block">سبب الحذف *</label>
            <div className="grid grid-cols-2 gap-2">
              {DELETE_REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border ${reason === r ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-700 border-slate-300"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {reason === "أخرى" && (
            <input type="text" value={otherReason} onChange={(e) => setOtherReason(e.target.value)}
              placeholder="اكتب السبب..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" autoFocus />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-600 mb-1 block">رقم القرار (اختياري)</label>
              <input type="text" value={docNumber} onChange={(e) => setDocNumber(e.target.value)}
                placeholder="123/2026" dir="ltr" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-slate-600 mb-1 block">تاريخ القرار (اختياري)</label>
              <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            {session.permissions.canApproveDelete ? "سيتم نقل الموظف إلى الأرشيف بعد الإرسال مباشرة، مع منع تكرار الرقم الوطني في الأرشيف." : "لن يُحذف الموظف فوراً. سيُرسل الطلب للمدير للموافقة."}
          </div>
        </div>
        <div className="border-t px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button
            onClick={() => printDeleteRequestOrder(buildRequestForPrint("مسودة", "قيد المراجعة"), "request", session.fullName)}
            className="px-4 py-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm hover:bg-slate-200"
          >
            طباعة مرجع
          </button>
          <button onClick={submit} disabled={submitting} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {submitting ? "جاري..." : session.permissions.canApproveDelete ? "حذف ونقل للأرشيف" : "إرسال الطلب"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddModal({ customFields, departments, jobStatuses, statuses, onClose, onSave }: any) {
  const [values, setValues] = useState<Record<string, string>>({ fullName: "", nationalNumber: "" });
  const [nnError, setNnError] = useState("");

  const submit = () => {
    const nnDigits = (values.nationalNumber || "").replace(/[^\d]/g, "");
    if (!values.fullName?.trim()) { alert("⚠️ أدخل الاسم"); return; }
    if (nnDigits.length !== 12) {
      setNnError(`⚠️ الرقم الوطني يجب أن يكون 12 رقماً بالضبط (المدخل حالياً: ${nnDigits.length} رقم)`);
      return;
    }
    setNnError("");
    onSave(values);
  };

  const isDropdownField = (key: string) => {
    if (key === "gender") return true;
    if (key === "receivesPension") return true;
    if (key === "department") return true;
    if (key === "jobStatus") return true;
    if (key === "status") return true;
    return false;
  };

  const getDropdownOptions = (key: string) => {
    if (key === "gender") return ["ذكر", "أنثى"];
    if (key === "receivesPension") return ["نعم", "لا"];
    if (key === "department") return departments || [];
    if (key === "jobStatus") return jobStatuses || [];
    if (key === "status") return statuses || [];
    return [];
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-emerald-50 border-b border-emerald-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">➕ إضافة موظف جديد</h2>
          <button onClick={onClose} className="p-2 hover:bg-emerald-100 rounded-lg">✕</button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          {EDITABLE_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="text-xs text-slate-500 mb-1 block">{f.label}{(f.key === "fullName" || f.key === "nationalNumber") && <span className="text-red-500"> *</span>}</label>
              {isDropdownField(f.key) ? (
                <select
                  value={values[f.key] || ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                >
                  <option value="">— اختر —</option>
                  {getDropdownOptions(f.key).map((opt: string) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={values[f.key] || ""}
                  onChange={(e) => {
                    if (f.key === "nationalNumber") {
                      const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 12);
                      setValues({ ...values, [f.key]: digits });
                      setNnError("");
                    } else {
                      setValues({ ...values, [f.key]: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  dir={f.mono ? "ltr" : undefined}
                  maxLength={f.key === "nationalNumber" ? 12 : undefined}
                />
              )}
              {f.key === "nationalNumber" && (
                <div className="flex justify-between items-center mt-1">
                  <span className={`text-[10px] ${nnError ? "text-red-500" : "text-slate-400"}`}>
                    {nnError || "يتكون من 12 رقم بالضبط"}
                  </span>
                  <span className={`text-[10px] font-bold ${(values.nationalNumber || "").replace(/[^\d]/g, "").length === 12 ? "text-emerald-600" : "text-slate-400"}`} dir="ltr">
                    {(values.nationalNumber || "").replace(/[^\d]/g, "").length}/12
                  </span>
                </div>
              )}
            </div>
          ))}
          {customFields.map((cf: CustomField) => (
            <div key={cf.id}>
              <label className="text-xs text-slate-500 mb-1 block">{cf.label}</label>
              <input type="text" value={values[cf.label] || ""}
                onChange={(e) => setValues({ ...values, [cf.label]: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          ))}
        </div>
        <div className="sticky bottom-0 bg-white border-t px-6 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button onClick={submit} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"> إضافة</button>
        </div>
      </div>
    </div>
  );
}
