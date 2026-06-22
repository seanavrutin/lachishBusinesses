import type { ApiTimestamp } from "../types";
import { relativeTime, freshness } from "../lib/format";
import { styleForCategory } from "../lib/categories";

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-gray-200 border-t-brand-600" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
      <div className="text-4xl">🔎</div>
      <p className="text-lg font-semibold text-gray-700">{title}</p>
      {hint && <p className="max-w-xs text-sm text-gray-500">{hint}</p>}
    </div>
  );
}

const FRESHNESS_STYLE: Record<string, string> = {
  fresh: "bg-brand-100 text-brand-800",
  stale: "bg-amber-100 text-amber-800",
  old: "bg-gray-200 text-gray-600",
  unknown: "bg-gray-100 text-gray-500",
};

export function UpdatedBadge({ value }: { value: ApiTimestamp | undefined }) {
  const label = relativeTime(value);
  if (!label) return null;
  const style = FRESHNESS_STYLE[freshness(value)];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      <span className="text-[0.6rem]">●</span>
      עודכן {label}
    </span>
  );
}

export function CategoryTag({ category }: { category: string }) {
  const { emoji } = styleForCategory(category);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
      <span>{emoji}</span>
      {category}
    </span>
  );
}

export function StatusBadge({ status }: { status: "active" | "needs_review" }) {
  if (status !== "needs_review") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
      ⚠ מידע לא מאומת
    </span>
  );
}
