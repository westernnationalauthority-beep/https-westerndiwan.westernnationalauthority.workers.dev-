// ============================================================
// crypto.ts - طبقة تشفير كلمات المرور
// تستخدم Web Crypto API المدمجة في المتصفح (PBKDF2 + SHA-256)
// ============================================================

const PBKDF2_ITERATIONS = 100000; // عدد التكرارات (معيار OWASP 2024)
const KEY_LENGTH = 256;
const SALT_LENGTH = 16; // 128-bit salt

/* ──────────────────────────────────────────────
 * توليد salt عشوائي
 * ────────────────────────────────────────────── */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/* ──────────────────────────────────────────────
 * تشفير كلمة المرور
 * ────────────────────────────────────────────── */
export interface PasswordHash {
  version: "pbkdf2";
  salt: string; // base64
  hash: string; // base64
  iterations: number;
}

export async function hashPassword(
  password: string,
  providedSalt?: string
): Promise<PasswordHash> {
  const saltBytes = providedSalt ? base64ToBytes(providedSalt) : generateSalt();
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new Uint8Array(saltBytes) as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH
  );

  return {
    version: "pbkdf2",
    salt: bytesToBase64(saltBytes),
    hash: bytesToBase64(new Uint8Array(hashBuffer)),
    iterations: PBKDF2_ITERATIONS,
  };
}

/* ──────────────────────────────────────────────
 * التحقق من كلمة المرور
 * ────────────────────────────────────────────── */
export async function verifyPassword(
  password: string,
  stored: PasswordHash
): Promise<boolean> {
  try {
    const computed = await hashPassword(password, stored.salt);
    return computed.hash === stored.hash && computed.iterations === stored.iterations;
  } catch {
    return false;
  }
}

/* ──────────────────────────────────────────────
 * فحص قوة كلمة المرور
 * ────────────────────────────────────────────── */
export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
  issues: string[];
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const issues: string[] = [];
  let score = 0;

  if (password.length >= 8) score++; else issues.push("يجب أن تكون 8 أحرف على الأقل");
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++; else issues.push("أضف حروف كبيرة وصغيرة");
  if (/\d/.test(password)) score++; else issues.push("أضف أرقاماً");
  if (/[^a-zA-Z0-9]/.test(password)) score++; else issues.push("أضف رموزاً خاصة (!@#$)");

  score = Math.min(4, score);

  const labels = ["ضعيفة جداً", "ضعيفة", "متوسطة", "قوية", "قوية جداً"];
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-emerald-500", "bg-emerald-600"];

  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score], color: colors[score], issues };
}

/* ──────────────────────────────────────────────
 * فحص ما إذا كانت كلمة المرور مشفرة بالفعل
 * ────────────────────────────────────────────── */
export function isPasswordHashed(value: string | undefined | null): boolean {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value);
    return parsed && parsed.version === "pbkdf2" && parsed.hash && parsed.salt;
  } catch {
    return false;
  }
}

/* ──────────────────────────────────────────────
 * ترحيل كلمة مرور نص صريح → مشفرة
 * يُستخدم عند أول تحديث بعد إضافة التشفير
 * ────────────────────────────────────────────── */
export async function migratePlainPassword(
  plainPassword: string | undefined | null
): Promise<PasswordHash | null> {
  if (!plainPassword) return null;
  // إذا كانت نصاً صريحاً (ليست JSON)، شفّرها
  if (!isPasswordHashed(plainPassword)) {
    return hashPassword(plainPassword);
  }
  // إذا كانت مشفرة بالفعل، أعد تحليلها
  return JSON.parse(plainPassword) as PasswordHash;
}
