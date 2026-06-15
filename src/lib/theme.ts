// ============================================================
// theme.ts - إدارة الوضع الداكن والفاتح
// ============================================================

const THEME_KEY = "nacc_theme";

export type Theme = "light" | "dark";

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  } catch {}
  return "light";
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function toggleTheme(): Theme {
  const current = getTheme();
  const next = current === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

// تطبيق الثيم عند بدء التشغيل
if (typeof window !== "undefined") {
  applyTheme(getTheme());
}
