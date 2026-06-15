// ============================================================
// HELPERS - دوال مساعدة منظمة حسب الوظيفة
// ============================================================

import { type Employee } from "../data/employees";
import { getCustomFields, getRequiredFieldsConfig, getFieldAliases } from "../lib/storage";
import { ALL_FIELD_LABELS, STANDARD_EMPLOYEE_KEYS } from "../constants";

// ──────────────────────────────────────────────
// كود الدخول العشوائي
// ──────────────────────────────────────────────
export function generateRandomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ──────────────────────────────────────────────
// واتساب
// ──────────────────────────────────────────────
export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone || typeof phone !== "string") return "";
  let p = phone.replace(/[^\d]/g, "").trim();
  if (!p) return "";
  if (p.startsWith("0")) p = "218" + p.slice(1);
  if (!p.startsWith("218")) p = "218" + p;
  return p;
}

export function openWhatsApp(phone: string, message: string): void {
  try {
    const formattedPhone = formatPhoneForWhatsApp(phone);
    if (!formattedPhone) {
      console.warn("[v0] Invalid phone number for WhatsApp");
      return;
    }
    const encoded = encodeURIComponent(message || "");
    window.open(`https://wa.me/${formattedPhone}?text=${encoded}`, "_blank");
  } catch (err) {
    console.error("[v0] WhatsApp error:", err);
  }
}

const SIGNATURE = `منظومة S-BUTTO\nالهيئة الوطنية لمكافحة الفساد\nديوان المنطقة الغربية`;

export function sendCodeViaWhatsApp(phone: string, name: string, code: string): void {
  const msg = `السلام عليكم
الأستاذ/ة: ${name}

كود الدخول الخاص بك لمنظومة بيانات الموظفين:

🔐 ${code}

⚠️ يرجى عدم مشاركة هذا الكود مع أي شخص.
صالح لمدة 3 أشهر من تاريخ آخر استخدام.

${SIGNATURE}`;
  openWhatsApp(phone, msg);
}

export function sendMissingFieldsViaWhatsApp(
  phone: string,
  name: string,
  missingFields: string[]
): void {
  const fieldsList = missingFields.map((f, i) => `${i + 1}. ${f}`).join("\n");
  const msg = `السلام عليكم
الأستاذ/ة: ${name}

⚠️ بياناتك في منظومة الموظفين غير مكتملة.
يرجى مراجعة الإدارة لاستكمال البيانات التالية:

${fieldsList}

📍 ديوان المنطقة الغربية
${SIGNATURE}`;
  openWhatsApp(phone, msg);
}

export function sendGeneralWhatsApp(phone: string, name: string, message: string): void {
  const msg = `السلام عليكم
الأستاذ/ة: ${name}

${message}

${SIGNATURE}`;
  openWhatsApp(phone, msg);
}

// ──────────────────────────────────────────────
// الحقول الناقصة
// ──────────────────────────────────────────────
export function isEmpty(v: string | undefined | null): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v !== "string") return true;
  const t = v.trim();
  
  // ✅ فحص شامل للفراغ
  if (!t) return true;  // فارغ تماماً أو مسافات فقط
  
  // ✅ القيم التي تُعتبر فارغة
  const emptyValues = ["-", "n/a", "na", "null", "undefined", ""];
  if (emptyValues.includes(t.toLowerCase())) return true;
  
  // ✅ حالات "قيد التنفيذ"
  const pendingValues = ["تحت الاجراء", "تحت الإجراء", "قيد الإجراء", "قيد الاجراء"];
  if (pendingValues.includes(t.toLowerCase())) return true;
  
  return false;
}

export function getMissingFields(emp: Employee | null | undefined): string[] {
  if (!emp) return [];
  if (typeof emp !== "object") return [];
  
  const config = getRequiredFieldsConfig();
  const customFields = getCustomFields();
  const aliases = getFieldAliases();
  const missing: string[] = [];
  const checkedKeys = new Set<string>();  // ✅ منع التكرار

  // ✅ فحص الحقول الأساسية
  Object.entries(ALL_FIELD_LABELS).forEach(([key, label]) => {
    if (config[key] && !checkedKeys.has(key)) {
      const value = (emp as unknown as Record<string, string | null | undefined>)[key];
      if (isEmpty(value)) {
        missing.push(aliases[key] || label);
      }
      checkedKeys.add(key);
    }
  });

  // ✅ فحص الحقول المخصصة (بدون تكرار)
  customFields.forEach((cf) => {
    if (cf.isRequired && !checkedKeys.has(cf.key)) {
      const empData = emp as unknown as Record<string, string | null | undefined>;
      const value = empData[cf.label] ?? empData[cf.key];  // ✅ فحص مرة واحدة فقط
      
      if (isEmpty(value)) {
        missing.push(aliases[cf.key] || cf.label);
      }
      checkedKeys.add(cf.key);
    }
  });

  return missing;
}

// ──────────────────────────────────────────────
// مزامنة الحقول المخصصة من Google Sheets
// ──────────────────────────────────────────────
export function getDetectedSheetColumns(employees: Employee[]): string[] {
  const labels = new Set<string>();
  employees.forEach((emp) => {
    Object.keys(emp || {}).forEach((key) => {
      if (!STANDARD_EMPLOYEE_KEYS.has(key) && key.trim()) {
        labels.add(key.trim());
      }
    });
  });
  return Array.from(labels);
}

export function syncCustomFieldsFromSheet(_employees: Employee[]): void {
  // ✅ تم إيقاف الإضافة التلقائية للحقول من Google Sheets
  // لمنع ظهور حقول غير مطلوبة
  // يمكن للمدير إضافة الحقول يدوياً من تبويب "الحقول والنواقص"
}

// ──────────────────────────────────────────────
// تصدير CSV
// ──────────────────────────────────────────────
export function exportCSV(data: Employee[] | null | undefined, filename: string): void {
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn("[v0] Cannot export empty data");
    return;
  }
  const customFields = getCustomFields();
  const headers = [
    "الرقم الوطني", "الاسم رباعي", "الرقم الوظيفي", "الدرجة الوظيفية",
    "المؤهل العلمي", "التخصص", "المصرف", "رقم الحساب (IBAN)",
    "رقم قرار التعيين", "تاريخ المباشرة", "رقم الهاتف",
    "الحالة", "اكتمال البيانات", "عدد النواقص", "الإدارة", "القسم", "الجنس",
    ...customFields.map((cf) => cf.label),
  ];

  const rows = data.map((e) => {
    const emp = (e || {}) as unknown as Record<string, string | null | undefined>;
    return [
      emp.nationalNumber || "", emp.fullName || "", emp.jobNumber || "", emp.jobGrade || "",
      emp.qualification || "", emp.specialization || "", emp.bankName || "", emp.iban || "",
      emp.appointmentDecision || "", emp.startDate || "", emp.phone || "",
      emp.status || "", emp.dataComplete || "", String(getMissingFields(e).length),
      emp.department || "", emp.section || "", emp.gender || "",
      ...customFields.map((cf) => emp[cf.label] || emp[cf.key] || ""),
    ];
  });

  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  try {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("[v0] CSV export error:", err);
  }
}
