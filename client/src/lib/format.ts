import type { ApiTimestamp } from "../types";

/** Normalizes the various timestamp shapes the API may return into a Date. */
export function toDate(value: ApiTimestamp | undefined): Date | null {
  if (value == null) return null;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "object" && "_seconds" in value) {
    return new Date(value._seconds * 1000);
  }
  return null;
}

const HE = {
  now: "עכשיו",
  minutes: (n: number) => `לפני ${n} דק׳`,
  hours: (n: number) => (n === 1 ? "לפני שעה" : `לפני ${n} שעות`),
  days: (n: number) => (n === 1 ? "אתמול" : `לפני ${n} ימים`),
  weeks: (n: number) => (n === 1 ? "לפני שבוע" : `לפני ${n} שבועות`),
  months: (n: number) => (n === 1 ? "לפני חודש" : `לפני ${n} חודשים`),
};

/** Hebrew relative-time label, e.g. "עודכן לפני 3 ימים". */
export function relativeTime(value: ApiTimestamp | undefined): string | null {
  const date = toDate(value);
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return HE.now;
  if (minutes < 60) return HE.minutes(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return HE.hours(hours);
  const days = Math.round(hours / 24);
  if (days < 7) return HE.days(days);
  const weeks = Math.round(days / 7);
  if (weeks < 5) return HE.weeks(weeks);
  const months = Math.round(days / 30);
  return HE.months(months);
}

export function absoluteDate(value: ApiTimestamp | undefined): string | null {
  const date = toDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "long", timeStyle: "short" }).format(date);
}

/** "freshness" used to color the updated badge: businesses here can be flaky. */
export function freshness(value: ApiTimestamp | undefined): "fresh" | "stale" | "old" | "unknown" {
  const date = toDate(value);
  if (!date) return "unknown";
  const days = (Date.now() - date.getTime()) / 86_400_000;
  if (days <= 14) return "fresh";
  if (days <= 60) return "stale";
  return "old";
}
