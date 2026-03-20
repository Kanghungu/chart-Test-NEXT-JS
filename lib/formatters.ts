export function formatCurrency(value: number | null, currency = "USD") {
  if (typeof value !== "number") return "-";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value >= 1000 ? 0 : 2
  }).format(value);
}

export function formatPercent(value: number | null) {
  if (typeof value !== "number") return "-";

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatDateTime(value?: string | null, locale = "ko-KR") {
  if (!value) return "날짜 정보 없음";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "날짜 정보 없음";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(timestamp);
}
