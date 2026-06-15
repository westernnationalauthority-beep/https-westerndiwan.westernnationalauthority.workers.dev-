// ============================================================
// employeeStatus.ts - نظام Soft Delete موحد للموظفين
// (Status-Based: لا يتم نسخ السجلات بين الجداول)
// ============================================================

/**
 * SQL Equivalent:
 * 
 * ALTER TABLE employees 
 * ADD COLUMN employee_status VARCHAR(20) DEFAULT 'active' 
 *   CHECK (employee_status IN ('active', 'pending_delete', 'archived')),
 * ADD COLUMN delete_reason TEXT,
 * ADD COLUMN delete_requested_by VARCHAR(255),
 * ADD COLUMN delete_requested_at TIMESTAMP,
 * ADD COLUMN delete_approved_by VARCHAR(255),
 * ADD COLUMN delete_approved_at TIMESTAMP,
 * ADD COLUMN delete_doc_number VARCHAR(100),
 * ADD COLUMN delete_doc_date DATE,
 * ADD COLUMN admin_note TEXT;
 * 
 * CREATE INDEX idx_employee_status ON employees(employee_status);
 */

export type EmployeeStatusType = "active" | "pending_delete" | "archived";

export interface EmployeeStatusMeta {
  nationalNumber: string;
  employeeName: string;
  status: EmployeeStatusType;
  refNum?: string;
  deleteReason?: string;
  deleteRequestedBy?: string;
  deleteRequestedAt?: string;
  deleteDocNumber?: string;
  deleteDocDate?: string;
  deleteApprovedBy?: string;
  deleteApprovedAt?: string;
  adminNote?: string;
  archivedAt?: string;
}

const STATUS_KEY = "nacc_employee_status_map";

// ──────────────────────────────────────────────
// Core Storage Functions
// ──────────────────────────────────────────────

function getStatusMap(): Record<string, EmployeeStatusMeta> {
  try {
    return JSON.parse(localStorage.getItem(STATUS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveStatusMap(map: Record<string, EmployeeStatusMeta>): void {
  localStorage.setItem(STATUS_KEY, JSON.stringify(map));
  // إطلاق حدث لتحديث الواجهة في كل مكان
  window.dispatchEvent(new CustomEvent("employee-status-changed"));
}

function cleanNN(nn: string): string {
  return String(nn || "").replace(/[^\d]/g, "").trim();
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * SQL: SELECT employee_status FROM employees WHERE national_number = ?
 */
export function getEmployeeStatus(nationalNumber: string): EmployeeStatusType {
  const map = getStatusMap();
  const nn = cleanNN(nationalNumber);
  return map[nn]?.status || "active";
}

export function getEmployeeStatusMeta(nationalNumber: string): EmployeeStatusMeta | null {
  const map = getStatusMap();
  const nn = cleanNN(nationalNumber);
  return map[nn] || null;
}

/**
 * SQL: 
 * UPDATE employees 
 * SET employee_status = 'pending_delete',
 *     delete_reason = ?,
 *     delete_requested_by = ?,
 *     delete_requested_at = NOW(),
 *     delete_doc_number = ?,
 *     delete_doc_date = ?
 * WHERE national_number = ? AND employee_status = 'active';
 */
export function markAsPendingDelete(params: {
  nationalNumber: string;
  employeeName: string;
  reason: string;
  requestedBy: string;
  docNumber?: string;
  docDate?: string;
}): { ok: boolean; refNum?: string; error?: string } {
  const nn = cleanNN(params.nationalNumber);
  if (!nn) return { ok: false, error: "الرقم الوطني مطلوب" };
  
  const map = getStatusMap();
  const existing = map[nn];
  
  // فحص: لا يمكن طلب حذف موظف بحالة pending أو archived
  if (existing?.status === "pending_delete") {
    return { ok: false, error: "يوجد طلب حذف معلّق لهذا الموظف مسبقاً" };
  }
  if (existing?.status === "archived") {
    return { ok: false, error: "هذا الموظف موجود في الأرشيف مسبقاً" };
  }
  
  const refNum = `DEL-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  map[nn] = {
    nationalNumber: nn,
    employeeName: params.employeeName,
    status: "pending_delete",
    refNum,
    deleteReason: params.reason,
    deleteRequestedBy: params.requestedBy,
    deleteRequestedAt: new Date().toISOString(),
    deleteDocNumber: params.docNumber || "",
    deleteDocDate: params.docDate || "",
  };
  saveStatusMap(map);
  return { ok: true, refNum };
}

/**
 * SQL: 
 * UPDATE employees 
 * SET employee_status = 'archived',
 *     delete_approved_by = ?,
 *     delete_approved_at = NOW(),
 *     admin_note = ?
 * WHERE national_number = ? AND employee_status = 'pending_delete';
 */
export function approveAndArchive(
  nationalNumber: string,
  approvedBy: string,
  adminNote: string
): { ok: boolean; error?: string } {
  const nn = cleanNN(nationalNumber);
  const map = getStatusMap();
  const meta = map[nn];
  
  if (!meta) return { ok: false, error: "لم يتم العثور على طلب الحذف" };
  if (meta.status !== "pending_delete") {
    return { ok: false, error: "حالة الموظف غير صالحة للموافقة" };
  }
  
  map[nn] = {
    ...meta,
    status: "archived",
    deleteApprovedBy: approvedBy,
    deleteApprovedAt: new Date().toISOString(),
    archivedAt: new Date().toISOString(),
    adminNote,
  };
  saveStatusMap(map);
  return { ok: true };
}

/**
 * SQL: 
 * UPDATE employees 
 * SET employee_status = 'active',
 *     delete_reason = NULL,
 *     delete_requested_by = NULL,
 *     ...
 * WHERE national_number = ? AND employee_status = 'pending_delete';
 */
export function rejectDeleteRequestStatus(
  nationalNumber: string,
  rejectionNote: string
): { ok: boolean; error?: string } {
  const nn = cleanNN(nationalNumber);
  const map = getStatusMap();
  const meta = map[nn];
  
  if (!meta || meta.status !== "pending_delete") {
    return { ok: false, error: "لا يوجد طلب حذف معلّق" };
  }
  
  // الرجوع لحالة active مع الاحتفاظ بسجل الرفض في اللوج
  delete map[nn];
  saveStatusMap(map);
  
  // إرسال notice للسجلات
  window.dispatchEvent(new CustomEvent("delete-request-rejected", { 
    detail: { nationalNumber: nn, rejectionNote } 
  }));
  return { ok: true };
}

/**
 * SQL: 
 * UPDATE employees 
 * SET employee_status = 'active',
 *     delete_reason = NULL,
 *     archived_at = NULL,
 *     ...
 * WHERE national_number = ? AND employee_status = 'archived';
 */
export function restoreFromArchive(nationalNumber: string): { ok: boolean; error?: string } {
  const nn = cleanNN(nationalNumber);
  const map = getStatusMap();
  const meta = map[nn];
  
  if (!meta || meta.status !== "archived") {
    return { ok: false, error: "الموظف ليس في الأرشيف" };
  }
  
  delete map[nn];
  saveStatusMap(map);
  return { ok: true };
}

/**
 * SQL: DELETE FROM employees WHERE national_number = ? AND employee_status = 'archived';
 * (حذف نهائي - فقط من الأرشيف)
 */
export function permanentDelete(nationalNumber: string): { ok: boolean; error?: string } {
  const nn = cleanNN(nationalNumber);
  const map = getStatusMap();
  const meta = map[nn];
  
  if (!meta || meta.status !== "archived") {
    return { ok: false, error: "لا يمكن الحذف النهائي إلا من الأرشيف" };
  }
  
  // علامة "محذوف نهائياً" - يبقى مخفياً
  map[nn] = { ...meta, status: "archived", archivedAt: new Date().toISOString() };
  // في حالة الحذف النهائي الحقيقي، نضع علامة خاصة
  const permanentKey = "nacc_permanently_deleted";
  try {
    const list: string[] = JSON.parse(localStorage.getItem(permanentKey) || "[]");
    if (!list.includes(nn)) list.push(nn);
    localStorage.setItem(permanentKey, JSON.stringify(list));
    delete map[nn]; // إزالة من خريطة الحالات
    saveStatusMap(map);
  } catch {}
  return { ok: true };
}

export function isPermanentlyDeleted(nationalNumber: string): boolean {
  try {
    const list: string[] = JSON.parse(localStorage.getItem("nacc_permanently_deleted") || "[]");
    return list.includes(cleanNN(nationalNumber));
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// Query Functions (للاستعلامات)
// ──────────────────────────────────────────────

/**
 * SQL: SELECT * FROM employees WHERE employee_status = 'active' OR employee_status IS NULL;
 */
export function filterActiveOnly<T extends { nationalNumber: string }>(employees: T[]): T[] {
  return employees.filter((emp) => {
    if (isPermanentlyDeleted(emp.nationalNumber)) return false;
    const status = getEmployeeStatus(emp.nationalNumber);
    return status === "active";
  });
}

/**
 * SQL: SELECT * FROM employees WHERE employee_status = 'pending_delete';
 */
export function filterPendingDelete<T extends { nationalNumber: string }>(employees: T[]): (T & { _meta: EmployeeStatusMeta })[] {
  const result: (T & { _meta: EmployeeStatusMeta })[] = [];
  employees.forEach((emp) => {
    const meta = getEmployeeStatusMeta(emp.nationalNumber);
    if (meta?.status === "pending_delete") {
      result.push({ ...emp, _meta: meta });
    }
  });
  return result;
}

/**
 * SQL: SELECT * FROM employees WHERE employee_status = 'archived';
 */
export function filterArchived<T extends { nationalNumber: string }>(employees: T[]): (T & { _meta: EmployeeStatusMeta })[] {
  const result: (T & { _meta: EmployeeStatusMeta })[] = [];
  employees.forEach((emp) => {
    if (isPermanentlyDeleted(emp.nationalNumber)) return;
    const meta = getEmployeeStatusMeta(emp.nationalNumber);
    if (meta?.status === "archived") {
      result.push({ ...emp, _meta: meta });
    }
  });
  return result;
}

/**
 * SQL: SELECT COUNT(*) FROM employees WHERE employee_status = 'pending_delete';
 * يستخدم للشارة الحمراء
 */
export function countPendingDeletes(): number {
  const map = getStatusMap();
  return Object.values(map).filter((m) => m.status === "pending_delete").length;
}

/**
 * SQL: SELECT COUNT(*) FROM employees WHERE employee_status = 'archived';
 */
export function countArchived(): number {
  const map = getStatusMap();
  return Object.values(map).filter((m) => m.status === "archived").length;
}

// ──────────────────────────────────────────────
// Helper: تنظيف كامل (لإعادة الضبط)
// ──────────────────────────────────────────────
export function resetAllStatuses(): void {
  localStorage.removeItem(STATUS_KEY);
  localStorage.removeItem("nacc_permanently_deleted");
  window.dispatchEvent(new CustomEvent("employee-status-changed"));
}
