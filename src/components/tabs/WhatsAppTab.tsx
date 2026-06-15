// ============================================================
// WhatsAppTab.tsx - إدارة رسائل واتساب (مجموعات + أفراد)
// ============================================================

import { useState, useEffect, useMemo } from "react";
import { type Session, addLog } from "../../lib/storage";
import { type Employee, fetchEmployeesFromSheet } from "../../data/employees";
import { formatPhoneForWhatsApp, getMissingFields, openWhatsApp } from "../../utils/helpers";
import { Send, Users, UserCheck, Plus, Trash2, MessageCircle, RefreshCw } from "lucide-react";

// ──────────────────────────────────────────────
// دالة تحضير المتغيرات داخل الرسالة
// ──────────────────────────────────────────────
function resolveMessage(template: string, emp: Employee): string {
  const missing = getMissingFields(emp);
  const values: Record<string, string> = {
    "{name}": emp.fullName || "",
    "{nationalNumber}": emp.nationalNumber || "",
    "{department}": emp.department || "غير محدد",
    "{section}": emp.section || "غير محدد",
    "{phone}": emp.phone || "",
    "{missingCount}": String(missing.length),
    "{missingFields}": missing.join("، "),
  };
  return Object.entries(values).reduce((text, [key, value]) => text.split(key).join(value), template);
}

const DEFAULT_MSG = `السلام عليكم
الأستاذ/ة: {name}

يرجى مراجعة بياناتك في منظومة الموظفين.

الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية`;

// ──────────────────────────────────────────────
// الفلاتر المتاحة
// ──────────────────────────────────────────────
const FILTER_OPTIONS = [
  { value: "all",        label: "جميع الموظفين" },
  { value: "incomplete", label: "بيانات ناقصة" },
  { value: "male",       label: "الذكور" },
  { value: "female",     label: "الإناث" },
];

function applyFilter(employees: Employee[], filter: string): Employee[] {
  if (filter === "all") return employees;
  if (filter === "incomplete") return employees.filter(e => getMissingFields(e).length > 0);
  if (filter === "male") return employees.filter(e => e.gender === "ذكر");
  if (filter === "female") return employees.filter(e => e.gender === "أنثى");
  const [key, ...rest] = filter.split(":");
  const val = rest.join(":");
  if (key === "dept") return employees.filter(e => e.department === val);
  if (key === "status") return employees.filter(e => e.status === val);
  if (key === "jobStatus") return employees.filter(e => e.jobStatus === val);
  return employees;
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export function WhatsAppTab({ session }: { session: Session }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"individual" | "groups">("individual");

  // Individual
  const [searchInd, setSearchInd] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [indMessage, setIndMessage] = useState(DEFAULT_MSG);

  // Groups
  const [groups, setGroups] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("nacc_wa_groups") || "[]"); } catch { return []; }
  });
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", filter: "all", message: DEFAULT_MSG, icon: "👥" });
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  useEffect(() => {
    fetchEmployeesFromSheet().then((data) => { setEmployees(data); setLoading(false); });
  }, []);

  const saveGroups = (updated: any[]) => {
    setGroups(updated);
    localStorage.setItem("nacc_wa_groups", JSON.stringify(updated));
  };

  const departments = useMemo(() => Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort(), [employees]);
  const statuses = useMemo(() => Array.from(new Set(employees.map(e => e.status).filter(Boolean))).sort(), [employees]);
  const jobStatuses = useMemo(() => Array.from(new Set(employees.map(e => e.jobStatus).filter(Boolean))).sort(), [employees]);

  const allFilters = [
    ...FILTER_OPTIONS,
    ...departments.map(d => ({ value: `dept:${d}`, label: `إدارة: ${d}` })),
    ...statuses.map(s => ({ value: `status:${s}`, label: `حالة: ${s}` })),
    ...jobStatuses.map(s => ({ value: `jobStatus:${s}`, label: `وظيفي: ${s}` })),
  ];

  // إحصائيات الأفراد
  const filteredEmployees = useMemo(() =>
    employees.filter(e => {
      const q = searchInd.toLowerCase();
      return !q || e.fullName.toLowerCase().includes(q) || e.nationalNumber.includes(q) || (e.department || "").includes(q);
    }).filter(e => e.phone),
  [employees, searchInd]);

  const getGroupMembers = (filter: string) => applyFilter(employees, filter).filter(e => e.phone);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="text-center"><div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3"/><p className="text-sm text-slate-500">جاري تحميل جهات الاتصال...</p></div></div>;

  return (
    <div className="space-y-4">
      {/* رأس */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-600" /> إرسال رسائل واتساب
          </h2>
          <p className="text-xs text-slate-500">{employees.filter(e=>e.phone).length} موظف لديهم أرقام هواتف</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-1">
          <button
            onClick={() => setActiveTab("individual")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "individual" ? "bg-white dark:bg-slate-700 shadow-md text-emerald-700 dark:text-emerald-400" : "text-slate-500"}`}
          >
            <UserCheck className="w-4 h-4" /> إرسال لفرد
          </button>
          <button
            onClick={() => setActiveTab("groups")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === "groups" ? "bg-white dark:bg-slate-700 shadow-md text-blue-700 dark:text-blue-400" : "text-slate-500"}`}
          >
            <Users className="w-4 h-4" /> مجموعات
          </button>
        </div>
      </div>

      {/* ═══ واجهة الأفراد ═══ */}
      {activeTab === "individual" && (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          {/* قائمة الموظفين */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: 520 }}>
            <div className="p-3 border-b border-slate-100 dark:border-slate-700">
              <input
                type="text"
                value={searchInd}
                onChange={e => setSearchInd(e.target.value)}
                placeholder="ابحث بالاسم أو الإدارة..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-slate-50 dark:divide-slate-700">
              {filteredEmployees.map(emp => (
                <button
                  key={emp.nationalNumber}
                  onClick={() => setSelectedEmp(emp)}
                  className={`w-full text-right p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${selectedEmp?.nationalNumber === emp.nationalNumber ? "bg-emerald-50 dark:bg-emerald-900/20" : ""}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${emp.gender === "أنثى" ? "bg-pink-100 text-pink-700" : "bg-indigo-100 text-indigo-700"}`}>
                    {emp.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{emp.fullName}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span dir="ltr">{emp.phone}</span>
                      {getMissingFields(emp).length > 0 && <span className="bg-amber-100 text-amber-700 px-1 rounded">ناقص</span>}
                    </div>
                  </div>
                </button>
              ))}
              {filteredEmployees.length === 0 && <p className="text-center text-xs text-slate-400 py-8">لا توجد نتائج</p>}
            </div>
          </div>

          {/* منطقة الرسالة */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col gap-4">
            {selectedEmp ? (
              <>
                {/* بطاقة الموظف */}
                <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-xl font-black text-emerald-700">{selectedEmp.fullName.charAt(0)}</div>
                  <div>
                    <div className="font-black text-slate-800 dark:text-slate-100">{selectedEmp.fullName}</div>
                    <div className="text-xs text-slate-500">{selectedEmp.department} {selectedEmp.section && `/ ${selectedEmp.section}`}</div>
                    <div className="text-xs font-mono text-emerald-600" dir="ltr">{selectedEmp.phone}</div>
                  </div>
                  {getMissingFields(selectedEmp).length > 0 && (
                    <div className="mr-auto bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2 py-1 rounded-lg text-[10px] font-bold">
                      {getMissingFields(selectedEmp).length} حقل ناقص
                    </div>
                  )}
                </div>

                {/* الرسالة */}
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1.5">نص الرسالة</label>
                  <textarea
                    value={indMessage}
                    onChange={e => setIndMessage(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">متغيرات: {"{name}"} {"{department}"} {"{missingCount}"} {"{missingFields}"}</p>
                </div>

                {/* معاينة + إرسال */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      openWhatsApp(selectedEmp.phone, resolveMessage(indMessage, selectedEmp));
                      addLog(session, "share_employee", `واتساب لـ: ${selectedEmp.fullName}`);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition"
                  >
                    <Send className="w-4 h-4" /> فتح واتساب
                  </button>
                  <button
                    onClick={() => setIndMessage(DEFAULT_MSG)}
                    className="px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm hover:bg-slate-200 transition"
                    title="إعادة تعيين الرسالة"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 py-16 text-center">
                <div className="text-5xl mb-3">👈</div>
                <p className="font-bold text-slate-600 dark:text-slate-300">اختر موظفاً من القائمة</p>
                <p className="text-xs text-slate-400 mt-1">ثم اكتب الرسالة وافتح واتساب</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ واجهة المجموعات ═══ */}
      {activeTab === "groups" && (
        <div className="space-y-4">
          {/* زر إضافة مجموعة */}
          <button
            onClick={() => setShowGroupForm(!showGroupForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow transition"
          >
            <Plus className="w-4 h-4" /> {showGroupForm ? "إلغاء" : "مجموعة جديدة"}
          </button>

          {/* نموذج إضافة مجموعة */}
          {showGroupForm && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-blue-200 dark:border-blue-800 shadow-sm p-5 space-y-4">
              <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">إنشاء مجموعة جديدة</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">اسم المجموعة</label>
                  <input value={newGroup.name} onChange={e => setNewGroup({...newGroup, name: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="مثال: الموظفون الناقصون" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">الفلتر</label>
                  <select value={newGroup.filter} onChange={e => setNewGroup({...newGroup, filter: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-400">
                    {allFilters.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">نموذج الرسالة</label>
                <textarea value={newGroup.message} onChange={e => setNewGroup({...newGroup, message: e.target.value})}
                  rows={5} className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                <p className="text-[10px] text-slate-400 mt-1">متغيرات: {"{name}"} {"{department}"} {"{missingCount}"} {"{missingFields}"}</p>
              </div>
              <button
                disabled={!newGroup.name.trim()}
                onClick={() => {
                  const g = { id: `g${Date.now()}`, ...newGroup };
                  saveGroups([...groups, g]);
                  setNewGroup({ name: "", filter: "all", message: DEFAULT_MSG, icon: "👥" });
                  setShowGroupForm(false);
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow transition disabled:opacity-40"
              >
                حفظ المجموعة
              </button>
            </div>
          )}

          {/* قائمة المجموعات */}
          {groups.length === 0 && !showGroupForm && (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="text-5xl mb-3">👥</div>
              <p className="font-bold text-slate-600 dark:text-slate-300">لا توجد مجموعات بعد</p>
              <p className="text-xs text-slate-400 mt-1">أنشئ مجموعتك الأولى للإرسال الجماعي</p>
            </div>
          )}

          <div className="space-y-3">
            {groups.map(group => {
              const members = getGroupMembers(group.filter);
              const isExpanded = expandedGroup === group.id;
              return (
                <div key={group.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  {/* رأس المجموعة */}
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-2xl">{group.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-slate-800 dark:text-slate-100">{group.name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2">
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">{members.length} موظف</span>
                        <span>{allFilters.find(f => f.value === group.filter)?.label || group.filter}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                        className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition"
                      >
                        {isExpanded ? "إخفاء" : "الأعضاء"}
                      </button>
                      <button
                        disabled={members.length === 0}
                        onClick={async () => {
                          if (members.length === 0) return;
                          const links = members.slice(0, 5).map(emp => {
                            const phone = formatPhoneForWhatsApp(emp.phone);
                            const msg = encodeURIComponent(resolveMessage(group.message, emp));
                            return `https://wa.me/${phone}?text=${msg}`;
                          });
                          try {
                            await navigator.clipboard.writeText(links.join("\n"));
                            alert(`✅ تم نسخ ${links.length} رابط (أول 5 موظفين)`);
                          } catch { window.open(links[0], "_blank"); }
                          addLog(session, "share_employee", `نسخ روابط مجموعة: ${group.name}`);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition disabled:opacity-40"
                      >
                        نسخ روابط
                      </button>
                      <button
                        onClick={() => { if (confirm(`حذف مجموعة "${group.name}"؟`)) saveGroups(groups.filter(g => g.id !== group.id)); }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* جدول الأعضاء */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-700 overflow-x-auto" style={{ maxHeight: 280 }}>
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-right font-bold text-slate-600 dark:text-slate-300">#</th>
                            <th className="px-3 py-2 text-right font-bold text-slate-600 dark:text-slate-300">الاسم</th>
                            <th className="px-3 py-2 text-right font-bold text-slate-600 dark:text-slate-300">الإدارة</th>
                            <th className="px-3 py-2 text-right font-bold text-slate-600 dark:text-slate-300">الهاتف</th>
                            <th className="px-3 py-2 text-center font-bold text-slate-600 dark:text-slate-300">إرسال</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                          {members.slice(0, 50).map((emp, i) => (
                            <tr key={emp.nationalNumber} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <td className="px-3 py-2 text-slate-400 tabular-nums">{i + 1}</td>
                              <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">{emp.fullName}</td>
                              <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{emp.department || "—"}</td>
                              <td className="px-3 py-2 font-mono text-emerald-600" dir="ltr">{emp.phone}</td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  onClick={() => {
                                    openWhatsApp(emp.phone, resolveMessage(group.message, emp));
                                    addLog(session, "share_employee", `واتساب مجموعة ${group.name} - ${emp.fullName}`);
                                  }}
                                  className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition"
                                >
                                  إرسال
                                </button>
                              </td>
                            </tr>
                          ))}
                          {members.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">لا يوجد أعضاء بهذا الفلتر</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
