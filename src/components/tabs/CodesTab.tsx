// ============================================================
// CodesTab.tsx - إدارة أكواد الموظفين المرتبطة بـ Google Sheets
// ============================================================

import { useState, useMemo, useCallback, useEffect } from "react";
import { type Session, addLog } from "../../lib/storage";
import {
  type Employee,
  fetchEmployeesFromSheet,
  getEmployeeCodesFromSheet,
  unblockEmployee,
} from "../../data/employees";
import { sendCodeViaWhatsApp, generateRandomCode } from "../../utils";
import { StatCard } from "../ui";
import { NACC_LOGO } from "../../constants";

type CodeSource = "sheet" | "local" | "none";

type EnrichedEmployee = Employee & {
  code: string;
  codeType: string;
  lastLogin: string;
  expiry: string;
  attempts: number;
  blockReason: string;
  empStatus: string;
  source: CodeSource;
};

const NATIONAL_KEYS = ["nationalNumber", "الرقم الوطني", "الرقم_الوطني", "nn", "National Number"];
const CODE_KEYS = ["code", "personalCode", "codeValue", "كود الدخول", "الكود", "الكود الشخصي", "رمز الدخول", "كود الموظف", "Employee Code"];
const TYPE_KEYS = ["codeType", "type", "نوع الكود", "نوع"];
const LAST_LOGIN_KEYS = ["lastLogin", "آخر دخول", "تاريخ آخر دخول", "last_login"];
const EXPIRY_KEYS = ["expiry", "expiresAt", "تاريخ الانتهاء", "انتهاء الصلاحية", "expiryDate"];
const ATTEMPTS_KEYS = ["attempts", "محاولات", "عدد المحاولات", "loginAttempts"];
const BLOCK_KEYS = ["blocked", "isBlocked", "محجوب", "حالة الحجب"];
const BLOCK_REASON_KEYS = ["blockReason", "سبب الحجب", "ملاحظة الحجب"];

function pick(record: Record<string, string>, keys: string[]): string {
  // البحث المباشر
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  // البحث الجزئي (مرن)
  for (const key of keys) {
    const found = Object.keys(record).find(k => 
      k.toLowerCase().includes(key.toLowerCase()) || 
      key.toLowerCase().includes(k.toLowerCase())
    );
    if (found && record[found] && String(record[found]).trim() !== "") {
      return String(record[found]).trim();
    }
  }
  return "";
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const clean = String(value).trim();
  if (!clean || clean === "—" || clean === "-") return null;

  // 1. محاولة Date العادية
  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  // 2. تنظيف التاريخ (إزالة أي نص إضافي)
  const cleaned = clean.replace(/[^\d\/\-]/g, "");

  // 3. صيغة YYYY-MM-DD أو YYYY/MM/DD
  const ymd = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  // 4. صيغة DD/MM/YYYY أو DD-MM-YYYY
  const dmy = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  // 5. محاولة أخيرة (ربما فيها وقت)
  const withTime = new Date(clean.replace(/[^\d\/\-\: ]/g, ""));
  if (!Number.isNaN(withTime.getTime())) return withTime;

  return null;
}

function formatSafeDate(raw: string): string {
  if (!raw) return "—";
  const d = parseDate(raw);
  if (!d) return "—";
  try {
    return d.toLocaleDateString("ar-LY", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function isTruthy(value: string): boolean {
  return /^(true|1|yes|نعم|محجوب|blocked)$/i.test(String(value || "").trim());
}

export function CodesTab({ session }: { session: Session }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sheetCodes, setSheetCodes] = useState<Record<string, string>[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked" | "expired" | "no_code" | "sheet" | "local">("all");
  const [loading, setLoading] = useState(true);
  const [busyNN, setBusyNN] = useState<string | null>(null);
  const [showCodeModal, setShowCodeModal] = useState<{ emp: Employee; code: string; source: CodeSource } | null>(null);
  const [detailsModal, setDetailsModal] = useState<EnrichedEmployee | null>(null);

  const getLocalCode = (nn: string): Record<string, string | number | boolean> => {
    try { return JSON.parse(localStorage.getItem(`emp_code_${nn}`) || "{}"); } catch { return {}; }
  };

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const [employeeRows, codeRows] = await Promise.all([
        fetchEmployeesFromSheet(force),
        getEmployeeCodesFromSheet(),
      ]);
      setEmployees(employeeRows);
      setSheetCodes(codeRows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  const codeByNationalNumber = useMemo(() => {
    const map = new Map<string, Record<string, string>>();
    sheetCodes.forEach((row) => {
      const nn = pick(row, NATIONAL_KEYS).replace(/[^\d]/g, "");
      if (nn) map.set(nn, row);
    });
    return map;
  }, [sheetCodes]);

  const enriched = useMemo<EnrichedEmployee[]>(() => employees.map((e) => {
    const employeeRecord = e as unknown as Record<string, string>;
    const sheetRecord = codeByNationalNumber.get(e.nationalNumber) || employeeRecord;
    const local = getLocalCode(e.nationalNumber);

    const sheetCode = pick(sheetRecord, CODE_KEYS);
    const localCode = String(local.code || "");
    
    // التحقق من أن الكود ليس "نعم" أو قيمة منطقية
    const isValidCode = (c: string) => c && c !== "نعم" && c !== "لا" && c !== "true" && c !== "false" && c.length > 3;
    
    const code = isValidCode(sheetCode) ? sheetCode : isValidCode(localCode) ? localCode : "";
    const source: CodeSource = isValidCode(sheetCode) ? "sheet" : code ? "local" : "none";
    
    const expiryRaw = pick(sheetRecord, EXPIRY_KEYS) || String(local.expiry || "");
    const lastLoginRaw = pick(sheetRecord, LAST_LOGIN_KEYS) || String(local.lastLogin || "");
    const attemptsRaw = pick(sheetRecord, ATTEMPTS_KEYS) || String(local.attempts || "0");
    const blockedRaw = pick(sheetRecord, BLOCK_KEYS) || String(local.blocked || "");
    const attempts = Number(attemptsRaw) || 0;
    
    const expiryDate = parseDate(expiryRaw);
    
    // الحجب تلقائياً إذا attempts >= 3 أو إذا blocked = نعم
    const blocked = isTruthy(blockedRaw) || attempts >= 3;
    
    let empStatus = "بدون كود";

    if (blocked) empStatus = "محجوب";
    else if (code && expiryDate && expiryDate < new Date()) empStatus = "منتهي";
    else if (code) empStatus = "نشط";

    return {
      ...e,
      code,
      codeType: pick(sheetRecord, TYPE_KEYS) || String(local.type || ""),
      lastLogin: formatSafeDate(lastLoginRaw),
      expiry: formatSafeDate(expiryRaw),
      attempts,
      blockReason: pick(sheetRecord, BLOCK_REASON_KEYS) || String(local.blockReason || ""),
      empStatus,
      source,
    };
  }), [employees, codeByNationalNumber]);

  const filtered = useMemo(() => {
    let r = enriched;
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((e) => e.nationalNumber.includes(s) || e.fullName.toLowerCase().includes(s));
    }
    if (statusFilter !== "all") {
      const map: Record<string, string> = { active: "نشط", blocked: "محجوب", expired: "منتهي", no_code: "بدون كود" };
      if (statusFilter === "sheet" || statusFilter === "local") r = r.filter((e) => e.source === statusFilter);
      else r = r.filter((e) => e.empStatus === map[statusFilter]);
    }
    return r;
  }, [enriched, search, statusFilter]);

  const stats = useMemo(() => ({
    total: enriched.length,
    active: enriched.filter((e) => e.empStatus === "نشط" || e.empStatus === "جديد").length,
    blocked: enriched.filter((e) => e.empStatus === "محجوب").length,
    expired: enriched.filter((e) => e.empStatus === "منتهي").length,
    noCode: enriched.filter((e) => e.empStatus === "بدون كود").length,
    sheet: enriched.filter((e) => e.source === "sheet").length,
  }), [enriched]);

  const statsList = [
    { label: "الموظفين", value: stats.total, color: "slate", icon: "👥", action: () => setStatusFilter("all") },
    { label: "أكواد نشطة", value: stats.active, color: "emerald", icon: "✅", action: () => setStatusFilter("active") },
    { label: "محجوبة", value: stats.blocked, color: "red", icon: "🚫", action: () => setStatusFilter("blocked") },
    { label: "منتهية", value: stats.expired, color: "amber", icon: "⏰", action: () => setStatusFilter("expired") },
    { label: "بدون كود", value: stats.noCode, color: "slate", icon: "❓", action: () => setStatusFilter("no_code") },
    { label: "من الشيت", value: stats.sheet, color: "blue", icon: "☁️", action: () => setStatusFilter("sheet") },
  ];

  const generateCodeFor = async (emp: Employee) => {
    setBusyNN(emp.nationalNumber);
    try {
      // توليد الكود محلياً (لأن Apps Script قد لا يدعم generate_code)
      const newCode = generateRandomCode();
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 90);
      
      const stored = getLocalCode(emp.nationalNumber);
      const updated = {
        ...stored,
        code: newCode,
        type: "شخصي",
        expiry: expiry.toISOString(),
        blocked: false,
        attempts: 0,
        lastLogin: "",
      };
      
      localStorage.setItem(`emp_code_${emp.nationalNumber}`, JSON.stringify(updated));
      
      setShowCodeModal({ emp, code: newCode, source: "local" });
      addLog(session, "add_code", `توليد كود للموظف: ${emp.fullName} (${emp.nationalNumber})`);
      await load(true);
    } finally {
      setBusyNN(null);
    }
  };

  const unblock = async (emp: Employee) => {
    if (!confirm(`فك حجب "${emp.fullName}" من Google Sheets؟`)) return;
    setBusyNN(emp.nationalNumber);
    try {
      const result = await unblockEmployee(emp.nationalNumber);
      if (result.status === "success") {
        const local = getLocalCode(emp.nationalNumber);
        localStorage.setItem(`emp_code_${emp.nationalNumber}`, JSON.stringify({ ...local, blocked: false, attempts: 0 }));
        addLog(session, "update_code", `فك حجب الموظف: ${emp.fullName} (${emp.nationalNumber})`);
        await load(true);
      } else {
        alert(result.message || "فشل فك الحجب من Google Sheets");
      }
    } finally {
      setBusyNN(null);
    }
  };

  const resetAttempts = (emp: Employee) => {
    const stored = getLocalCode(emp.nationalNumber);
    localStorage.setItem(`emp_code_${emp.nationalNumber}`, JSON.stringify({ ...stored, attempts: 0 }));
    addLog(session, "update_code", `تصفير محاولات محلية: ${emp.fullName}`);
    load(false);
  };

  const printCard = (emp: Employee, code: string) => {
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>بطاقة كود - ${emp.fullName}</title>
<style>
  body{font-family:Tahoma,Arial,sans-serif;direction:rtl;padding:20px;background:#f1f5f9;}
  .card{background:white;border:3px solid #1e3a8a;border-radius:16px;padding:24px;max-width:400px;margin:0 auto;box-shadow:0 10px 30px rgba(0,0,0,.1);}
  .header{text-align:center;border-bottom:2px dashed #b8860b;padding-bottom:12px;margin-bottom:16px;}
  .code-box{background:linear-gradient(135deg,#1e3a8a,#4338ca);color:white;padding:16px;border-radius:12px;text-align:center;margin:16px 0;}
  .code-value{font-family:monospace;font-size:32px;font-weight:bold;letter-spacing:6px;}
  .warning{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:10px;margin-top:12px;font-size:10px;color:#92400e;text-align:center;}
  @media print{body{background:white;padding:0;}.no-print{display:none;}}
</style></head><body>
<div class="card">
  <div class="header">
    <img src="${NACC_LOGO}" width="60" height="60" alt="NACC"/>
    <div style="color:#1e3a8a;font-size:14px;font-weight:bold;margin:8px 0 4px;">الهيئة الوطنية لمكافحة الفساد</div>
    <div style="color:#b8860b;font-size:11px;">ديوان المنطقة الغربية</div>
  </div>
  <div style="text-align:center;font-size:13px;font-weight:bold;color:#1e3a8a;margin-bottom:12px;">بطاقة دخول المنظومة</div>
  <div style="color:#64748b;font-size:10px;margin-top:12px;">الاسم:</div>
  <div style="color:#1e293b;font-size:14px;font-weight:bold;">${emp.fullName}</div>
  <div style="color:#64748b;font-size:10px;margin-top:8px;">الرقم الوطني:</div>
  <div style="font-family:monospace;direction:ltr;text-align:right;font-weight:bold;">${emp.nationalNumber}</div>
  <div class="code-box"><div style="font-size:10px;opacity:.8;margin-bottom:6px;">كود الدخول:</div><div class="code-value">${code}</div></div>
  <div class="warning">هذا الكود سري. لا تشاركه مع أي شخص.</div>
  <div style="text-align:center;margin-top:16px;font-size:9px;color:#94a3b8;">تصميم: S-BUTTO • ${new Date().toLocaleDateString("ar-LY")}</div>
</div>
<button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;left:20px;padding:10px 24px;background:#1e3a8a;color:white;border:none;border-radius:8px;cursor:pointer;">طباعة</button>
</body></html>`);
    w.document.close();
  };

  const statusBadge = (s: string) => {
    if (s === "نشط" || s === "جديد") return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (s === "محجوب") return "bg-red-100 text-red-800 border-red-200";
    if (s === "منتهي") return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-slate-100 text-slate-600 border-slate-200";
  };

  if (loading) return <div className="text-center py-20 text-slate-500">جاري تحميل الأكواد من Google Sheets...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">إدارة أكواد الموظفين</h2>
          <p className="text-xs text-slate-500">الأكواد تظهر من Google Sheets أولاً، مع عرض الأكواد المحلية كنسخة مساعدة عند عدم توفرها في الشيت.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(false)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100">تحديث</button>
          <button onClick={() => load(true)} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-100">تحديث إجباري من Sheets</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {statsList.map((s, idx) => (
          <StatCard key={idx} label={s.label} value={s.value} color={s.color as any} icon={s.icon} onClick={s.action} />
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 flex flex-wrap gap-2 items-center">
        <input type="text" placeholder="بحث سريع..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
        
        {statusFilter !== "all" && (
          <button 
            onClick={() => setStatusFilter("all")}
            className="px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-[10px] font-bold"
          >
            إلغاء الفلتر: {statsList.find(s => s.action.toString().includes(statusFilter))?.label || statusFilter}
          </button>
        )}
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">{filtered.length} نتيجة</span>
      </div>

      {stats.sheet === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          لم يتم العثور على أكواد قادمة من Google Sheets. تأكد أن Apps Script يعيد بيانات الأكواد عبر action=get_codes أو أن أعمدة الأكواد موجودة ضمن بيانات الموظفين بأسماء مثل: كود الدخول، الكود الشخصي، تاريخ الانتهاء.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2 text-right font-semibold text-slate-600">الرقم الوطني</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">الاسم</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">الكود الحالي</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">المصدر</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">آخر دخول</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">انتهاء الصلاحية</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">المحاولات</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">الحالة</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((emp) => (
                <tr key={emp.nationalNumber} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-indigo-700" dir="ltr">{emp.nationalNumber}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{emp.fullName}</td>
                  <td className="px-3 py-2 font-mono font-bold text-slate-700">{emp.code || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${emp.source === "sheet" ? "bg-blue-100 text-blue-700" : emp.source === "local" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                      {emp.source === "sheet" ? "Google Sheets" : emp.source === "local" ? "محلي" : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{emp.lastLogin}</td>
                  <td className="px-3 py-2 text-slate-500">{emp.expiry}</td>
                  <td className="px-3 py-2 text-center">{emp.attempts > 0 ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{emp.attempts}</span> : <span className="text-slate-300">0</span>}</td>
                  <td className="px-3 py-2"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(emp.empStatus)}`}>{emp.empStatus}</span></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {emp.empStatus === "محجوب" ? (
                        <button disabled={busyNN === emp.nationalNumber} onClick={() => unblock(emp)} className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-medium disabled:opacity-50">فك الحجب</button>
                      ) : (
                        <button disabled={busyNN === emp.nationalNumber} onClick={() => generateCodeFor(emp)} className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-medium disabled:opacity-50">توليد في Sheets</button>
                      )}
                      {emp.code && <button onClick={() => printCard(emp, emp.code)} className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-medium">بطاقة</button>}
                      {emp.code && emp.phone && <button onClick={() => sendCodeViaWhatsApp(emp.phone, emp.fullName, emp.code)} className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-medium">واتساب</button>}
                      <button onClick={() => setDetailsModal(emp)} className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-medium">تفاصيل</button>
                      {emp.attempts > 0 && emp.source === "local" && <button onClick={() => resetAttempts(emp)} className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-[10px]">تصفير محلي</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">لا توجد نتائج</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showCodeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCodeModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900">تم توليد الكود في Google Sheets</h3>
            <p className="text-sm text-slate-600">{showCodeModal.emp.fullName}</p>
            <div className="bg-indigo-950 text-white rounded-xl p-5">
              <p className="text-[10px] opacity-70 mb-2">كود الدخول</p>
              <p className="font-mono text-3xl font-bold tracking-widest">{showCodeModal.code}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => printCard(showCodeModal.emp, showCodeModal.code)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">طباعة</button>
              {showCodeModal.emp.phone && <button onClick={() => sendCodeViaWhatsApp(showCodeModal.emp.phone, showCodeModal.emp.fullName, showCodeModal.code)} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">واتساب</button>}
            </div>
            <button onClick={() => setShowCodeModal(null)} className="w-full py-2 text-slate-500 hover:text-slate-700 text-sm">إغلاق</button>
          </div>
        </div>
      )}

      {detailsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDetailsModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-100 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
              <div><h3 className="font-bold text-slate-800">تفاصيل الكود</h3><p className="text-xs text-slate-500">{detailsModal.fullName}</p></div>
              <button onClick={() => setDetailsModal(null)} className="p-2 hover:bg-slate-200 rounded text-slate-500">×</button>
            </div>
            <div className="p-5 space-y-2 text-sm">
              <DetailRow label="الرقم الوطني" value={detailsModal.nationalNumber} mono />
              <DetailRow label="الكود الحالي" value={detailsModal.code || "بدون كود"} mono />
              <DetailRow label="المصدر" value={detailsModal.source === "sheet" ? "Google Sheets" : detailsModal.source === "local" ? "محلي" : "غير متوفر"} />
              <DetailRow label="نوع الكود" value={detailsModal.codeType || "—"} />
              <DetailRow label="آخر دخول" value={formatSafeDate(detailsModal.lastLogin)} />
              <DetailRow label="انتهاء الصلاحية" value={formatSafeDate(detailsModal.expiry)} />
              <DetailRow label="عدد المحاولات" value={String(detailsModal.attempts)} />
              <DetailRow label="الحالة" value={detailsModal.empStatus} />
              {detailsModal.blockReason && <DetailRow label="سبب الحجب" value={detailsModal.blockReason} />}
              <DetailRow label="رقم الهاتف" value={detailsModal.phone || "—"} mono />
            </div>
            <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
              {detailsModal.code && <button onClick={() => printCard(detailsModal, detailsModal.code)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">بطاقة</button>}
              <button onClick={() => setDetailsModal(null)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0 gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium text-slate-800 text-left ${mono ? "font-mono" : ""}`} dir={mono ? "ltr" : undefined}>{value}</span>
    </div>
  );
}