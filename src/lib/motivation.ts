// ============================================================
// motivation.ts - نظام التحفيز الرقمي وإنتاجية الموظفين
// ============================================================

export type EmployeeType = "إداري" | "ميداني" | "رئيس قسم" | "مدير ديوان" | "غير محدد";
export type PointTier = "green" | "blue" | "red";
export type CodeSize = "small" | "medium" | "large";

export interface MotivationProfile {
  nationalNumber: string;
  fullName: string;
  employeeType: EmployeeType;
  points: number;
  history: PointActivity[];
  initiativeCodes: InitiativeCode[];
  attendance: AttendanceRecord[];
  nickname?: string;
  lastUpdate: string;
}

export interface PointActivity {
  id: string;
  type: "add" | "deduct";
  amount: number;
  reason: string;
  date: string;
  by?: string;
}

export interface InitiativeCode {
  id: string;
  code: string;
  size: CodeSize;
  points: number;
  issuedBy: string;
  issuedAt: string;
  redeemedAt?: string;
  redeemedBy?: string;
  description?: string;
  used: boolean;
}

export interface AttendanceRecord {
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: "present" | "late" | "absent" | "leave";
  pointsAwarded?: number;
}

// ──────────────────────────────────────────────
// نقاط التحفيز (قابلة للتخصيص)
// ──────────────────────────────────────────────
export const POINTS_CONFIG = {
  UPLOAD_MISSING_DOC: 50,
  ATTENDANCE_DAILY: 10,
  COMPLETE_PROFILE: 100,
  CODE_SMALL: 30,
  CODE_MEDIUM: 75,
  CODE_LARGE: 150,
  LATE_PENALTY: -5,
  ABSENCE_PENALTY: -20,
  MISSING_FIELD_PENALTY: -10,
  DELAYED_TASK_PENALTY: -15,
};

// ──────────────────────────────────────────────
// نطاقات النقاط والكنيات
// ──────────────────────────────────────────────
export const POINT_TIERS = {
  green: { min: 500, color: "emerald", label: "متميز", emoji: "🟢" },
  blue: { min: 100, color: "blue", label: "متوسط", emoji: "🔵" },
  red: { min: -Infinity, color: "red", label: "تحت المتابعة", emoji: "🔴" },
};

export const NICKNAMES: Record<PointTier, string[]> = {
  green: ["العين الرقابية", "مطور الديوان", "نجم الأداء", "صانع التميز", "قائد الصف الأول"],
  blue: ["موظف نشط", "في طريق التميز", "متطلع للأفضل", "ساعٍ للإبداع"],
  red: ["تحت المتابعة", "بحاجة للدعم", "في مرحلة المراجعة"],
};

// ──────────────────────────────────────────────
// أدوات حساب النطاق
// ──────────────────────────────────────────────
export function getPointTier(points: number): PointTier {
  if (points >= POINT_TIERS.green.min) return "green";
  if (points >= POINT_TIERS.blue.min) return "blue";
  return "red";
}

export function getTierColor(tier: PointTier): { text: string; bg: string; border: string; gradient: string } {
  switch (tier) {
    case "green":
      return {
        text: "text-emerald-700 dark:text-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-900/20",
        border: "border-emerald-300 dark:border-emerald-700",
        gradient: "from-emerald-500 to-teal-600",
      };
    case "blue":
      return {
        text: "text-blue-700 dark:text-blue-400",
        bg: "bg-blue-50 dark:bg-blue-900/20",
        border: "border-blue-300 dark:border-blue-700",
        gradient: "from-blue-500 to-indigo-600",
      };
    case "red":
      return {
        text: "text-red-700 dark:text-red-400",
        bg: "bg-red-50 dark:bg-red-900/20",
        border: "border-red-300 dark:border-red-700",
        gradient: "from-red-500 to-rose-600",
      };
  }
}

export function getNickname(points: number): string {
  const tier = getPointTier(points);
  const list = NICKNAMES[tier];
  // اختيار كنية حسب النقاط (لتكون ثابتة لكل موظف)
  return list[Math.floor(points / 50) % list.length];
}

export function getPointsToNextTier(points: number): { needed: number; nextTier: PointTier | null; progress: number } {
  if (points >= POINT_TIERS.green.min) return { needed: 0, nextTier: null, progress: 100 };
  if (points >= POINT_TIERS.blue.min) {
    const range = POINT_TIERS.green.min - POINT_TIERS.blue.min;
    const current = points - POINT_TIERS.blue.min;
    return {
      needed: POINT_TIERS.green.min - points,
      nextTier: "green",
      progress: Math.round((current / range) * 100),
    };
  }
  const range = POINT_TIERS.blue.min - 0;
  const current = Math.max(0, points);
  return {
    needed: POINT_TIERS.blue.min - points,
    nextTier: "blue",
    progress: Math.round((current / range) * 100),
  };
}

// ──────────────────────────────────────────────
// التخزين المحلي
// ──────────────────────────────────────────────
const MOTIVATION_KEY = "nacc_motivation_profiles";
const EMPLOYEE_TYPE_KEY = "nacc_employee_types";
const ATTENDANCE_KEY = "nacc_attendance_records";

export function getAllProfiles(): Record<string, MotivationProfile> {
  try {
    return JSON.parse(localStorage.getItem(MOTIVATION_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveAllProfiles(profiles: Record<string, MotivationProfile>): void {
  localStorage.setItem(MOTIVATION_KEY, JSON.stringify(profiles));
}

export function getProfile(nationalNumber: string, fullName: string, employeeType: EmployeeType): MotivationProfile {
  const profiles = getAllProfiles();
  if (profiles[nationalNumber]) {
    profiles[nationalNumber].fullName = fullName;
    profiles[nationalNumber].employeeType = employeeType;
    return profiles[nationalNumber];
  }
  const newProfile: MotivationProfile = {
    nationalNumber,
    fullName,
    employeeType,
    points: 0,
    history: [],
    initiativeCodes: [],
    attendance: [],
    lastUpdate: new Date().toISOString(),
  };
  profiles[nationalNumber] = newProfile;
  saveAllProfiles(profiles);
  return newProfile;
}

export function updateProfile(profile: MotivationProfile): void {
  const profiles = getAllProfiles();
  profile.lastUpdate = new Date().toISOString();
  profile.nickname = getNickname(profile.points);
  profiles[profile.nationalNumber] = profile;
  saveAllProfiles(profiles);
}

export function addPoints(nationalNumber: string, amount: number, reason: string, by?: string): MotivationProfile | null {
  const profiles = getAllProfiles();
  const profile = profiles[nationalNumber];
  if (!profile) return null;

  const activity: PointActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: amount >= 0 ? "add" : "deduct",
    amount,
    reason,
    date: new Date().toISOString(),
    by,
  };
  profile.points += amount;
  profile.history.unshift(activity);
  if (profile.history.length > 100) profile.history = profile.history.slice(0, 100);
  profile.nickname = getNickname(profile.points);
  profile.lastUpdate = new Date().toISOString();
  profiles[nationalNumber] = profile;
  saveAllProfiles(profiles);
  return profile;
}

// ──────────────────────────────────────────────
// أنواع الموظفين
// ──────────────────────────────────────────────
export function getEmployeeType(nationalNumber: string): EmployeeType {
  try {
    const map = JSON.parse(localStorage.getItem(EMPLOYEE_TYPE_KEY) || "{}");
    return map[nationalNumber] || "إداري";
  } catch {
    return "إداري";
  }
}

export function setEmployeeType(nationalNumber: string, type: EmployeeType): void {
  try {
    const map = JSON.parse(localStorage.getItem(EMPLOYEE_TYPE_KEY) || "{}");
    map[nationalNumber] = type;
    localStorage.setItem(EMPLOYEE_TYPE_KEY, JSON.stringify(map));
  } catch {}
}

// ──────────────────────────────────────────────
// توليد أكواد المبادرة
// ──────────────────────────────────────────────
export function generateInitiativeCode(size: CodeSize): string {
  const sizeMap = { small: "S", medium: "M", large: "L" };
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `IDEA-${year}-${sizeMap[size]}${random}`;
}

export function getCodePoints(size: CodeSize): number {
  switch (size) {
    case "small": return POINTS_CONFIG.CODE_SMALL;
    case "medium": return POINTS_CONFIG.CODE_MEDIUM;
    case "large": return POINTS_CONFIG.CODE_LARGE;
  }
}

export function issueInitiativeCode(
  recipientNN: string,
  size: CodeSize,
  description: string,
  issuedBy: string
): InitiativeCode {
  const code: InitiativeCode = {
    id: `code_${Date.now()}`,
    code: generateInitiativeCode(size),
    size,
    points: getCodePoints(size),
    issuedBy,
    issuedAt: new Date().toISOString(),
    description,
    used: false,
  };
  const profiles = getAllProfiles();
  if (profiles[recipientNN]) {
    profiles[recipientNN].initiativeCodes.push(code);
    saveAllProfiles(profiles);
  }
  return code;
}

export function redeemInitiativeCode(nationalNumber: string, codeValue: string): { ok: boolean; message: string; points?: number } {
  const profiles = getAllProfiles();
  const profile = profiles[nationalNumber];
  if (!profile) return { ok: false, message: "لم يتم العثور على ملفك في نظام التحفيز" };

  const code = profile.initiativeCodes.find((c) => c.code === codeValue);
  if (!code) return { ok: false, message: "الكود غير صحيح أو غير صادر باسمك" };
  if (code.used) return { ok: false, message: "هذا الكود مستخدم مسبقاً" };

  code.used = true;
  code.redeemedAt = new Date().toISOString();
  code.redeemedBy = profile.fullName;

  addPoints(nationalNumber, code.points, `تفعيل كود مبادرة (${code.size === "small" ? "صغير" : code.size === "medium" ? "متوسط" : "ضخم"}): ${codeValue}`);
  return { ok: true, message: `تم تفعيل الكود بنجاح! +${code.points} نقطة`, points: code.points };
}

// ──────────────────────────────────────────────
// الحضور والانصراف
// ──────────────────────────────────────────────
export interface DailyAttendance {
  date: string;
  checkIn: string;
  checkOut: string;
  late: boolean;
  pointsAwarded: number;
}

export function getAttendanceMap(): Record<string, DailyAttendance[]> {
  try {
    return JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function setAttendanceMap(map: Record<string, DailyAttendance[]>): void {
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(map));
}

export function getAttendance(nationalNumber: string): DailyAttendance[] {
  const map = getAttendanceMap();
  return map[nationalNumber] || [];
}

// محاكاة بصمة (لأغراض العرض)
export function simulateAttendance(nationalNumber: string, days: number = 7): DailyAttendance[] {
  const map = getAttendanceMap();
  const records: DailyAttendance[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 5 || date.getDay() === 6) continue; // عطلة الجمعة/السبت

    const lateMinutes = Math.floor(Math.random() * 30);
    const isLate = lateMinutes > 15;
    const checkInHour = 8;
    const checkInMin = lateMinutes;

    const record: DailyAttendance = {
      date: date.toISOString().slice(0, 10),
      checkIn: `${String(checkInHour).padStart(2, "0")}:${String(checkInMin).padStart(2, "0")}`,
      checkOut: "16:00",
      late: isLate,
      pointsAwarded: isLate ? POINTS_CONFIG.LATE_PENALTY : POINTS_CONFIG.ATTENDANCE_DAILY,
    };
    records.push(record);
  }

  map[nationalNumber] = records;
  setAttendanceMap(map);
  return records;
}

export function calculateAttendancePoints(nationalNumber: string): { total: number; days: number; late: number } {
  const records = getAttendance(nationalNumber);
  return {
    total: records.reduce((sum, r) => sum + r.pointsAwarded, 0),
    days: records.filter((r) => !r.late).length,
    late: records.filter((r) => r.late).length,
  };
}

// ──────────────────────────────────────────────
// المبدعين الشهريين
// ──────────────────────────────────────────────
export function getTopEmployees(limit: number = 5): MotivationProfile[] {
  const profiles = Object.values(getAllProfiles());
  return profiles
    .filter((p) => p.employeeType !== "رئيس قسم" && p.employeeType !== "مدير ديوان")
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

export function getTopDepartmentHeads(limit: number = 3): MotivationProfile[] {
  const profiles = Object.values(getAllProfiles());
  return profiles
    .filter((p) => p.employeeType === "رئيس قسم")
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

// ──────────────────────────────────────────────
// إحصائيات النطاقات
// ──────────────────────────────────────────────
export function getTierStats(): { green: number; blue: number; red: number; total: number } {
  const profiles = Object.values(getAllProfiles());
  return {
    green: profiles.filter((p) => getPointTier(p.points) === "green").length,
    blue: profiles.filter((p) => getPointTier(p.points) === "blue").length,
    red: profiles.filter((p) => getPointTier(p.points) === "red").length,
    total: profiles.length,
  };
}
