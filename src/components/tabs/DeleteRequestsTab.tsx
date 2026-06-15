// ============================================================
// DeleteRequestsTab.tsx - طلبات الحذف (Status-Based)
// ============================================================

import { useState, useMemo, useEffect } from "react";
import { type Session, addLog, mergeAllEmployees } from "../../lib/storage";
import { type Employee, fetchEmployeesFromSheet } from "../../data/employees";
import { 
  filterPendingDelete, 
  approveAndArchive, 
  rejectDeleteRequestStatus,
  type EmployeeStatusMeta,
} from "../../lib/employeeStatus";
import { printDeleteRequestOrder } from "../../utils/print";
import { StatCard } from "../ui";

type PendingEmployee = Employee & { _meta: EmployeeStatusMeta };

export function DeleteRequestsTab({ session }: { session: Session }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionModal, setActionModal] = useState<{ employee: PendingEmployee; type: "approve" | "reject" } | null>(null);

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

  // ✅ استعلام: SELECT * FROM employees WHERE employee_status = 'pending_delete'
  const pendingRequests = useMemo(() => filterPendingDelete(employees), [employees, refreshKey]);

  const stats = useMemo(() => ({
    pending: pendingRequests.length,
  }), [pendingRequests]);

  const handleApproveOrReject = (employee: PendingEmployee, type: "approve" | "reject", note: string) => {
    if (type === "approve") {
      const result = approveAndArchive(employee.nationalNumber, session.fullName, note);
      if (result.ok) {
        addLog(session, "approve_delete", `موافقة حذف: ${employee.fullName}`);
        printDeleteRequestOrder({
          refNum: employee._meta.refNum || "",
          nationalNumber: employee.nationalNumber,
          employeeName: employee.fullName,
          reason: employee._meta.deleteReason || "",
          docNumber: employee._meta.deleteDocNumber || "",
          docDate: employee._meta.deleteDocDate || "",
          submitDate: employee._meta.deleteRequestedAt || "",
          submittedBy: employee._meta.deleteRequestedBy || "",
          status: "مقبول",
          adminNote: note,
          adminDate: new Date().toLocaleDateString("ar-LY"),
        }, "approve", session.fullName, note);
        alert(`✅ تمت الموافقة ونقل ${employee.fullName} إلى الأرشيف`);
      } else {
        alert(`❌ ${result.error}`);
      }
    } else {
      const result = rejectDeleteRequestStatus(employee.nationalNumber, note);
      if (result.ok) {
        addLog(session, "reject_delete", `رفض حذف: ${employee.fullName}`);
        printDeleteRequestOrder({
          refNum: employee._meta.refNum || "",
          nationalNumber: employee.nationalNumber,
          employeeName: employee.fullName,
          reason: employee._meta.deleteReason || "",
          docNumber: employee._meta.deleteDocNumber || "",
          docDate: employee._meta.deleteDocDate || "",
          submitDate: employee._meta.deleteRequestedAt || "",
          submittedBy: employee._meta.deleteRequestedBy || "",
          status: "مرفوض",
          adminNote: note,
          adminDate: new Date().toLocaleDateString("ar-LY"),
        }, "reject", session.fullName, note);
        alert(`✅ تم رفض طلب حذف ${employee.fullName}\nالموظف عاد لقاعدة البيانات النشطة`);
      } else {
        alert(`❌ ${result.error}`);
      }
    }
    setActionModal(null);
  };

  if (loading) return <div className="text-center py-20 text-slate-500">جاري تحميل الطلبات...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">📋 طلبات حذف الموظفين</h2>
          <p className="text-xs text-slate-500">
            الموظفون في حالة "قيد المراجعة" - عند الموافقة سينتقلون إلى الأرشيف
          </p>
        </div>
        <button onClick={loadData} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100">
          🔄 تحديث
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard label="طلبات قيد المراجعة" value={stats.pending} color="amber" icon="⏳" />
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs leading-relaxed text-blue-900">
          <p className="font-bold">📌 ملاحظة:</p>
          <p className="mt-1">الموظف يبقى في حالة "معلّق" حتى تتم الموافقة. لا يظهر في قاعدة البيانات النشطة ولا في الأرشيف خلال هذه المرحلة.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["رقم الطلب", "الموظف", "الرقم الوطني", "السبب", "تاريخ التقديم", "بواسطة", "الإجراءات"].map((h) => (
                  <th key={h} className="px-3 py-2 text-right font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-16 text-center text-slate-400">
                    <div className="text-4xl mb-2">✅</div>
                    <p>لا توجد طلبات حذف معلّقة</p>
                  </td>
                </tr>
              ) : pendingRequests.map((emp) => (
                <tr key={emp.nationalNumber} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-[10px] text-indigo-700" dir="ltr">{emp._meta.refNum}</td>
                  <td className="px-3 py-2 font-medium">{emp.fullName}</td>
                  <td className="px-3 py-2 font-mono text-indigo-700" dir="ltr">{emp.nationalNumber}</td>
                  <td className="px-3 py-2 max-w-[160px] truncate" title={emp._meta.deleteReason}>{emp._meta.deleteReason}</td>
                  <td className="px-3 py-2 text-slate-500 text-[10px]">
                    {emp._meta.deleteRequestedAt ? new Date(emp._meta.deleteRequestedAt).toLocaleString("ar-LY") : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{emp._meta.deleteRequestedBy}</td>
                  <td className="px-3 py-2">
                    {session.permissions.canApproveDelete ? (
                      <div className="flex gap-1">
                        <button onClick={() => setActionModal({ employee: emp, type: "approve" })}
                          className="text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-200 px-2 py-1 rounded text-[10px] font-medium transition">
                          ✅ موافقة
                        </button>
                        <button onClick={() => setActionModal({ employee: emp, type: "reject" })}
                          className="text-red-700 hover:text-white hover:bg-red-600 border border-red-200 px-2 py-1 rounded text-[10px] font-medium transition">
                          ❌ رفض
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400">في انتظار المدير</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {actionModal && (
        <ActionModal
          employee={actionModal.employee}
          type={actionModal.type}
          onConfirm={(note) => handleApproveOrReject(actionModal.employee, actionModal.type, note)}
          onClose={() => setActionModal(null)}
        />
      )}
    </div>
  );
}

function ActionModal({ employee, type, onConfirm, onClose }: {
  employee: PendingEmployee;
  type: "approve" | "reject";
  onConfirm: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className={`px-5 py-4 border-b ${type === "approve" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <h3 className="font-bold">{type === "approve" ? "✅ موافقة على الحذف" : "❌ رفض الطلب"}</h3>
          <p className="text-xs text-slate-600 mt-1">{employee.fullName} • <span dir="ltr">{employee.nationalNumber}</span></p>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
            <p><span className="text-slate-500">السبب:</span> <strong>{employee._meta.deleteReason}</strong></p>
            <p><span className="text-slate-500">طلب بواسطة:</span> {employee._meta.deleteRequestedBy}</p>
          </div>
          <div>
            <label className="text-xs text-slate-600 font-medium mb-1 block">
              ملاحظة المدير <span className="text-red-500">*</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder={type === "approve" ? "سبب الموافقة..." : "سبب الرفض..."}
              autoFocus
            />
          </div>
          {type === "approve" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
              ⚠️ سيُنقل الموظف إلى الأرشيف بعد الموافقة. يمكن استعادته لاحقاً.
            </div>
          )}
        </div>
        <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button onClick={() => { if (note.trim()) onConfirm(note.trim()); else alert("⚠️ أدخل ملاحظة"); }}
            className={`px-5 py-2 text-white rounded-lg text-sm font-medium ${type === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
            {type === "approve" ? "تأكيد الموافقة" : "تأكيد الرفض"}
          </button>
        </div>
      </div>
    </div>
  );
}
