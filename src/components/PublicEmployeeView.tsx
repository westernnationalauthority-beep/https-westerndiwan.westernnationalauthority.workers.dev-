// ============================================================
// PublicEmployeeView.tsx - شاشة بيانات الموظف الشخصية
// 3 مجموعات مدمجة + تعديل الحقول الفارغة مباشرة + التقييم
// ============================================================

import { useState } from "react";
import { type Employee } from "../data/employees";
import { type EmployeeLoginResult } from "../data/employees";
import { addLog, getCustomFields } from "../lib/storage";
import { getMissingFields, isEmpty } from "../utils";
import { printIndividualForm } from "../utils/print";
import { NACC_LOGO } from "../constants";
import {
  getProfile, getEmployeeType, getPointTier, getTierColor,
  getNickname, getPointsToNextTier, POINT_TIERS,
} from "../lib/motivation";
import { updateEmployeeInSheet } from "../data/employees";

// ──────────────────────────────────────────────
// نوع الحقل القابل للتعديل
// ──────────────────────────────────────────────
type FieldDef = {
  key: string;
  label: string;
  mono?: boolean;
};

// الحقول الثلاث مجموعات
const GROUP_BASIC: FieldDef[] = [
  { key: "fullName", label: "الاسم رباعي" },
  { key: "nationalNumber", label: "الرقم الوطني", mono: true },
  { key: "jobNumber", label: "الرقم الوظيفي", mono: true },
  { key: "gender", label: "الجنس" },
];

const GROUP_WORK: FieldDef[] = [
  { key: "jobGrade", label: "الدرجة الوظيفية" },
  { key: "department", label: "الإدارة" },
  { key: "section", label: "القسم" },
  { key: "jobStatus", label: "الحالة الوظيفية" },
  { key: "employmentType", label: "نوع التوظيف" },
  { key: "startDate", label: "تاريخ المباشرة" },
  { key: "promotionDate", label: "آخر ترقية" },
  { key: "appointmentDecision", label: "رقم قرار التعيين", mono: true },
];

const GROUP_ACADEMIC: FieldDef[] = [
  { key: "qualification", label: "المؤهل العلمي" },
  { key: "specialization", label: "التخصص" },
  { key: "qualificationOrigin", label: "أصل المؤهل" },
  { key: "grade", label: "التقدير" },
];

const GROUP_FINANCE: FieldDef[] = [
  { key: "bankName", label: "المصرف" },
  { key: "iban", label: "رقم الحساب (IBAN)", mono: true },
  { key: "receivesPension", label: "يتقاضى معاش" },
  { key: "phone", label: "رقم الهاتف", mono: true },
];

const GROUP_NOTES: FieldDef[] = [
  { key: "status", label: "الحالة" },
  { key: "notes", label: "ملاحظات" },
  { key: "requiredAction", label: "الإجراء المطلوب" },
];

// ──────────────────────────────────────────────
// مكوّن الحقل المنفرد القابل للتعديل
// ──────────────────────────────────────────────
function InlineField({
  field,
  empData,
  nationalNumber,
  onSaved,
}: {
  field: FieldDef;
  empData: Record<string, string>;
  nationalNumber: string;
  onSaved: (key: string, value: string) => void;
}) {
  const rawValue = empData[field.key] || "";
  const isEmptyField = isEmpty(rawValue);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rawValue);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await updateEmployeeInSheet(nationalNumber, { [field.key]: draft.trim() });
      onSaved(field.key, draft.trim());
    } catch {
      // نكتفي بالتحديث المحلي
      onSaved(field.key, draft.trim());
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  // الحقل الممتلئ — لا يمكن تعديله من هنا
  if (!isEmptyField) {
    return (
      <div className="flex items-start justify-between gap-2 py-2 border-b border-slate-50 last:border-0 group">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider w-24 shrink-0 pt-0.5">{field.label}</span>
        <span className={`text-xs font-bold text-slate-800 dark:text-slate-100 text-left flex-1 ${field.mono ? "font-mono" : ""}`} dir={field.mono ? "ltr" : undefined}>
          {rawValue}
        </span>
      </div>
    );
  }

  // الحقل الفارغ — قابل للتعديل
  if (!editing) {
    return (
      <button
        onClick={() => { setEditing(true); setDraft(""); }}
        className="w-full flex items-center justify-between gap-2 py-2 border-b border-red-50 last:border-0 group hover:bg-red-50/50 rounded-lg px-2 transition"
      >
        <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider w-24 shrink-0 text-right">{field.label}</span>
        <span className="text-[10px] text-red-400 italic flex-1 text-left">اضغط للتعديل ✏️</span>
        <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-black flex-shrink-0">ناقص</span>
      </button>
    );
  }

  // وضع التعديل
  return (
    <div className="py-2 border-b border-indigo-100 last:border-0">
      <label className="text-[10px] text-indigo-600 font-black uppercase tracking-wider block mb-1.5">{field.label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") { setEditing(false); setDraft(rawValue); }
          }}
          placeholder={`أدخل ${field.label}...`}
          dir={field.mono ? "ltr" : undefined}
          autoFocus
          className="flex-1 px-3 py-1.5 text-xs border-2 border-indigo-400 rounded-xl bg-indigo-50 outline-none focus:ring-2 focus:ring-indigo-400 font-bold text-slate-800"
        />
        <button
          onClick={handleSave}
          disabled={saving || !draft.trim()}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {saving ? "⏳" : "✔ حفظ"}
        </button>
        <button
          onClick={() => { setEditing(false); setDraft(rawValue); }}
          className="px-2 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black hover:bg-slate-200 transition"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// مجموعة حقول قابلة للطي (Accordion)
// ──────────────────────────────────────────────
function FieldGroup({
  title,
  icon,
  color,
  fields,
  empData,
  nationalNumber,
  onSaved,
  missingCount,
}: {
  title: string;
  icon: string;
  color: string;
  fields: FieldDef[];
  empData: Record<string, string>;
  nationalNumber: string;
  onSaved: (key: string, value: string) => void;
  missingCount: number;
}) {
  const [open, setOpen] = useState(missingCount > 0); // افتح تلقائياً إذا فيها نواقص

  const colorMap: Record<string, { header: string; badge: string }> = {
    blue:    { header: "bg-gradient-to-r from-blue-600 to-indigo-600", badge: "bg-blue-100 text-blue-700" },
    emerald: { header: "bg-gradient-to-r from-emerald-600 to-teal-600", badge: "bg-emerald-100 text-emerald-700" },
    purple:  { header: "bg-gradient-to-r from-violet-600 to-purple-600", badge: "bg-violet-100 text-violet-700" },
    amber:   { header: "bg-gradient-to-r from-amber-600 to-orange-500", badge: "bg-amber-100 text-amber-700" },
    slate:   { header: "bg-gradient-to-r from-slate-600 to-slate-700", badge: "bg-slate-100 text-slate-600" },
  };
  const c = colorMap[color] || colorMap.slate;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={`${c.header} text-white px-5 py-3 flex items-center gap-3 w-full text-right`}
      >
        <span className="text-base">{icon}</span>
        <span className="font-bold text-sm flex-1">{title}</span>
        {missingCount > 0 && (
          <span className="bg-amber-400/30 border border-white/30 text-white px-2 py-0.5 rounded-full text-[9px] font-black">
            {missingCount} ناقص
          </span>
        )}
        <span className={`transition-transform ${open ? "rotate-180" : ""} text-white/80`}>▾</span>
      </button>

      {open && (
        <div className="px-4 py-2 space-y-0">
          {fields.map((f) => (
            <InlineField
              key={f.key}
              field={f}
              empData={empData}
              nationalNumber={nationalNumber}
              onSaved={onSaved}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export function PublicEmployeeView({
  employee,
  loginResult,
  onBack,
}: {
  employee: Employee;
  loginResult: EmployeeLoginResult & { employee?: Employee };
  onBack: () => void;
}) {
  const customFields = getCustomFields();
  const [empData, setEmpData] = useState<Record<string, string>>(
    employee as unknown as Record<string, string>
  );

  const missing = getMissingFields(empData as unknown as Employee);
  const isComplete = missing.length === 0;

  const importantFields = [
    "fullName", "nationalNumber", "jobNumber", "jobGrade",
    "qualification", "specialization", "bankName", "iban",
    "appointmentDecision", "startDate", "phone", "department",
  ];
  const allFields = importantFields.length + customFields.filter(cf => cf.isRequired).length;
  const completionPercentage = missing.length === 0
    ? 100
    : Math.max(0, Math.round(((allFields - missing.length) / allFields) * 100));

  // نظام التحفيز
  const motivationProfile = getProfile(employee.nationalNumber, employee.fullName, getEmployeeType(employee.nationalNumber));
  const tier = getPointTier(motivationProfile.points);
  const tierColors = getTierColor(tier);
  const nickname = getNickname(motivationProfile.points);
  const nextTier = getPointsToNextTier(motivationProfile.points);

  // دالة التحديث المحلي بعد الحفظ
  const handleSaved = (key: string, value: string) => {
    setEmpData(prev => ({ ...prev, [key]: value }));
    addLog(
      { userId: "public", username: empData.nationalNumber, fullName: empData.fullName, role: "employee" },
      "save_employee",
      `تعديل الحقل ${key}: ${value}`
    );
  };

  const print = () => {
    printIndividualForm(empData as unknown as Employee);
    addLog(
      { userId: "public", username: "public", fullName: empData.fullName, role: "public" },
      "print_employee",
      `طباعة بياناتي: ${empData.nationalNumber}`
    );
  };

  const share = async () => {
    const text = `بياناتي - ديوان المنطقة الغربية\n\nالاسم: ${empData.fullName}\nالرقم الوطني: ${empData.nationalNumber}\nالدرجة: ${empData.jobGrade || "-"}\nالإدارة: ${empData.department || "-"}\nالهاتف: ${empData.phone || "-"}`;
    if (navigator.share) {
      try { await navigator.share({ title: "بياناتي", text }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(text); alert("✅ تم النسخ"); } catch {}
    }
  };

  // حساب النواقص لكل مجموعة
  const countMissing = (fields: FieldDef[]) =>
    fields.filter(f => isEmpty(empData[f.key])).length;

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={NACC_LOGO} alt="NACC" className="h-8 w-8" />
            <div>
              <h1 className="text-sm font-black text-slate-900 leading-none">بياناتي الشخصية</h1>
              <p className="text-[9px] text-slate-400">ديوان المنطقة الغربية</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={print} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-black hover:bg-indigo-200 transition">
              🖨️ طباعة
            </button>
            <button onClick={onBack} className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-[10px] font-black hover:bg-slate-200 transition">
              ← رجوع
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">

        {/* ══════════════════════════════════════════════
            بطاقة التحفيز + الكود الشخصي (Hero Row)
        ══════════════════════════════════════════════ */}
        <div className={`grid ${loginResult.personalCode ? "grid-cols-1 md:grid-cols-[1fr_280px]" : "grid-cols-1"} gap-3`}>
        {/* بطاقة التحفيز */}
        <div className={`rounded-2xl overflow-hidden shadow-xl border-2 ${tierColors.border}`}>
          {/* الجزء الملون */}
          <div className={`bg-gradient-to-l ${tierColors.gradient} p-4 text-white relative overflow-hidden`}>
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-black/10 rounded-full blur-2xl" />

            <div className="relative z-10 flex items-start justify-between gap-4">
              {/* معلومات الموظف */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{POINT_TIERS[tier].emoji}</span>
                  <span className="text-[9px] font-black bg-black/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
                    {POINT_TIERS[tier].label}
                  </span>
                </div>
                <h2 className="text-xl font-black leading-tight truncate">{empData.fullName}</h2>
                <p className="text-xs opacity-90 mt-1 font-medium">{empData.jobGrade || "—"} • {empData.department || "—"}</p>

                <div className="flex items-center gap-2 mt-3">
                  <div className="bg-white/20 backdrop-blur px-3 py-1 rounded-xl border border-white/30 flex items-center gap-1.5">
                    <span>🏅</span>
                    <span className="text-[11px] font-black">{nickname}</span>
                  </div>
                  <div className="font-mono text-[10px] opacity-70" dir="ltr">{empData.nationalNumber}</div>
                </div>
              </div>

              {/* رصيد النقاط */}
              <div className="text-center bg-white/15 backdrop-blur-xl p-3 rounded-2xl border border-white/20 min-w-[80px]">
                <p className="text-[8px] font-black opacity-70 mb-1 uppercase">النقاط</p>
                <p className="text-2xl font-black tabular-nums leading-none">{motivationProfile.points}</p>
              </div>
            </div>

            {/* شريط التقدم للنقاط */}
            {nextTier.nextTier && (
              <div className="relative z-10 mt-3">
                <div className="flex justify-between items-center mb-1 text-[9px] opacity-80">
                  <span>التقدم نحو {POINT_TIERS[nextTier.nextTier].label}</span>
                  <span>{nextTier.needed} نقطة متبقية</span>
                </div>
                <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all" style={{ width: `${nextTier.progress}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* ══ اكتمال البيانات فقط ══ */}
          <div className="bg-white p-3 text-center">
            <div className={`text-2xl font-black tabular-nums ${isComplete ? "text-emerald-600" : "text-amber-600"}`}>
              {completionPercentage}%
            </div>
            <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">اكتمال البيانات</div>
            {!isComplete && (
              <div className="mt-1.5 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            )}
            {isComplete && <div className="text-[10px] text-emerald-600 font-black mt-0.5">✅ مكتملة</div>}
          </div>
        </div>

        {/* ══ الكود الشخصي (مدمج مع البطاقة) ══ */}
        {loginResult.personalCode && (
          <div className="bg-gradient-to-br from-sky-500 to-cyan-500 rounded-2xl p-4 text-white shadow-xl border-2 border-sky-300 dark:border-sky-800 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-black/10 rounded-full blur-2xl" />
            <div className="relative z-10 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🔐</span>
                  <h3 className="text-sm font-black uppercase tracking-wider">كود الدخول الشخصي</h3>
                </div>
                <p className="font-mono text-4xl font-black tracking-[0.2em] mt-2 leading-none bg-white/20 px-4 py-3 rounded-xl border border-white/30 text-center">
                  {loginResult.personalCode}
                </p>
                {loginResult.expiry && (
                  <p className="text-xs opacity-90 mt-2 text-center">⏱️ ينتهي في: <strong>{loginResult.expiry}</strong></p>
                )}
                <div className="mt-3 bg-white/15 backdrop-blur-sm p-2.5 rounded-xl border border-white/20">
                  <p className="text-xs text-center font-bold">💾 احفظ هذا الكود في مكان آمن</p>
                  <p className="text-[10px] text-center opacity-80 mt-1">ستحتاجه لتسجيل الدخول في المرة القادمة</p>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* ══ تنبيه النواقص ══ */}
        {!isComplete && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-xl shrink-0">⚠️</span>
            <div className="flex-1">
              <h3 className="text-xs font-black text-amber-900">يوجد {missing.length} حقل ناقص</h3>
              <p className="text-[10px] text-amber-700 mt-1">اضغط على أي حقل باللون الأحمر لإدخال بياناته مباشرة وتحديثها في المنظومة.</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {missing.slice(0, 6).map((m, i) => (
                  <span key={i} className="bg-white border border-amber-300 text-amber-700 px-2 py-0.5 rounded-full text-[9px] font-black">{m}</span>
                ))}
                {missing.length > 6 && <span className="text-[9px] text-amber-600">+{missing.length - 6} أخرى</span>}
              </div>
            </div>
          </div>
        )}

        {/* ══ الحقول مجمّعة في 3 أقسام قابلة للطي ══ */}
        <div className="space-y-3">
          <FieldGroup
            title="البيانات الأساسية والوظيفية"
            icon="🏛️"
            color="blue"
            fields={[...GROUP_BASIC, ...GROUP_WORK]}
            empData={empData}
            nationalNumber={employee.nationalNumber}
            onSaved={handleSaved}
            missingCount={countMissing([...GROUP_BASIC, ...GROUP_WORK])}
          />
          <FieldGroup
            title="المؤهلات والبيانات المالية"
            icon="🎓"
            color="emerald"
            fields={[...GROUP_ACADEMIC, ...GROUP_FINANCE]}
            empData={empData}
            nationalNumber={employee.nationalNumber}
            onSaved={handleSaved}
            missingCount={countMissing([...GROUP_ACADEMIC, ...GROUP_FINANCE])}
          />
          <FieldGroup
            title="الملاحظات والإجراءات"
            icon="📋"
            color="amber"
            fields={GROUP_NOTES}
            empData={empData}
            nationalNumber={employee.nationalNumber}
            onSaved={handleSaved}
            missingCount={countMissing(GROUP_NOTES)}
          />
          {customFields.length > 0 && (
            <FieldGroup
              title="البيانات الإضافية"
              icon="➕"
              color="purple"
              fields={customFields.map(cf => ({ key: cf.label, label: cf.label }))}
              empData={empData}
              nationalNumber={employee.nationalNumber}
              onSaved={handleSaved}
              missingCount={customFields.filter(cf => isEmpty(empData[cf.label] || empData[cf.key])).length}
            />
          )}
        </div>

        {/* ══ أزرار الإجراءات ══ */}
        <div className="grid grid-cols-2 gap-3 pb-8">
          <button onClick={print} className="py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-sm shadow-lg flex items-center justify-center gap-2 transition">
            🖨️ طباعة النموذج
          </button>
          <button onClick={share} className="py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-lg flex items-center justify-center gap-2 transition">
            📤 مشاركة
          </button>
        </div>
      </main>
    </div>
  );
}
