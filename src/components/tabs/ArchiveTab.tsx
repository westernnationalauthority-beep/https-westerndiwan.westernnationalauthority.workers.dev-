// ============================================================
// ArchiveTab.tsx - الأرشيف (Status-Based)
// ============================================================

import { useState, useMemo, useEffect } from "react";
import { type Session, addLog, mergeAllEmployees } from "../../lib/storage";
import { type Employee, fetchEmployeesFromSheet } from "../../data/employees";
import { 
  filterArchived, 
  restoreFromArchive, 
  permanentDelete,
  type EmployeeStatusMeta,
} from "../../lib/employeeStatus";
import { printArchiveActionOrder } from "../../utils/print";

type ArchivedEmployee = Employee & { _meta: EmployeeStatusMeta };

export function ArchiveTab({ session }: { session: Session }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ArchivedEmployee | null>(null);
  const [deleteModal, setDeleteModal] = useState<ArchivedEmployee | null>(null);
  const [deleteNote, setDeleteNote] = useState("");

  useEffect(() => {
    loadData();
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener("employee-status-changed", handler);
    return () => window.removeEventListener("employee-status-changed", handler);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchEmployeesFromSheet();
      setEmployees(mergeAllEmployees(data) as Employee[]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ استعلام: SELECT * FROM employees WHERE employee_status = 'archived'
  const archivedEmployees = useMemo(() => filterArchived(employees), [employees, refreshKey]);

  const filtered = useMemo(() => {
    if (!search) return archivedEmployees;
    const s = search.toLowerCase();
    return archivedEmployees.filter(e =>
      e.fullName.toLowerCase().includes(s) ||
      e.nationalNumber.includes(search)
    );
  }, [archivedEmployees, search]);

  const handleRestore = (emp: ArchivedEmployee) => {
    if (!confirm(`استعادة "${emp.fullName}" من الأرشيف؟\n\nسيعود الموظف إلى قاعدة البيانات النشطة.`)) return;
    
    const result = restoreFromArchive(emp.nationalNumber);
    if (result.ok) {
      addLog(session, "restore_archive", `استعادة: ${emp.fullName} (${emp.nationalNumber})`);
      printArchiveActionOrder({
        "الرقم الوطني": emp.nationalNumber,
        "الاســـم ربــاعـــي": emp.fullName,
        "الإدارة": emp.department || "",
        "تاريخ الأرشفة": emp._meta.archivedAt || "",
        "المؤرشف بواسطة": emp._meta.deleteApprovedBy || "",
        "ملاحظة المدير والسبب النهائي": emp._meta.adminNote || "",
        "السبب": emp._meta.deleteReason || "",
      }, "restore", session.fullName, "استرجاع الموظف إلى قاعدة البيانات النشطة");
      alert(`✅ تم استعادة ${emp.fullName} بنجاح`);
    } else {
      alert(`❌ ${result.error}`);
    }
  };

  const handlePermanentDelete = () => {
    if (!deleteModal) return;
    if (!deleteNote.trim()) {
      alert("⚠️ يرجى إدخال ملاحظة المدير");
      return;
    }
    
    const note = deleteNote.trim();
    const emp = deleteModal;
    
    printArchiveActionOrder({
      "الرقم الوطني": emp.nationalNumber,
      "الاســـم ربــاعـــي": emp.fullName,
      "الإدارة": emp.department || "",
      "تاريخ الأرشفة": emp._meta.archivedAt || "",
      "المؤرشف بواسطة": emp._meta.deleteApprovedBy || "",
      "ملاحظة المدير والسبب النهائي": emp._meta.adminNote || "",
      "السبب": emp._meta.deleteReason || "",
    }, "permanent_delete", session.fullName, note);
    
    const result = permanentDelete(emp.nationalNumber);
    if (result.ok) {
      addLog(session, "delete_user", `حذف نهائي من الأرشيف: ${emp.fullName}`);
      alert(`✅ تم الحذف النهائي للموظف ${emp.fullName}`);
      setDeleteModal(null);
      setDeleteNote("");
    } else {
      alert(`❌ ${result.error}`);
    }
  };

  if (loading) return <div className="text-center py-20 text-slate-500">جاري تحميل الأرشيف...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">🗄️ أرشيف الموظفين</h2>
          <p className="text-xs text-slate-500">الموظفون الذين تمت الموافقة على حذفهم — قابلون للاستعادة</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs bg-slate-100 rounded-lg px-2.5 py-1 font-medium text-slate-600">
            {archivedEmployees.length} موظف في الأرشيف
          </span>
          <button onClick={loadData} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100">
            🔄 تحديث
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="🔍 ابحث بالاسم أو الرقم الوطني..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <span className="text-xs text-slate-500">{filtered.length} نتيجة</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["الرقم الوطني", "الاسم", "الإدارة", "تاريخ الأرشفة", "بواسطة", "السبب", "الإجراءات"].map((h) => (
                  <th key={h} className="px-3 py-2 text-right font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-16 text-center text-slate-400">
                  <div className="text-4xl mb-2">📭</div>
                  <p>لا توجد سجلات في الأرشيف</p>
                </td></tr>
              ) : filtered.map((emp) => (
                <tr key={emp.nationalNumber} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-indigo-700" dir="ltr">{emp.nationalNumber}</td>
                  <td className="px-3 py-2 font-medium">{emp.fullName}</td>
                  <td className="px-3 py-2 text-slate-600">{emp.department || "—"}</td>
                  <td className="px-3 py-2 text-slate-600 text-[10px]">
                    {emp._meta.archivedAt ? new Date(emp._meta.archivedAt).toLocaleString("ar-LY") : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{emp._meta.deleteApprovedBy || "—"}</td>
                  <td className="px-3 py-2 max-w-[180px] truncate" title={emp._meta.adminNote || emp._meta.deleteReason}>
                    {emp._meta.adminNote || emp._meta.deleteReason || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => setSelected(emp)}
                        className="text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 px-2 py-1 rounded text-[10px] font-medium transition">
                        👁️ تفاصيل
                      </button>
                      {session.permissions.canRestoreArchive && (
                        <>
                          <button onClick={() => handleRestore(emp)}
                            className="text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-200 px-2 py-1 rounded text-[10px] font-medium transition">
                            ♻️ استعادة
                          </button>
                          <button onClick={() => setDeleteModal(emp)}
                            className="text-red-700 hover:text-white hover:bg-red-600 border border-red-200 px-2 py-1 rounded text-[10px] font-medium transition">
                            🗑️ حذف نهائي
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال التفاصيل */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-slate-100 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">📦 {selected.fullName}</h3>
                <p className="text-xs text-slate-500 font-mono" dir="ltr">{selected.nationalNumber}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-slate-200 rounded text-slate-500">✕</button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <InfoRow label="السبب" value={selected._meta.deleteReason || "—"} />
              <InfoRow label="ملاحظة المدير" value={selected._meta.adminNote || "—"} />
              <InfoRow label="طلب بواسطة" value={selected._meta.deleteRequestedBy || "—"} />
              <InfoRow label="موافق عليه بواسطة" value={selected._meta.deleteApprovedBy || "—"} />
              <InfoRow label="رقم القرار" value={selected._meta.deleteDocNumber || "—"} />
              <InfoRow label="تاريخ القرار" value={selected._meta.deleteDocDate || "—"} />
              <InfoRow label="تاريخ الأرشفة" value={selected._meta.archivedAt ? new Date(selected._meta.archivedAt).toLocaleString("ar-LY") : "—"} />
              <hr className="my-2" />
              <InfoRow label="الاسم" value={selected.fullName} />
              <InfoRow label="الإدارة" value={selected.department || "—"} />
              <InfoRow label="الهاتف" value={selected.phone || "—"} />
            </div>
          </div>
        </div>
      )}

      {/* مودال الحذف النهائي */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setDeleteModal(null); setDeleteNote(""); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-red-50 border-b border-red-200 px-5 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h3 className="font-bold text-red-800">🗑️ حذف نهائي من الأرشيف</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {deleteModal.fullName} • <span dir="ltr" className="font-mono">{deleteModal.nationalNumber}</span>
                </p>
              </div>
              <button onClick={() => { setDeleteModal(null); setDeleteNote(""); }} className="p-2 hover:bg-red-100 rounded text-slate-500">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-slate-600 font-medium mb-1 block">
                  ملاحظة المدير <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={deleteNote}
                  onChange={(e) => setDeleteNote(e.target.value)}
                  rows={3}
                  placeholder="سبب الحذف النهائي..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
                ⚠️ سيُحذف سجل الموظف نهائياً ولا يمكن استعادته بعد ذلك.
              </div>
            </div>
            <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
              <button onClick={() => { setDeleteModal(null); setDeleteNote(""); }} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">إلغاء</button>
              <button onClick={handlePermanentDelete} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">
                🗑️ تأكيد الحذف النهائي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-1 border-b border-slate-100">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm text-slate-800 font-medium text-left">{value}</span>
    </div>
  );
}
