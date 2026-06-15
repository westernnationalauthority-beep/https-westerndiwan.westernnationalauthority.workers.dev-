// ============================================================
// ui.tsx - مكونات واجهة مستخدم مشتركة بين كل التبويبات
// ============================================================

import React from "react";
import { isEmpty } from "../utils";

// ──────────────────────────────────────────────
// Badge الحالة
// ──────────────────────────────────────────────
export function getStatusBadge(s: string): string {
  switch (s) {
    case "مستوفي":   return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "نشط":      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "ناقص":     return "bg-amber-100 text-amber-800 border-amber-200";
    case "تحت الاجراء": return "bg-blue-100 text-blue-800 border-blue-200";
    default:         return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

export function getDataCompleteBadge(v: string): string {
  if (v === "نعم مكتملة" || v === "نعم") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (v === "غير مكتملة" || v === "لا") return "bg-red-100 text-red-800 border-red-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

// ──────────────────────────────────────────────
// StatCard - بطاقة إحصائية عصرية مدمجة
// ──────────────────────────────────────────────
const STAT_COLORS: Record<string, { bg: string; icon: string; text: string; ring: string }> = {
  slate:   { bg: "bg-white dark:bg-slate-800", icon: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300", text: "text-slate-800 dark:text-slate-100", ring: "border-slate-200 dark:border-slate-700" },
  emerald: { bg: "bg-white dark:bg-slate-800", icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400", text: "text-emerald-700 dark:text-emerald-400", ring: "border-slate-200 dark:border-slate-700" },
  red:     { bg: "bg-white dark:bg-slate-800", icon: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400", text: "text-red-700 dark:text-red-400", ring: "border-slate-200 dark:border-slate-700" },
  blue:    { bg: "bg-white dark:bg-slate-800", icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400", text: "text-blue-700 dark:text-blue-400", ring: "border-slate-200 dark:border-slate-700" },
  amber:   { bg: "bg-white dark:bg-slate-800", icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400", text: "text-amber-700 dark:text-amber-400", ring: "border-slate-200 dark:border-slate-700" },
  indigo:  { bg: "bg-white dark:bg-slate-800", icon: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400", text: "text-indigo-700 dark:text-indigo-400", ring: "border-slate-200 dark:border-slate-700" },
  pink:    { bg: "bg-white dark:bg-slate-800", icon: "bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400", text: "text-pink-700 dark:text-pink-400", ring: "border-slate-200 dark:border-slate-700" },
  cyan:    { bg: "bg-white dark:bg-slate-800", icon: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400", text: "text-cyan-700 dark:text-cyan-400", ring: "border-slate-200 dark:border-slate-700" },
  orange:  { bg: "bg-white dark:bg-slate-800", icon: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400", text: "text-orange-700 dark:text-orange-400", ring: "border-slate-200 dark:border-slate-700" },
  violet:  { bg: "bg-white dark:bg-slate-800", icon: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400", text: "text-violet-700 dark:text-violet-400", ring: "border-slate-200 dark:border-slate-700" },
};

// تنسيق الأرقام بفواصل عصرية (1,234)
function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function StatCard({
  label,
  value,
  color,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
  onClick?: () => void;
}) {
  const c = STAT_COLORS[color] || STAT_COLORS.slate;
  return (
    <div 
      onClick={onClick}
      className={`group rounded-xl border ${c.ring} ${c.bg} p-2 shadow-sm hover:shadow-md transition-all flex items-center gap-2.5 ${onClick ? "cursor-pointer active:scale-95" : ""}`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${c.icon} transition-transform group-hover:scale-110`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-lg font-black tabular-nums tracking-tight ${c.text}`}>{formatNumber(value)}</div>
        <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 truncate uppercase">{label}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Th - خلية رأس الجدول
// ──────────────────────────────────────────────
export function Th({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2.5 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap ${
        onClick ? "cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none" : ""
      }`}
    >
      {children}
    </th>
  );
}

// ──────────────────────────────────────────────
// SortIcon - أيقونة الترتيب
// ──────────────────────────────────────────────
export function SortIcon({
  column,
  sortKey,
  sortDir,
}: {
  column: string;
  sortKey: string;
  sortDir: "asc" | "desc";
}) {
  if (sortKey !== column) return <span className="text-slate-300 mr-1">⇅</span>;
  return <span className="text-indigo-600 mr-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

// ──────────────────────────────────────────────
// Pagination - ترقيم الصفحات
// ──────────────────────────────────────────────
function PageBtn({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 text-xs rounded-lg transition font-medium ${
        active
          ? "bg-indigo-600 text-white shadow"
          : "bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

export function Pagination({
  currentPage,
  totalPages,
  onChange,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
    if (totalPages <= 5) return i + 1;
    if (currentPage <= 3) return i + 1;
    if (currentPage >= totalPages - 2) return totalPages - 4 + i;
    return currentPage - 2 + i;
  });

  return (
    <div className="flex items-center justify-center gap-1.5 mt-4">
      <p className="text-[11px] text-slate-500 ml-3">
        صفحة {currentPage} من {totalPages}
      </p>
      <PageBtn onClick={() => onChange(1)} disabled={currentPage === 1}>⟪</PageBtn>
      <PageBtn onClick={() => onChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>⟨</PageBtn>
      {pages.map((page) => (
        <PageBtn key={page} onClick={() => onChange(page)} active={page === currentPage}>
          {page}
        </PageBtn>
      ))}
      <PageBtn onClick={() => onChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>⟩</PageBtn>
      <PageBtn onClick={() => onChange(totalPages)} disabled={currentPage === totalPages}>⟫</PageBtn>
    </div>
  );
}

// ──────────────────────────────────────────────
// DataSection - قسم عرض بيانات الموظف
// ──────────────────────────────────────────────

const SECTION_COLORS: Record<string, string> = {
  indigo: "bg-indigo-600",
  emerald: "bg-emerald-600",
  amber: "bg-amber-600",
  violet: "bg-violet-600",
  cyan: "bg-cyan-600",
};

export function DataSection({
  title,
  color,
  rows,
}: {
  title: string;
  color: string;
  rows: (string | boolean | undefined)[][];
}) {
  return (
    <div>
      <div className={`${SECTION_COLORS[color] || "bg-slate-600"} text-white px-3 py-1.5 rounded-t-lg text-xs font-bold`}>
        {title}
      </div>
      <div className="border border-slate-200 border-t-0 rounded-b-lg overflow-hidden">
        {rows.map((row, i) => {
          const label = row[0] as string;
          const value = row[1] as string;
          const mono = row[2] as boolean;
          const empty = isEmpty(value);
          return (
            <div
              key={i}
              className={`grid grid-cols-3 gap-2 px-3 py-2 ${
                i % 2 === 0 ? "bg-slate-50" : "bg-white"
              } border-b border-slate-100 last:border-b-0`}
            >
              <span className="text-xs text-slate-500">{label}</span>
              <span
                className={`col-span-2 text-sm ${empty ? "text-red-500 italic" : "text-slate-800"} ${
                  mono && !empty ? "font-mono" : ""
                }`}
                dir={mono && !empty ? "ltr" : undefined}
              >
                {empty ? "— لم يتم تسجيله —" : value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// LoadingSpinner
// ──────────────────────────────────────────────
export function LoadingSpinner({ text = "جاري التحميل..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-4">
        <div className="inline-block h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-slate-500">{text}</p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// ErrorCard
// ──────────────────────────────────────────────
export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-red-200 max-w-md mx-auto p-8 text-center space-y-4">
      <div className="text-4xl">❌</div>
      <h2 className="text-lg font-bold text-slate-900">خطأ في التحميل</h2>
      <p className="text-sm text-slate-500">{message}</p>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700 transition"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
