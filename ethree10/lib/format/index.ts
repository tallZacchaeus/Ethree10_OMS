import { format, formatDistanceToNow, isValid } from "date-fns";

/** Render an absolute date in the user's locale (e.g. "27 May 2026"). */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (!isValid(date)) return "—";
  return format(date, "d MMM yyyy");
}

/** Render date + time (e.g. "27 May 2026, 18:00"). */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (!isValid(date)) return "—";
  return format(date, "d MMM yyyy, HH:mm");
}

/** Render a relative time (e.g. "3 hours ago"). */
export function formatRelative(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (!isValid(date)) return "—";
  return formatDistanceToNow(date, { addSuffix: true });
}

/** Render a monetary amount with its ISO currency code. */
export function formatMoney(
  amount: number | string | null | undefined,
  currency = "NGN",
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const numeric = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(numeric)) return "—";
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${currency} ${numeric.toLocaleString()}`;
  }
}

/** Two-letter initials from a name, for avatar fallbacks. */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}
