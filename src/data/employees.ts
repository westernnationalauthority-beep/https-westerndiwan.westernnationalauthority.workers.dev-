// ============================================================
// data/employees.ts - طبقة البيانات والاتصال بـ Google Sheets
// تعتمد على طبقة تطبيع الحقول في normalizeFields.ts
// ============================================================

import { mapRow, logMapping, auditHeaders } from "../lib/normalizeFields";

export interface Employee {
  timestamp: string;
  nationalNumber: string;
  jobNumber: string;
  fullName: string;
  bankName: string;
  iban: string;
  jobGrade: string;
  qualification: string;
  specialization: string;
  qualificationOrigin: string;
  grade: string;
  appointmentDecision: string;
  startDate: string;
  promotionDate: string;
  phone: string;
  receivesPension: string;
  p?: string;
  status: string;
  notes: string;
  requiredAction: string;
  branch: string;
  department: string;
  section: string;
  jobStatus: string;
  employmentType: string;
  dataComplete: string;
  gender: string;
}

// يمكن تغيير الرابط من ملف البيئة VITE_API_URL بدون تعديل الكود.
const viteEnv = import.meta as unknown as { env?: Record<string, string | undefined> };
export const API_URL = viteEnv.env?.VITE_API_URL || "https://script.google.com/macros/s/AKfycbz0gUfN3Vgl-_MVI0rIogXoA5RipkA2oRWIUvusSiC5riHnHFxamMLEDgTgPPpQBm9xJw/exec";
export const INITIAL_CODE = "NACC2026";

/* ============================================================
   Cache System
   ============================================================ */
const CACHE_KEY = "sbutto_employees_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 دقائق

interface CacheData {
  employees: Employee[];
  timestamp: number;
}

function saveToCache(employees: Employee[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ employees, timestamp: Date.now() }));
  } catch {}
}

function loadFromCache(): Employee[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: CacheData = JSON.parse(raw);
    if (Date.now() - data.timestamp > CACHE_TTL) return null;
    return data.employees;
  } catch {
    return null;
  }
}

export function clearEmployeesCache(): void {
  localStorage.removeItem(CACHE_KEY);
  console.log("✅ تم مسح كاش الموظفين");
}

export function getCacheAge(): string | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: CacheData = JSON.parse(raw);
    const ageMs = Date.now() - data.timestamp;
    const ageMins = Math.floor(ageMs / 60000);
    const ageSecs = Math.floor((ageMs % 60000) / 1000);
    return ageMins > 0 ? `${ageMins} دقيقة` : `${ageSecs} ثانية`;
  } catch {
    return null;
  }
}

/* ============================================================
   Employee Login
   ============================================================ */
export interface EmployeeLoginResult {
  status: "success" | "wrong_code" | "blocked" | "expired" | "not_found" | "error";
  message?: string;
  fullName?: string;
  isComplete?: boolean;
  missing?: string[];
  personalCode?: string;
  expiry?: string;
  codeType?: string;
  employee?: Employee;
}

export async function employeeLogin(
  nationalNumber: string,
  code: string
): Promise<EmployeeLoginResult> {
  try {
    const url = `${API_URL}?action=employee_login&nn=${encodeURIComponent(nationalNumber)}&code=${encodeURIComponent(code)}&t=${Date.now()}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error("Network error");
    return await res.json();
  } catch {
    return { status: "error", message: "فشل الاتصال بالخادم. حاول مرة أخرى." };
  }
}

export async function generateEmployeeCode(
  nationalNumber: string,
  codeType = "شخصي"
): Promise<{ status: string; code?: string; expiry?: string; message?: string }> {
  const r = await postAction({ action: "generate_code", nationalNumber, codeType });
  const d = (r.data || {}) as { code?: string; expiry?: string };
  return r.ok
    ? { status: "success", code: d.code, expiry: d.expiry }
    : { status: "error", message: r.message || "فشل الاتصال" };
}

export async function unblockEmployee(nationalNumber: string): Promise<{ status: string; message?: string }> {
  const r = await postAction({ action: "unblock", nationalNumber });
  return r.ok ? { status: "success" } : { status: "error", message: r.message || "فشل الاتصال" };
}

/* ============================================================
   Employee Codes - قراءة أكواد الموظفين من Google Sheets
   ============================================================ */
export async function getEmployeeCodesFromSheet(): Promise<Record<string, string>[]> {
  const normalizeRows = (input: unknown): Record<string, string>[] => {
    if (!Array.isArray(input) || input.length === 0) return [];

    if (input.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
      return (input as Record<string, unknown>[]).map((row) => {
        const out: Record<string, string> = {};
        Object.entries(row).forEach(([key, value]) => {
          out[key] = value === null || value === undefined ? "" : String(value);
        });
        return out;
      });
    }

    if (Array.isArray(input[0])) {
      const headers = (input[0] as unknown[]).map((h) => String(h || "").trim());
      return input.slice(1).filter(Array.isArray).map((row) => {
        const out: Record<string, string> = {};
        headers.forEach((header, index) => {
          if (header) out[header] = String((row as unknown[])[index] ?? "").trim();
        });
        return out;
      });
    }

    return [];
  };

  try {
    const res = await fetch(`${API_URL}?action=get_codes&t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    const rows = data?.codes || data?.records || data?.rows || data?.data || data;
    return normalizeRows(rows);
  } catch {
    return [];
  }
}

// دالة مساعدة للبحث عن قيمة باستخدام أسماء بديلة (للأكواد)
export function findValueByAliases(record: Record<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    if (record[alias] !== undefined && record[alias] !== null && record[alias].trim() !== "") {
      return record[alias].trim();
    }
  }
  // بحث جزئي
  for (const alias of aliases) {
    const found = Object.keys(record).find(k => 
      k.toLowerCase().includes(alias.toLowerCase()) || 
      alias.toLowerCase().includes(k.toLowerCase())
    );
    if (found && record[found]) return record[found].trim();
  }
  return "";
}

// دالة البحث عن موظف بالرقم الوطني (مرنة)
export function findEmployeeByNationalNumber(employees: Employee[], nn: string): Employee | null {
  if (!employees || !Array.isArray(employees)) return null;
  if (!nn || typeof nn !== "string") return null;
  const cleaned = nn.replace(/[^\d]/g, "").trim();
  if (!cleaned) return null;
  return employees.find((e) => (e.nationalNumber || "").replace(/[^\d]/g, "").trim() === cleaned) || null;
}

/* ============================================================
   Delete Requests & Archive (محلي + خادم)
   ============================================================ */
export interface DeleteRequest {
  refNum: string;
  nationalNumber: string;
  employeeName: string;
  reason: string;
  docNumber: string;
  docDate: string;
  submitDate: string;
  submittedBy: string;
  status: string;
  adminNote: string;
  adminDate: string;
}

const REQUESTS_KEY = "nacc_delete_requests";
const ARCHIVE_KEY = "nacc_archived_employees";
const DELETED_NN_KEY = "nacc_deleted_national_numbers";

function getReqsLocal(): DeleteRequest[] {
  try { return JSON.parse(localStorage.getItem(REQUESTS_KEY) || "[]"); } catch { return []; }
}
function saveReqsLocal(r: DeleteRequest[]): void {
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(r));
}
function getArchLocal(): Record<string, string>[] {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || "[]"); } catch { return []; }
}
function saveArchLocal(a: Record<string, string>[]): void {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(a));
}
export function getDeletedNationalNumbers(): string[] {
  try { return JSON.parse(localStorage.getItem(DELETED_NN_KEY) || "[]"); } catch { return []; }
}
function addDeletedNN(nn: string): void {
  const cleanedNN = nn.replace(/[^\d]/g, "");
  const list = getDeletedNationalNumbers();
  if (!list.includes(cleanedNN)) {
    list.push(cleanedNN);
    localStorage.setItem(DELETED_NN_KEY, JSON.stringify(list));
  }
}
function removeDeletedNN(nn: string): void {
  const cleanedNN = nn.replace(/[^\d]/g, "");
  const list = getDeletedNationalNumbers().filter(n => n !== cleanedNN);
  localStorage.setItem(DELETED_NN_KEY, JSON.stringify(list));
}

/**
 * 🆕 الحذف المباشر: يضع الموظف في الأرشيف فوراً
 * بدون إنشاء طلب حذف (لا يظهر في "طلبات الحذف")
 */
export async function archiveEmployeeDirect(
  employee: Employee,
  reason: string,
  adminName: string,
  docNumber = "",
  docDate = ""
): Promise<{ status: string; message?: string }> {
  const nn = employee.nationalNumber.replace(/[^\d]/g, "");
  const archived = getArchLocal();
  
  // فلترة بالرقم الوطني - منع التكرار
  const exists = archived.find(a => {
    const archNN = String(a["الرقم الوطني"] || a.nationalNumber || "").replace(/[^\d]/g, "");
    return archNN === nn;
  });
  if (exists) {
    return { status: "error", message: "هذا الموظف موجود في الأرشيف مسبقاً" };
  }
  
  // إنشاء سجل أرشيف
  const archiveRecord: Record<string, string> = {
    "الرقم الوطني": nn,
    "الاســـم ربــاعـــي": employee.fullName,
    "fullName": employee.fullName,
    "nationalNumber": nn,
    "الإدارة": employee.department || "",
    "department": employee.department || "",
    "تاريخ الأرشفة": new Date().toLocaleString("ar-LY"),
    "المؤرشف بواسطة": adminName,
    "السبب": reason,
    "ملاحظة المدير والسبب النهائي": reason,
    "رقم القرار": docNumber,
    "تاريخ القرار": docDate,
  };
  // إضافة باقي البيانات
  Object.entries(employee).forEach(([k, v]) => {
    if (v && !archiveRecord[k]) archiveRecord[k] = String(v);
  });
  archived.unshift(archiveRecord);
  saveArchLocal(archived);
  
  // إضافة الرقم لقائمة المحذوفين (لإخفاء الموظف من القائمة النشطة)
  addDeletedNN(nn);
  
  // محاولة إرسال للخادم (اختياري)
  try {
    await postAction({ action: "archive_employee", nationalNumber: nn, reason, adminName, employee });
  } catch {}
  
  return { status: "success", message: "تم نقل الموظف إلى الأرشيف بنجاح" };
}

export async function requestEmployeeDelete(data: {
  nationalNumber: string;
  employeeName: string;
  reason: string;
  docNumber?: string;
  docDate?: string;
  submittedBy: string;
}): Promise<{ status: string; message?: string; refNum?: string }> {
  const refNum = `DEL-${Date.now()}`;
  const request: DeleteRequest = {
    refNum,
    nationalNumber: data.nationalNumber,
    employeeName: data.employeeName,
    reason: data.reason,
    docNumber: data.docNumber || "",
    docDate: data.docDate || "",
    submitDate: new Date().toLocaleString("ar-LY"),
    submittedBy: data.submittedBy,
    status: "قيد المراجعة",
    adminNote: "",
    adminDate: "",
  };
  const reqs = getReqsLocal();
  reqs.unshift(request);
  saveReqsLocal(reqs);
  
  try { await postAction({ action: "request_delete", ...data }); } catch {}
  
  return { status: "success", message: "تم إرسال طلب الحذف بنجاح", refNum };
}

export async function getDeleteRequests(): Promise<DeleteRequest[]> {
  // المحلي أساس
  const local = getReqsLocal();
  try {
    const res = await fetch(`${API_URL}?action=get_delete_requests&t=${Date.now()}`);
    const data = await res.json();
    if (data.status === "success" && data.requests) {
      // دمج (المحلي له الأولوية)
      const map = new Map<string, DeleteRequest>();
      (data.requests as DeleteRequest[]).forEach(r => map.set(r.refNum, r));
      local.forEach(r => map.set(r.refNum, r));
      return Array.from(map.values());
    }
  } catch {}
  return local;
}

export async function approveDeleteRequest(
  refNum: string,
  adminNote: string,
  adminName: string
): Promise<{ status: string; message?: string }> {
  const reqs = getReqsLocal();
  const req = reqs.find(r => r.refNum === refNum);
  if (req) {
    req.status = "مقبول";
    req.adminNote = adminNote;
    req.adminDate = new Date().toLocaleString("ar-LY");
    saveReqsLocal(reqs);
    
    // أرشفة تلقائية
    const fakeEmp: Employee = {
      fullName: req.employeeName,
      nationalNumber: req.nationalNumber,
    } as Employee;
    await archiveEmployeeDirect(fakeEmp, req.reason, adminName, req.docNumber, req.docDate);
  }
  
  try { await postAction({ action: "approve_delete", refNum, adminNote, adminName }); } catch {}
  return { status: "success" };
}

export async function rejectDeleteRequest(
  refNum: string,
  adminNote: string
): Promise<{ status: string; message?: string }> {
  const reqs = getReqsLocal();
  const req = reqs.find(r => r.refNum === refNum);
  if (req) {
    req.status = "مرفوض";
    req.adminNote = adminNote;
    req.adminDate = new Date().toLocaleString("ar-LY");
    saveReqsLocal(reqs);
  }
  try { await postAction({ action: "reject_delete", refNum, adminNote }); } catch {}
  return { status: "success" };
}

export async function getArchivedEmployees(): Promise<Record<string, string>[]> {
  const local = getArchLocal();
  try {
    const res = await fetch(`${API_URL}?action=get_archive&t=${Date.now()}`);
    const data = await res.json();
    if (data.status === "success" && data.archived) {
      // دمج بدون تكرار (بالرقم الوطني)
      const map = new Map<string, Record<string, string>>();
      [...(data.archived as Record<string, string>[]), ...local].forEach(a => {
        const nn = String(a["الرقم الوطني"] || a.nationalNumber || "").replace(/[^\d]/g, "");
        if (nn) map.set(nn, { ...(map.get(nn) || {}), ...a });
      });
      return Array.from(map.values());
    }
  } catch {}
  return local;
}

export async function restoreEmployeeFromArchive(nationalNumber: string): Promise<{ status: string; message?: string }> {
  const nn = nationalNumber.replace(/[^\d]/g, "");
  const archived = getArchLocal();
  const filtered = archived.filter(a => 
    String(a["الرقم الوطني"] || a.nationalNumber || "").replace(/[^\d]/g, "") !== nn
  );
  saveArchLocal(filtered);
  removeDeletedNN(nn);
  
  try { await postAction({ action: "restore_archive", nationalNumber }); } catch {}
  return { status: "success" };
}

export const DELETE_REASONS = ["نقل لجهة أخرى", "استقالة", "تقاعد", "وفاة", "فصل", "انتهاء عقد", "أخرى"];

export async function cleanArchive(months: number): Promise<{ status: string; message?: string }> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const archived = getArchLocal();
  const filtered = archived.filter(a => {
    const dt = new Date(a["تاريخ الأرشفة"] || "");
    return isNaN(dt.getTime()) || dt >= cutoff;
  });
  saveArchLocal(filtered);
  try { await postAction({ action: "clean_archive", months }); } catch {}
  return { status: "success" };
}

export async function cleanDeleteRequests(months: number, onlyProcessed = true): Promise<{ status: string; message?: string }> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const reqs = getReqsLocal();
  const filtered = reqs.filter(r => {
    if (onlyProcessed && r.status === "قيد المراجعة") return true;
    const dt = new Date(r.submitDate);
    return isNaN(dt.getTime()) || dt >= cutoff;
  });
  saveReqsLocal(filtered);
  try { await postAction({ action: "clean_delete_requests", months, onlyProcessed }); } catch {}
  return { status: "success" };
}

export async function permanentDeleteFromArchive(
  nationalNumber: string,
  adminNote = "",
  adminName = ""
): Promise<{ status: string; message?: string }> {
  const nn = nationalNumber.replace(/[^\d]/g, "");
  const archived = getArchLocal();
  const filtered = archived.filter(a => 
    String(a["الرقم الوطني"] || a.nationalNumber || "").replace(/[^\d]/g, "") !== nn
  );
  saveArchLocal(filtered);
  try { await postAction({ action: "permanent_delete_archive", nationalNumber, adminNote, adminName }); } catch {}
  return { status: "success" };
}

/* ============================================================
   Parse Employees - طبقة قراءة البيانات الثابتة
   تعتمد على normalizeFields.ts لتطبيع واكتشاف الحقول
   ============================================================ */
function parseEmployees(data: unknown): Employee[] {
  if (!Array.isArray(data) || data.length === 0) return [];

  const headers: string[] = Array.isArray(data[0])
    ? (data[0] as string[]).map(h => String(h ?? "").trim())
    : [];

  // فحص العناوين عند أول تحميل (لمرة واحدة في الجلسة)
  try {
    auditHeaders(headers);
  } catch {}

  const employees: Employee[] = [];
  let rowNumber = 0;

  for (const row of data.slice(1)) {
    rowNumber++;
    if (!Array.isArray(row)) continue;

    // 1. تطبيع وبناء الخريطة الثابتة
    const { employee, debug } = mapRow(row, headers);

    // 2. فحص Console لأول 3 صفوف فقط (لتجنب تلوث الـ Console)
    if (rowNumber <= 3) {
      logMapping(`Row ${rowNumber}`, { employee, debug } as any);
    }

    // 3. التصفية: يجب أن يكون هناك اسم أو رقم وطني
    if (!employee.nationalNumber && !employee.fullName) continue;

    // 4. بناء Employee object ثابت - نأخذ فقط الحقول المعروفة
    const emp: Employee = {
      timestamp: employee.timestamp ?? "",
      nationalNumber: employee.nationalNumber ?? "",
      jobNumber: employee.jobNumber ?? "",
      fullName: employee.fullName ?? "",
      bankName: employee.bankName ?? "",
      iban: employee.iban ?? "",
      jobGrade: employee.jobGrade ?? "",
      qualification: employee.qualification ?? "",
      specialization: employee.specialization ?? "",
      qualificationOrigin: employee.qualificationOrigin ?? "",
      grade: employee.grade ?? "",
      appointmentDecision: employee.appointmentDecision ?? "",
      startDate: employee.startDate ?? "",
      promotionDate: employee.promotionDate ?? "",
      phone: employee.phone ?? "",
      receivesPension: employee.receivesPension ?? "",
      p: employee.p ?? employee.receivesPension ?? "",
      status: employee.status ?? "",
      notes: employee.notes ?? "",
      requiredAction: employee.requiredAction ?? "",
      branch: employee.branch ?? "",
      department: employee.department ?? "",
      section: employee.section ?? "",
      jobStatus: employee.jobStatus ?? "",
      employmentType: employee.employmentType ?? "",
      dataComplete: employee.dataComplete ?? "",
      gender: employee.gender ?? "",
    };

    employees.push(emp);
  }

  // ملخص التحميل
  console.log(
    `✅ [Normalize] تم بناء ${employees.length} موظف بنجاح من أصل ${rowNumber} صف`
  );

  return employees;
}

/* ============================================================
   Fetch Employees - الجلب الرئيسي للبيانات
   ============================================================ */
export async function fetchEmployeesFromSheet(forceRefresh = false): Promise<Employee[]> {
  console.log("🔄 جاري جلب البيانات من Google Sheets...", forceRefresh ? "(إجباري)" : "(من الكاش)");

  if (!forceRefresh) {
    const cached = loadFromCache();
    if (cached) {
      console.log(`✅ تم تحميل ${cached.length} موظف من الكاش`);
      // تحديث في الخلفية
      fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((data) => {
          const fresh = parseEmployees(data);
          if (fresh.length > 0) {
            saveToCache(fresh);
            console.log(`🔄 تم تحديث الكاش بـ ${fresh.length} موظف`);
          }
        })
        .catch((err) => {
          console.warn("⚠️ فشل تحديث الكاش في الخلفية:", err);
        });
      return cached;
    }
  }

  try {
    console.log("🌐 جاري الاتصال بـ Google Sheets...");
    const response = await fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" });
    
    if (!response.ok) {
      throw new Error(`فشل جلب البيانات (HTTP ${response.status})`);
    }
    
    const data = await response.json();
    
    if (!data || !Array.isArray(data)) {
      throw new Error("البيانات المستلمة غير صالحة");
    }

    const employees = parseEmployees(data);
    
    if (employees.length > 0) {
      saveToCache(employees);
      console.log(`✅ تم جلب ${employees.length} موظف بنجاح`);
    } else {
      console.warn("⚠️ لم يتم العثور على أي موظف في Google Sheets");
    }
    
    return employees;
  } catch (err) {
    console.error("❌ خطأ في fetchEmployeesFromSheet:", err);
    
    // محاولة الرجوع للكاش كملاذ أخير
    const cached = loadFromCache();
    if (cached) {
      console.log(`⚠️ العودة للكاش القديم (${cached.length} موظف)`);
      return cached;
    }
    
    return [];
  }
}

/* ============================================================
   Update / Add / Delete Employees
   ============================================================ */
export interface ActionResult {
  ok: boolean;
  status?: string;
  message?: string;
  data?: unknown;
}

export async function updateEmployeeInSheet(
  nationalNumber: string,
  updates: Record<string, string>
): Promise<ActionResult> {
  const result = await postAction({ action: "update", nationalNumber, updates });
  if (result.ok) clearEmployeesCache();
  return result;
}

export async function deleteEmployeeFromSheet(nationalNumber: string): Promise<ActionResult> {
  const result = await postAction({ action: "delete", nationalNumber });
  if (result.ok) clearEmployeesCache();
  return result;
}

export async function addEmployeeToSheet(employee: Partial<Employee>): Promise<ActionResult> {
  const result = await postAction({ action: "add", employee });
  if (result.ok) clearEmployeesCache();
  return result;
}

export async function addColumnToSheet(columnName: string): Promise<ActionResult> {
  return postAction({ action: "add_column", columnName });
}

export async function deleteColumnFromSheet(columnName: string): Promise<ActionResult> {
  return postAction({ action: "delete_column", columnName });
}

/* ============================================================
   POST Helper - إرسال الطلبات للخادم
   ============================================================ */
async function postAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
      cache: "no-store",
    });

    if (!res.ok) {
      return { ok: false, message: `فشل الخادم (HTTP ${res.status})` };
    }

    const text = await res.text();
    if (!text) return { ok: true };

    try {
      const json = JSON.parse(text);
      const status = json.status as string | undefined;
      const ok = status === undefined ? true : status === "success" || status === "ok";
      return { ok, status, message: json.message, data: json };
    } catch {
      const looksLikeError = /error|fail|خطأ|فشل/i.test(text);
      return { ok: !looksLikeError, message: looksLikeError ? text.slice(0, 200) : undefined };
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "فشل الاتصال بالخادم" };
  }
}
