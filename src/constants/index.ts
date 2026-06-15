// ============================================================
// CONSTANTS - الثوابت العامة للمنظومة
// ============================================================

export const NACC_LOGO = "/images/nacc-logo.png";
export const LIBYA_FLAG = "/images/libya-flag.png";
export const SYSTEM_NAME = "S-BUTTO";
export const INIT_CODE = "NACC2026";
export const MAX_LOGIN_ATTEMPTS = 3;

export const ALL_FIELD_LABELS: Record<string, string> = {
  // ✅ مسميات Google Sheets الفعلية (مع التطويل)
  fullName: "الاســـم ربــاعـــي",
  nationalNumber: "الرقم الوطني",
  jobNumber: "الرقم الوظيفي",
  jobGrade: "الدرجة الوظيفية الحالية",
  qualification: "المؤهل العلمي  ",
  specialization: "التخصص",
  grade: "التقدير",
  qualificationOrigin: "أصل المؤهل/مكان الحصول علي المؤهل.",
  bankName: "أســـــم المصــــرف",
  iban: "رقم الحساب الدولي / الايبان",
  appointmentDecision: "رقم قرار التعيين او قرار النقل / السنة",
  startDate: "تاريخ مباشرة العمل",
  promotionDate: "استحقاق العلاوة  /اخر ترقية ",
  phone: "رقم الهاتف",
  department: "الإدارة",
  section: "القسم",
  gender: "الجنس",
  receivesPension: "يتقاضى معاش  ",  // ✅ إزالة التكرار (p)
  status: "الحالة",
  dataComplete: "هل البيانات مكتملة",
  jobStatus: "الحالة الوظيفية",
  employmentType: "نوع التوظيف",
  notes: "ملاحظات",
  requiredAction: "الإجراء المطلوب",
};

export const STANDARD_EMPLOYEE_KEYS = new Set([
  "timestamp", "nationalNumber", "jobNumber", "fullName", "bankName", "iban",
  "jobGrade", "qualification", "specialization", "qualificationOrigin", "grade",
  "appointmentDecision", "startDate", "promotionDate", "phone", "receivesPension",
  "status", "notes", "requiredAction", "department", "section", "jobStatus",
  "employmentType", "dataComplete", "gender",
]);

// ✅ دالة تنظيف الأسماء من Google Sheets
export function normalizeFieldName(name: string): string {
  return name
    .replace(/ـ/g, "")  // إزالة التطويل
    .replace(/\s+/g, " ")  // توحيد المسافات
    .trim()
    .toLowerCase();
}