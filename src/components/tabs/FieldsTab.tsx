// ============================================================
// FieldsTab.tsx - إدارة الحقول والنواقص (محسّن بالكامل)
// ============================================================

import { useState, useEffect, useMemo } from "react";
import {
  type Session,
  type CustomField,
  addLog,
  getCustomFields,
  addCustomField,
  deleteCustomField,
  renameCustomField,
  getRequiredFieldsConfig,
  setRequiredFieldsConfig,
  getFieldAliases,
  setFieldAlias
} from "../../lib/storage";
import { ALL_FIELD_LABELS } from "../../constants";
import { Trash2, Edit2 } from "lucide-react";
import { StatCard } from "../ui";

export function FieldsTab({ session }: { session: Session }) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [requiredConfig, setRequiredConfig] = useState<Record<string, boolean>>({});
  const [fieldAliases, setFieldAliases] = useState<Record<string, string>>({});
  const [newLabel, setNewLabel] = useState("");
  const [newRequired, setNewRequired] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const reload = () => {
    // تصفية الحقول المضافة تلقائياً من Google Sheets
    const allFields = getCustomFields();
    const manualOnly = allFields.filter(f => f.source !== "sheet-sync");
    // حذف حقول sheet-sync من التخزين (مرة واحدة فقط إذا موجودة)
    if (manualOnly.length < allFields.length) {
      const sheetSyncIds = allFields.filter(f => f.source === "sheet-sync").map(f => f.id);
      sheetSyncIds.forEach(id => deleteCustomField(id));
    }
    setFields(manualOnly);
    // ← نحمّل الـ config مباشرة من localStorage دون إعادة بناء الـ defaults
    // لضمان أن اختيارات المستخدم تبقى ثابتة بين الدخول والخروج
    const savedConfig = (() => {
      try { return JSON.parse(localStorage.getItem("required_fields_config") || "null"); } catch { return null; }
    })();
    if (savedConfig) {
      setRequiredConfig(savedConfig);
    } else {
      setRequiredConfig(getRequiredFieldsConfig());
    }
    setFieldAliases(getFieldAliases());
  };

  useEffect(() => { reload(); }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 2200);
  };

  const saveConfig = (newConfig: Record<string, boolean>) => {
    // حفظ الـ config كاملاً في localStorage مباشرة لضمان الثبات
    localStorage.setItem("required_fields_config", JSON.stringify(newConfig));
    setRequiredFieldsConfig(newConfig);
    setRequiredConfig({ ...newConfig }); // نسخة جديدة لإجبار React على إعادة الرسم
    showSuccess("✅ تم الحفظ");
    addLog(session, "update_permissions", "تحديث إعدادات النواقص");
  };

  const toggleField = (key: string, isFieldRequired: boolean) => {
    const isCurrentlyRequired = requiredConfig[key] ?? isFieldRequired;
    saveConfig({ ...requiredConfig, [key]: !isCurrentlyRequired });
  };

  const handleAdd = () => {
    const label = newLabel.trim();
    if (!label) { setError("يرجى إدخال اسم الحقل"); return; }
    if (fields.some((f) => f.label === label)) { setError("هذا الحقل موجود مسبقاً"); return; }

    const result = addCustomField(label, "manual", newRequired);
    if (!result.ok) { setError(result.error || "فشل إضافة الحقل"); return; }
    
    addLog(session, "add_field", `إضافة حقل: ${label}`);
    setNewLabel(""); setNewRequired(false); setError("");
    showSuccess(`✅ تم إضافة الحقل "${label}" بنجاح`);
    reload();
  };

  const handleRemove = (field: CustomField) => {
    if (!confirm(`هل أنت متأكد من حذف حقل "${field.label}" نهائياً؟`)) return;
    deleteCustomField(field.id);
    addLog(session, "delete_field", `حذف: ${field.label}`);
    showSuccess(`✅ تم حذف الحقل "${field.label}"`);
    reload();
  };

  const handleClearCustomFields = () => {
    if (fields.length === 0) return;
    if (!confirm("سيتم حذف كل الحقول المخصصة من المنظومة فقط. لن يتم حذف أي عمود من ملف Excel. هل تريد المتابعة؟")) return;
    fields.forEach((field) => deleteCustomField(field.id));
    addLog(session, "delete_field", `حذف كل الحقول المخصصة (${fields.length})`);
    showSuccess("✅ تم حذف كل الحقول المخصصة");
    reload();
  };

  const handleRename = () => {
    if (!editingKey) return;
    const trimmed = editLabel.trim();
    if (!trimmed) { alert("⚠️ الاسم لا يمكن أن يكون فارغاً"); return; }
    
    renameCustomField(editingKey, trimmed);
    setFieldAlias(editingKey, trimmed);
    addLog(session, "update_user", `تعديل مسمى الحقل ${editingKey} إلى ${trimmed}`);
    showSuccess(`✅ تم تحديث المسمى إلى "${trimmed}"`);
    setEditingKey(null);
    reload();
  };

  const originalOrder = useMemo(() => [
    "fullName", "nationalNumber", "jobNumber", "jobGrade", "qualification",
    "specialization", "grade", "qualificationOrigin", "bankName", "iban",
    "appointmentDecision", "startDate", "promotionDate", "phone", "department",
    "section", "gender", "receivesPension", "status", "dataComplete",
    "jobStatus", "employmentType", "notes", "requiredAction",
  ], []);

  const stats = useMemo(() => {
    const totalOriginal = originalOrder.length;
    const activeOriginal = originalOrder.filter(k => requiredConfig[k] ?? true).length;
    const totalCustom = fields.length;
    const activeCustom = fields.filter(f => requiredConfig[f.key] ?? f.isRequired).length;
    return { totalOriginal, activeOriginal, totalCustom, activeCustom };
  }, [originalOrder, fields, requiredConfig]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8" dir="rtl">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">إدارة الحقول ومسمياتها</h2>
        <p className="text-xs text-slate-500 mt-1">تغيير الأسماء لا يؤثر على Excel، بل على المنظومة فقط. فعّل الحقل ليدخل في حساب النواقص.</p>
      </div>

      {successMsg && <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-2.5 rounded-full shadow-xl text-xs font-bold animate-bounce">{successMsg}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="حقول أصلية" value={stats.totalOriginal} color="slate" icon="📂" />
        <StatCard label="مفعّلة" value={stats.activeOriginal} color="rose" icon="✅" />
        <StatCard label="حقول مخصصة" value={stats.totalCustom} color="indigo" icon="📋" />
        <StatCard label="مفعّلة مخصصة" value={stats.activeCustom} color="violet" icon="✨" />
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900">
        <p className="font-bold mb-1">ما معنى الحقول المخصصة؟</p>
        <p>هي حقول إضافية داخل المنظومة فقط، مثل: رقم الملف، التقييم السنوي، أو أي معلومة لا توجد ضمن الحقول الأصلية.</p>
        <p className="mt-1">تغيير اسم الحقل هنا يغير طريقة عرضه في المنظومة ورسائل النواقص، ولا يغير اسم العمود في Excel. إذا أردت تغيير اسم العمود في Excel يجب تغييره من ملف Google Sheets أو دعم ذلك من Apps Script.</p>
        {fields.length > 0 && (
          <button onClick={handleClearCustomFields} className="mt-3 rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-red-700 border border-red-200 hover:bg-red-50">
            حذف كل الحقول المخصصة غير المتفق عليها
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-5 py-3.5">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">الحقول الأصلية والمخصصة</h3>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {originalOrder.map((key) => (
            <FieldCard key={key} label={fieldAliases[key] || ALL_FIELD_LABELS[key] || key} isImportant={requiredConfig[key] ?? true} onClick={() => toggleField(key, true)} onRename={() => { setEditingKey(key); setEditLabel(fieldAliases[key] || ALL_FIELD_LABELS[key] || key); }} />
          ))}
          {fields.map((f) => (
            <FieldCard key={f.id} label={fieldAliases[f.key] || f.label} isImportant={requiredConfig[f.key] ?? f.isRequired} onClick={() => toggleField(f.key, f.isRequired)} onRename={() => { setEditingKey(f.key); setEditLabel(fieldAliases[f.key] || f.label); }} onDelete={() => handleRemove(f)} />
          ))}
        </div>
      </div>
      
      <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-4 md:w-2/3 mx-auto mt-6">
        <h3 className="font-semibold text-slate-700 text-center mb-3 text-sm">➕ إضافة حقل مخصص جديد</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="text" value={newLabel} onChange={(e) => { setNewLabel(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder="اسم الحقل..." className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm outline-none" />
          <button onClick={() => setNewRequired(!newRequired)} className={`px-4 py-2.5 rounded-lg text-xs font-bold border flex items-center gap-2 ${newRequired ? "bg-rose-100 border-rose-400 text-rose-700" : "bg-white border-slate-300"}`}>
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${newRequired ? "bg-rose-600" : ""}`}>{newRequired && <CheckIcon />}</div>
            {newRequired ? "مهم" : "غير مهم"}
          </button>
          <button onClick={handleAdd} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow transition">إضافة</button>
        </div>
        {error && <p className="text-red-500 text-[11px] text-center mt-2 font-bold">{error}</p>}
      </div>

      {editingKey && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingKey(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-sm">✏️ تعديل مسمى الحقل</h3>
            <input type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            <div className="flex justify-end gap-2">
                <button onClick={() => setEditingKey(null)} className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs">إلغاء</button>
                <button onClick={handleRename} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldCard({ label, isImportant, onClick, onDelete, onRename }: any) {
  return (
    <div onClick={onClick} className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer ${isImportant ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"}`}>
      <span className="text-xs font-medium truncate">{label}</span>
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
         <button onClick={onRename} className="p-1 hover:bg-slate-200 rounded"><Edit2 className="w-3 h-3" /></button>
         {onDelete && <button onClick={onDelete} className="p-1 hover:bg-red-200 rounded"><Trash2 className="w-3 h-3" /></button>}
         <div className={`w-3 h-3 rounded-full ${isImportant ? "bg-rose-500" : "bg-slate-300"}`} />
      </div>
    </div>
  );
}

function CheckIcon() {
  return <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
}
