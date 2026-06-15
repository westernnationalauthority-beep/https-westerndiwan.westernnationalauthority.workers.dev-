import { useState } from "react";
import { type Session, addLog, changePassword, getRequiredFieldsConfig, setRequiredFieldsConfig } from "../../lib/storage";
import { ALL_FIELD_LABELS } from "../../constants";

export function SettingsTab({ session }: { session: Session }) {
  const [tab, setTab] = useState<"password" | "fields">("password");
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [requiredFields, setRequiredFields] = useState<Record<string, boolean>>(getRequiredFieldsConfig());
  const [saveMsg, setSaveMsg] = useState("");

  const submit = async () => {
    setMsg(""); setErr("");
    if (newPwd !== confirmPwd) { setErr("كلمتا المرور غير متطابقتين"); return; }
    const r = await changePassword(session.userId, oldPwd, newPwd);
    if (!r.ok) { setErr(r.error || ""); return; }
    addLog(session, "change_password", "تغيير كلمة المرور");
    setMsg("✅ تم تغيير كلمة المرور بنجاح");
    setOldPwd(""); setNewPwd(""); setConfirmPwd("");
  };

  const toggleField = (key: string) => {
    setRequiredFields(prev => ({ ...prev, [key]: !prev[key] }));
    setSaveMsg("");
  };

  const saveFieldsConfig = () => {
    setRequiredFieldsConfig(requiredFields);
    addLog(session, "update_permissions", "تحديث إعدادات الحقول المطلوبة");
    setSaveMsg("✅ تم حفظ الإعدادات بنجاح");
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const importantFields = ["fullName", "nationalNumber", "jobNumber", "department", "phone"];
  const accountFields = ["bankName", "iban"];
  const otherFields = Object.keys(ALL_FIELD_LABELS).filter(
    k => !importantFields.includes(k) && !accountFields.includes(k) && k !== "dataComplete"
  );

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab("password")}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            tab === "password"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          🔐 كلمة المرور
        </button>
        <button
          onClick={() => setTab("fields")}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            tab === "fields"
              ? "border-b-2 border-emerald-600 text-emerald-600"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          ⚙️ الحقول المطلوبة
        </button>
      </div>

      {tab === "password" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3 max-w-md">
          <div>
            <h2 className="text-base font-bold text-slate-800">الإعدادات الشخصية</h2>
            <p className="text-xs text-slate-500">تغيير كلمة المرور الخاصة بك</p>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500">الحساب الحالي</p>
            <p className="font-bold text-slate-800">{session.fullName}</p>
            <p className="text-[10px] text-slate-500 font-mono" dir="ltr">@{session.username} • {session.role === "admin" ? "👑 مدير" : "👤 موظف"}</p>
          </div>
          <div>
            <label className="text-xs text-slate-500">كلمة المرور الحالية</label>
            <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-500 outline-none" dir="ltr" />
          </div>
          <div>
            <label className="text-xs text-slate-500">كلمة المرور الجديدة</label>
            <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-500 outline-none" dir="ltr" />
          </div>
          <div>
            <label className="text-xs text-slate-500">تأكيد كلمة المرور الجديدة</label>
            <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-500 outline-none" dir="ltr" />
          </div>
          {err && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-2">{err}</p>}
          {msg && <p className="text-emerald-600 text-sm bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">{msg}</p>}
          <button onClick={submit} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition">
            تغيير كلمة المرور
          </button>
        </div>
      )}

      {tab === "fields" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-800">⚙️ إعدادات الحقول المطلوبة</h2>
            <p className="text-xs text-slate-500 mt-1">
              حدد الحقول التي يجب أن تعتبر "نواقص" إذا كانت فارغة أثناء تقييم اكتمال البيانات
            </p>
          </div>

          {/* الحقول المهمة */}
          <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">⭐</span>
              <h3 className="font-bold text-slate-800 text-sm">الحقول الأساسية (حساس جداً)</h3>
              <span className="bg-red-200 text-red-800 text-xs px-2 py-0.5 rounded font-bold">مهم</span>
            </div>
            <div className="space-y-2">
              {importantFields.map(key => (
                <label key={key} className="flex items-center gap-3 p-2 hover:bg-red-100/50 rounded-lg cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={requiredFields[key] ?? true}
                    onChange={() => toggleField(key)}
                    className="w-5 h-5 accent-red-600"
                  />
                  <span className="text-sm text-slate-700">{ALL_FIELD_LABELS[key]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* حقول البنك والحساب */}
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">💳</span>
              <h3 className="font-bold text-slate-800 text-sm">بيانات الحساب البنكي</h3>
              <span className="bg-amber-200 text-amber-800 text-xs px-2 py-0.5 rounded font-bold">مهم</span>
            </div>
            <div className="space-y-2">
              {accountFields.map(key => (
                <label key={key} className="flex items-center gap-3 p-2 hover:bg-amber-100/50 rounded-lg cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={requiredFields[key] ?? true}
                    onChange={() => toggleField(key)}
                    className="w-5 h-5 accent-amber-600"
                  />
                  <span className="text-sm text-slate-700">{ALL_FIELD_LABELS[key]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* حقول أخرى */}
          <div className="bg-gradient-to-r from-slate-50 to-zinc-50 border-2 border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📋</span>
              <h3 className="font-bold text-slate-800 text-sm">حقول إضافية</h3>
              <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded font-bold">اختياري</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {otherFields.map(key => (
                <label key={key} className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded-lg cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={requiredFields[key] ?? false}
                    onChange={() => toggleField(key)}
                    className="w-5 h-5 accent-slate-600"
                  />
                  <span className="text-sm text-slate-700">{ALL_FIELD_LABELS[key]}</span>
                </label>
              ))}
            </div>
          </div>

          {saveMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center text-sm text-emerald-700 font-medium">
              {saveMsg}
            </div>
          )}

          <button
            onClick={saveFieldsConfig}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-sm transition shadow-md"
          >
            💾 حفظ الإعدادات
          </button>
        </div>
      )}
    </div>
  );
}
