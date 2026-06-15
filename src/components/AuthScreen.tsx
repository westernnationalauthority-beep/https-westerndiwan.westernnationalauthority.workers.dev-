// ============================================================
// AuthScreen.tsx - شاشة تسجيل الدخول
// ============================================================

import { useState } from "react";
import { type User, findUser, addLog } from "../lib/storage";
import { type EmployeeLoginResult, fetchEmployeesFromSheet } from "../data/employees";
import { findEmployeeByNationalNumber } from "../lib/storage";
import { getMissingFields } from "../utils";
import { NACC_LOGO, LIBYA_FLAG, SYSTEM_NAME, INIT_CODE, MAX_LOGIN_ATTEMPTS } from "../constants";
import { type Employee } from "../data/employees";

export function AuthScreen({
  onLogin,
  onPublicView,
}: {
  onLogin: (u: User) => void;
  onPublicView: (result: EmployeeLoginResult & { employee?: Employee }) => void;
}) {
  const [isEmployeeMode, setIsEmployeeMode] = useState(false);

  return (
    <div dir="rtl" className="min-h-screen relative flex flex-col overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 transition-colors">
      {/* خلفية زخرفية */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.4] dark:opacity-[0.07]"
        style={{ backgroundImage: "radial-gradient(circle at 25% 25%, #6366f1 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

      {/* الترويسة */}
      <div className="relative z-10 backdrop-blur-md bg-white/60 dark:bg-white/5 border-b border-indigo-100 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-center gap-4">
          <img src={NACC_LOGO} alt="NACC" className="h-16 w-16 object-contain drop-shadow-md" />
          <div className="text-center">
            <div className="text-[10px] text-indigo-600 dark:text-amber-300/80 font-bold tracking-widest">
              NATIONAL ANTI-CORRUPTION COMMISSION
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white mt-1">الهيئة الوطنية لمكافحة الفساد</h1>
            <p className="text-sm font-bold text-indigo-700 dark:text-amber-400 mt-0.5">ديوان المنطقة الغربية</p>
          </div>
          <img src={LIBYA_FLAG} alt="ليبيا" className="h-12 w-20 object-contain rounded shadow-md ring-1 ring-slate-200 dark:ring-white/20" />
        </div>
      </div>

      {/* المحتوى */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">نظام إدارة بيانات الموظفين</h2>
            <p className="text-sm font-bold text-indigo-600/80 dark:text-slate-300 mt-2">جبل نفوسة - ديوان المنطقة الغربية</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* بطاقة الموظف */}
            <div className="group rounded-3xl bg-white/95 backdrop-blur-xl shadow-2xl ring-1 ring-white/20 overflow-hidden hover:ring-emerald-400/50 transition-all">
              <div className="bg-gradient-to-l from-emerald-500 to-teal-600 px-6 py-4 text-white flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-xl">👤</div>
                <div>
                  <h3 className="font-bold">بوابة الموظفين</h3>
                  <p className="text-xs opacity-90">عرض بياناتك الشخصية</p>
                </div>
              </div>
              <div className="p-6">
                <label className="flex items-center gap-3 cursor-pointer mb-5 p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 hover:bg-emerald-100 transition">
                  <input
                    type="checkbox"
                    checked={isEmployeeMode}
                    onChange={(e) => setIsEmployeeMode(e.target.checked)}
                    className="w-5 h-5 accent-emerald-600 rounded"
                  />
                  <div>
                    <p className="font-bold text-slate-800 text-sm">أنا موظف</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">أريد عرض بياناتي الشخصية فقط</p>
                  </div>
                </label>

                {isEmployeeMode ? (
                  <EmployeeSearchForm onFound={onPublicView} />
                ) : (
                  <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      فعّل خيار "أنا موظف" أعلاه
                      <br />ثم أدخل رقمك الوطني للبحث
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* بطاقة الإدارة */}
            <div className="group rounded-3xl bg-white/95 backdrop-blur-xl shadow-2xl ring-1 ring-white/20 overflow-hidden hover:ring-indigo-400/50 transition-all">
              <div className="bg-gradient-to-l from-indigo-600 to-violet-600 px-6 py-4 text-white flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-xl">🔐</div>
                <div>
                  <h3 className="font-bold">بوابة الإدارة</h3>
                  <p className="text-xs opacity-90">دخول الإدارة والمصرحين</p>
                </div>
              </div>
              <div className="p-6">
                <AdminLoginForm onLogin={onLogin} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* التذييل */}
      <footer className="relative z-10 py-4 text-center">
        <p className="text-xs text-slate-400">
          تصميم وتطوير: <span className="font-bold text-amber-400 tracking-wider">{SYSTEM_NAME}</span>
        </p>
        <p className="text-[10px] text-slate-500 mt-1">
          © {new Date().getFullYear()} الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية
        </p>
      </footer>
    </div>
  );
}

function EmployeeSearchForm({
  onFound,
}: {
  onFound: (result: EmployeeLoginResult & { employee?: Employee }) => void;
}) {
  const [step, setStep] = useState<"national" | "code">("national");
  const [nn, setNn] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const goToCode = () => {
    const cleaned = nn.replace(/[^\d]/g, "").trim();
    if (cleaned.length !== 12) {
      setError("الرقم الوطني يجب أن يكون 12 رقماً بالضبط");
      return;
    }
    setError("");
    setStep("code");
  };

  const login = async () => {
    setError("");
    setLoading(true);
    const cleaned = nn.replace(/[^\d]/g, "").trim();
    const codeUp = code.trim().toUpperCase();

    if (!codeUp) {
      setError("أدخل الكود أولاً");
      setLoading(false);
      return;
    }

    try {
      const employees = await fetchEmployeesFromSheet();
      const found = findEmployeeByNationalNumber(employees, cleaned);

      if (!found) {
        setError("❌ الرقم الوطني غير موجود في المنظومة. راجع إدارة المنظومة.");
        setLoading(false);
        return;
      }

      const codeKey = `emp_code_${cleaned}`;
      const stored = JSON.parse(localStorage.getItem(codeKey) || "{}");

      if (stored.blocked === true) {
        setError("🚫 الحساب محجوب بسبب 3 محاولات خاطئة. يرجى مراجعة الإدارة.");
        setLoading(false);
        return;
      }

      const expectedCode = stored.code || INIT_CODE;
      const currentAttempts = stored.attempts || 0;

      if (codeUp !== expectedCode) {
        const newAttempts = currentAttempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
          localStorage.setItem(
            codeKey,
            JSON.stringify({
              ...stored,
              attempts: MAX_LOGIN_ATTEMPTS,
              blocked: true,
              blockDate: new Date().toISOString(),
              blockReason: "3 محاولات خاطئة",
            })
          );
          setError("🚫 تم حجب الحساب بعد 3 محاولات خاطئة. راجع الإدارة.");
        } else {
          localStorage.setItem(codeKey, JSON.stringify({ ...stored, attempts: newAttempts }));
          setError(`❌ كود خاطئ. المحاولات المتبقية: ${MAX_LOGIN_ATTEMPTS - newAttempts}`);
        }
        setLoading(false);
        return;
      }

      const isFirstLogin = !stored.code || stored.code === INIT_CODE;
      const personalCodeToSave = isFirstLogin ? generatePersonalCode() : stored.code;
      const now = new Date();
      const expiryISO = stored.expiry || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

      localStorage.setItem(
        codeKey,
        JSON.stringify({
          ...stored,
          attempts: 0,
          blocked: false,
          lastLogin: now.toISOString(),
          code: personalCodeToSave,
          codeGeneratedAt: stored.codeGeneratedAt || now.toISOString(),
          expiry: expiryISO,
          isFirstLogin: false,
        })
      );

      addLog(
        {
          userId: "public",
          username: cleaned,
          fullName: (found as Record<string, string>).fullName || "",
          role: "employee",
        },
        "public_search",
        `دخول موظف: ${cleaned} ${isFirstLogin ? "(أول دخول)" : ""}`
      );

      const missing = getMissingFields(found);

      onFound({
        employee: found,
        status: "success",
        missing,
        isComplete: missing.length === 0,
        personalCode: isFirstLogin ? personalCodeToSave : undefined,
        codeType: isFirstLogin ? "كود شخصي جديد (للمرات القادمة)" : "كود الدخول",
        expiry: new Date(expiryISO).toLocaleDateString("ar-LY"),
      });
    } catch {
      setError("حدث خطأ أثناء التحقق. حاول مجدداً.");
    } finally {
      setLoading(false);
    }
  };

  const generatePersonalCode = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let personal = "";
    for (let i = 0; i < 8; i++) {
      personal += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return personal.match(/.{1,4}/g)?.join("-") || personal;
  };

  return (
    <div className="space-y-3">
      {step === "national" ? (
        <>
          <div>
            <label className="text-xs text-slate-600 mb-1 block font-medium">الرقم الوطني</label>
            <input
              type="text"
              value={nn}
              onChange={(e) => {
                setNn(e.target.value.replace(/[^\d]/g, "").slice(0, 12));
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && goToCode()}
              placeholder="أدخل رقمك الوطني"
              inputMode="numeric"
              maxLength={12}
              className="w-full px-3 py-3 border-2 border-slate-300 rounded-xl text-base font-mono text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none tracking-widest"
              dir="ltr"
              autoFocus
            />
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="text-slate-400">يتكون من 12 رقماً بالضبط</span>
              <span dir="ltr" className={`font-bold ${nn.length === 12 ? "text-emerald-600" : "text-slate-400"}`}>
                {nn.length}/12
              </span>
            </div>
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 text-center">{error}</div>}
          <button
            onClick={goToCode}
            disabled={nn.length !== 12}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-sm transition shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
          >
            التالي →
          </button>
        </>
      ) : (
        <>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-emerald-600">الرقم الوطني المدخل</p>
              <p className="font-mono font-bold text-emerald-800" dir="ltr">{nn}</p>
            </div>
            <button onClick={() => { setStep("national"); setCode(""); setError(""); setAttempts(0); }} className="text-[10px] text-emerald-600 hover:text-emerald-800 underline">
              تغيير
            </button>
          </div>
          <div>
            <label className="text-xs text-slate-600 mb-2 block font-medium">كود الدخول الآمن</label>
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 10)); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && login()}
              placeholder="أدخل الكود هنا"
              className="w-full px-4 py-6 border-3 border-slate-300 rounded-2xl text-3xl font-mono font-bold text-center tracking-widest focus:ring-3 focus:ring-emerald-500 focus:border-emerald-500 outline-none uppercase shadow-lg transition-all"
              dir="ltr"
              autoFocus
            />
            <div className="mt-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200">
              <p className="text-sm text-center font-semibold text-amber-900">🔑 أول مرة؟ استخدم الكود المبدئي:</p>
              <p className="font-mono font-bold text-2xl text-center text-amber-700 mt-2 tracking-wider">{INIT_CODE}</p>
            </div>
          </div>
          {attempts > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-center text-red-600 font-medium">
                المحاولات المتبقية: {Math.max(0, MAX_LOGIN_ATTEMPTS - attempts)}/{MAX_LOGIN_ATTEMPTS}
              </p>
              <div className="flex gap-1.5 justify-center">
                {Array.from({ length: MAX_LOGIN_ATTEMPTS }).map((_, i) => (
                  <div key={i} className={`h-2.5 w-10 rounded-full transition-all ${i < attempts ? "bg-red-500" : "bg-slate-200"}`} />
                ))}
              </div>
            </div>
          )}
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 text-center">{error}</div>}
          <div className="flex gap-2">
            <button onClick={() => { setStep("national"); setCode(""); setError(""); }} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition">
              ← رجوع
            </button>
            <button onClick={login} disabled={loading || !code.trim()} className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-sm transition shadow-md disabled:opacity-50">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جاري التحقق...
                </span>
              ) : "🔐 دخول"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AdminLoginForm({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const tryLogin = async () => {
    const user = await findUser(username, password);
    if (!user) {
      setError("اسم المستخدم أو كلمة المرور غير صحيحة");
      setPassword("");
      return;
    }
    onLogin(user);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-slate-500 mb-1 block">اسم المستخدم</label>
        <input
          type="text"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && tryLogin()}
          placeholder="username"
          className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          dir="ltr"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">كلمة المرور</label>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && tryLogin()}
          placeholder="••••••"
          className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          dir="ltr"
        />
      </div>
      {error && <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg p-2 text-center">{error}</p>}
      <button onClick={tryLogin} className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-medium text-sm transition shadow-md">
        🔓 دخول
      </button>
    </div>
  );
}