// ============================================================
// normalizeFields.ts - طبقة تطبيع واكتشاف الحقول
// ثابتة، مقاومة لتغييرات Google Sheets
// ============================================================

/*
 * الخطة:
 * 1. normalize(text): تنظيف النص (إزالة تطويل، توحيد مسافات، حروف)
 * 2. detectField(name): تحويل اسم العمود إلى حقل قياسي
 * 3. mapRow(row, headers): بناء employee object بحقول ثابتة فقط
 */

// ──────────────────────────────────────────────
// 1. دالة التطبيع
// ──────────────────────────────────────────────
const ARABIC_NORMALIZATION_MAP: Record<string, string> = {
  // توحيد الألف
  "إ": "ا", "أ": "ا", "آ": "ا", "ٱ": "ا",
  // توحيد الياء والهمزة
  "ى": "ي", "ئ": "ي",
  // توحيد الواو
  "ؤ": "و",
  // توحيد التاء المربوطة
  "ة": "ه",
};

export function normalize(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return "";
  let s = String(text);

  // 1. إزالة التطويل (ـ)
  s = s.replace(/ـ/g, "");

  // 2. إزالة التشكيل
  s = s.replace(/[\u064B-\u065F\u0670\u0640]/g, "");

  // 3. توحيد الحروف العربية
  s = s.split("").map(c => ARABIC_NORMALIZATION_MAP[c] ?? c).join("");

  // 4. إزالة المسافات الزائدة
  s = s.trim().replace(/\s+/g, " ");

  // 5. تحويل لأحرف صغيرة (مفيد للمقارنة الإنجليزية)
  s = s.toLowerCase();

  // 6. إزالة علامات الترقيم الشائعة في العناوين
  s = s.replace(/[()\[\]{}،؛!?:;.,\/\\]/g, "").trim();

  return s;
}

// ──────────────────────────────────────────────
// 2. خريطة اكتشاف الحقول
// ──────────────────────────────────────────────
// كل حقل قياسي له قائمة بالأسماء المحتملة (بعد التطبيع)
const FIELD_ALIAS_MAP: Record<string, string[]> = {
  // ✅ الأسماء الفعلية من Apps Script (colMap) - حرفياً مع المسافات
  nationalNumber: [
    "الرقم الوطني",
  ],
  jobNumber: [
    "الرقم الوظيفي",
  ],
  fullName: [
    "الاسم", "الاسم رباعي", "الاســـم رباعـــي",
  ],
  bankName: [
    "المصرف", "اسم المصرف", "أســـــم المصــــرف",
  ],
  iban: [
    "رقم الحساب الدولي / الايبان", "iban", "رقم الحساب",
  ],
  jobGrade: [
    "الدرجة الوظيفية الحالية", "الدرجة الوظيفية", "الدرجة الوظيفيه",
  ],
  department: [
    "الإدارة", "الاداره", "الادارة",
  ],
  section: [
    "القسم", "الشعبة",
  ],
  jobStatus: [
    "الحالة الوظيفية",
  ],
  status: [
    "الحالة",
  ],
  phone: [
    "رقم الهاتف",
  ],
  gender: [
    "الجنس",
  ],
  qualification: [
    "المؤهل العلمي", "المؤهل العلمي  ",
  ],
  specialization: [
    "التخصص",
  ],
  startDate: [
    "تاريخ مباشرة العمل", "تاريخ المباشرة",
  ],
  receivesPension: [
    "يتقاضى معاش", "يتقاضى معاش  ",
  ],
  employmentType: [
    "نوع التوظيف",
  ],
  notes: [
    "ملاحظات",
  ],
  requiredAction: [
    "الإجراء المطلوب",
  ],
  branch: [
    "الفرع", "branch",
  ],
  grade: [
    "التقدير",
  ],
  qualificationOrigin: [
    "أصل المؤهل/مكان الحصول علي المؤهل.", "أصل المؤهل", "اصل المؤهل/مكان الحصول علي المؤهل.",
  ],
  appointmentDecision: [
    "رقم قرار التعيين او قرار النقل / السنة", "رقم قرار التعيين", "رقم القرار",
  ],
  promotionDate: [
    "استحقاق العلاوة  /اخر ترقية ", "تاريخ آخر ترقية", "استحقاق العلاوة",
  ],
  dataComplete: [
    "هل البيانات مكتملة", "اكتمال البيانات",
  ],
  timestamp: [
    "طابع زمني", "timestamp",
  ],
};

// الحقول التي نسمح بوجودها في الناتج النهائي (نوع Employee القياسي)
export const ALLOWED_EMPLOYEE_FIELDS: ReadonlyArray<string> = [
  "timestamp",
  "nationalNumber",
  "jobNumber",
  "fullName",
  "bankName",
  "iban",
  "jobGrade",
  "qualification",
  "specialization",
  "qualificationOrigin",
  "grade",
  "appointmentDecision",
  "startDate",
  "promotionDate",
  "phone",
  "receivesPension",
  "p",
  "status",
  "notes",
  "requiredAction",
  "branch",
  "department",
  "section",
  "jobStatus",
  "employmentType",
  "dataComplete",
  "gender",
];

// ──────────────────────────────────────────────
// 3. دالة detectField - تطابق تام أولاً، ثم جزئي بأولوية ذكية
// ──────────────────────────────────────────────
export function detectField(columnName: string | number | null | undefined): string | null {
  if (columnName === null || columnName === undefined) return null;

  const normalized = normalize(columnName);
  if (!normalized) return null;

  // 1) محاولة التطابق التام (أولوية قصوى)
  for (const [field, aliases] of Object.entries(FIELD_ALIAS_MAP)) {
    for (const alias of aliases) {
      if (normalized === normalize(alias)) {
        return field;
      }
    }
  }

  // 2) محاولة التطابق الجزئي بترتيب طول الـ alias (الأطول أولاً = أكثر دقة)
  // مثال: "تاريخ آخر ترقية" يجب أن يطابق promotionDate قبل أن يطابق "تاريخ" → startDate
  const allMatches: { field: string; alias: string; score: number }[] = [];
  
  for (const [field, aliases] of Object.entries(FIELD_ALIAS_MAP)) {
    for (const alias of aliases) {
      const normAlias = normalize(alias);
      if (!normAlias) continue;
      
      // التطابق الجزئي
      if (normalized.includes(normAlias)) {
        // الـ alias الأطول = أكثر تخصيصاً
        allMatches.push({ field, alias: normAlias, score: normAlias.length });
      } else if (normAlias.includes(normalized) && normalized.length >= 3) {
        // العكس: اسم العمود قصير وتحتويه الـ alias (لكن نتجنب التطابق التافه)
        allMatches.push({ field, alias: normAlias, score: normalized.length - 5 });
      }
    }
  }

  // اختيار أفضل تطابق (أطول alias = أعلى score)
  if (allMatches.length > 0) {
    allMatches.sort((a, b) => b.score - a.score);
    return allMatches[0].field;
  }

  // عمود غير معروف → تجاهله (return null)
  return null;
}

// ──────────────────────────────────────────────
// 4. دالة تطبيع قيمة حقل معين
// ──────────────────────────────────────────────
export function normalizeValue(
  raw: unknown,
  fieldName: string,
  _headers?: string[]
): string {
  if (raw === null || raw === undefined) return "";

  let value = String(raw).trim();

  // تطبيع خاص بالرقم الوطني: فقط أرقام
  if (fieldName === "nationalNumber" || fieldName === "jobNumber") {
    return value.replace(/[^\d]/g, "");
  }

  // تطبيع خاص بـ IBAN
  if (fieldName === "iban") {
    return value.toUpperCase().replace(/\s+/g, "");
  }

  // تطبيع خاص بـ boolean fields
  if (fieldName === "receivesPension" || fieldName === "dataComplete" || fieldName === "p") {
    const v = normalize(value);
    if (v.includes("نعم") || v === "yes" || v === "1" || v === "true") return "نعم";
    if (v.includes("لا") || v === "no" || v === "0" || v === "false") return "لا";
    return v;
  }

  return value;
}

// ──────────────────────────────────────────────
// 5. دالة mapRow: بناء employee ثابت
// ──────────────────────────────────────────────
export interface MapRowResult {
  employee: Record<string, string>;
  debug: {
    rawRow: unknown[];
    headers: string[];
    mapped: Record<string, { columnIndex: number; rawValue: string; normalizedValue: string }>;
    ignored: { columnIndex: number; header: string; rawValue: string }[];
  };
}

export function mapRow(
  row: unknown[],
  headers: string[]
): MapRowResult {
  const mapped: MapRowResult["debug"]["mapped"] = {};
  const ignored: MapRowResult["debug"]["ignored"] = [];
  const employee: Record<string, string> = {};

  // خطوة 1: اكتشاف الحقول من العناوين
  const fieldByColumnIndex: Record<number, string | null> = {};
  headers.forEach((header, idx) => {
    const detected = detectField(header);
    fieldByColumnIndex[idx] = detected;
  });

  // خطوة 2: قراءة القيم وتعيينها
  row.forEach((rawValue, idx) => {
    const header = headers[idx];
    const detected = fieldByColumnIndex[idx];
    const rawString = rawValue === null || rawValue === undefined ? "" : String(rawValue).trim();

    if (detected && ALLOWED_EMPLOYEE_FIELDS.includes(detected)) {
      const normalizedValue = normalizeValue(rawValue, detected, headers);

      // أولوية: إذا كان الحقل موجوداً مسبقاً (عمود مكرر)، نحافظ على الأول (غير فارغ إن أمكن)
      const existingValue = employee[detected] ?? "";
      if (!existingValue && normalizedValue) {
        employee[detected] = normalizedValue;
      } else if (existingValue && !normalizedValue) {
        // اترك الأول
      } else if (normalizedValue) {
        // دمج القيم في notes في حال تكرار الحقل
        const combined = `${existingValue} | ${normalizedValue}`.trim();
        employee[detected] = combined;
      }

      mapped[detected] = {
        columnIndex: idx,
        rawValue: rawString,
        normalizedValue: employee[detected],
      };
    } else if (header !== undefined && header !== null && String(header).trim() !== "") {
      // عمود غير معروف → تجاهل تماماً
      ignored.push({
        columnIndex: idx,
        header: String(header),
        rawValue: rawString,
      });
    }
  });

  return { employee, debug: { rawRow: row, headers, mapped, ignored } };
}

// ──────────────────────────────────────────────
// 6. دالة logMapping: عرض الفحص في Console
// ──────────────────────────────────────────────
export function logMapping(
  label: string,
  result: MapRowResult
): void {
  console.group(`📋 [Normalize] ${label}`);

  console.log("📥 RAW ROW:", result.debug.rawRow);
  console.log("📌 HEADERS:", result.debug.headers);
  console.log("✅ MAPPED EMPLOYEE:", result.employee);

  if (result.debug.ignored.length > 0) {
    console.warn("🚫 IGNORED COLUMNS:", result.debug.ignored);
  }

  // BANK VALUE قبل وبعد (مثال توضيحي)
  const bankInfo = result.debug.mapped["bankName"];
  if (bankInfo) {
    console.log("🏦 BANK VALUE - Before:", bankInfo.rawValue);
    console.log("🏦 BANK VALUE - After :", bankInfo.normalizedValue);
  } else {
    console.warn("🏦 BANK VALUE - Not found in row");
  }

  console.groupEnd();
}

// ──────────────────────────────────────────────
// 7. فحص تلقائي للأعمدة عند التحميل
// ──────────────────────────────────────────────
export function auditHeaders(headers: string[]): {
  recognized: { header: string; mappedTo: string }[];
  unrecognized: { header: string; original: string }[];
} {
  const recognized: { header: string; mappedTo: string }[] = [];
  const unrecognized: { header: string; original: string }[] = [];

  headers.forEach((header) => {
    const detected = detectField(header);
    if (detected) {
      recognized.push({ header, mappedTo: detected });
    } else if (header && String(header).trim() !== "") {
      unrecognized.push({ header, original: header });
    }
  });

  console.group("🔍 [Audit] Column Detection");
  console.log(`✅ Recognized: ${recognized.length}`, recognized);
  if (unrecognized.length > 0) {
    console.warn(`❌ Unrecognized: ${unrecognized.length}`, unrecognized);
  } else {
    console.log("🎉 All columns recognized!");
  }
  console.groupEnd();

  return { recognized, unrecognized };
}

// ──────────────────────────────────────────────
// 8. اختبار Console (يُنفَّذ مرة واحدة عند بدء التطبيق)
// ──────────────────────────────────────────────
export function runMappingTest(): void {
  console.group("🧪 [Mapping Test] - اختبار تطبيع واكتشاف الحقول");

  // ✅ الأعمدة الفعلية من Apps Script colMap (26 عمود - أسماء حرفية)
  const actualSheetHeaders = [
    "طابع زمني",
    "الرقم الوطني",
    "الرقم الوظيفي",
    "الاســـم ربــاعـــي",
    "أســـــم المصــــرف",
    "رقم الحساب الدولي / الايبان",
    "الدرجة الوظيفية الحالية",
    "المؤهل العلمي  ",
    "التخصص",
    "أصل المؤهل/مكان الحصول علي المؤهل.",
    "التقدير",
    "رقم قرار التعيين او قرار النقل / السنة",
    "تاريخ مباشرة العمل",
    "استحقاق العلاوة  /اخر ترقية ",
    "رقم الهاتف",
    "يتقاضى معاش  ",
    "الحالة",
    "ملاحظات",
    "الإجراء المطلوب",
    "الفرع",
    "الإدارة",
    "القسم",
    "الحالة الوظيفية",
    "نوع التوظيف",
    "هل البيانات مكتملة",
    "الجنس",
  ];

  const unmapped: string[] = [];
  const mapped: { header: string; field: string }[] = [];

  actualSheetHeaders.forEach((h) => {
    const detected = detectField(h);
    if (detected) {
      mapped.push({ header: h, field: detected });
    } else {
      unmapped.push(h);
    }
  });

  console.log(` Google Sheets: ${actualSheetHeaders.length} عمود`);
  console.log(`✅ تم التعرف على: ${mapped.length}`);
  console.log(`❌ لم يُعرف: ${unmapped.length}`);

  if (unmapped.length > 0) {
    console.warn("⚠️ unmapped:", unmapped);
  } else {
    console.log("🎉 جميع الأعمدة الـ 26 تم التعرف عليها!");
  }

  // جدول مطابقة كامل
  console.group("📋 جدول المطابقة الكامل");
  mapped.forEach(({ header, field }) => {
    console.log(`   "${header}" → ${field}`);
  });
  console.groupEnd();

  console.groupEnd();
}

// تنفيذ الاختبار تلقائياً عند الاستيراد (مرة واحدة)
if (typeof window !== "undefined") {
  try {
    runMappingTest();
  } catch (e) {
    console.error("[Mapping Test] failed:", e);
  }
}
