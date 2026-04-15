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

/** 거시 타일: 원달러·지수·금리(%)·선물 가격 표시 */
export function formatMacroQuotePrice(
  displayUnit: "pair" | "index" | "yield" | "future",
  value: number | null,
  localeTag: string
) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";

  const locale = localeTag === "ko-KR" ? "ko-KR" : "en-US";

  if (displayUnit === "pair") {
    return `${value.toLocaleString(locale, { maximumFractionDigits: 2 })} ${
      localeTag === "ko-KR" ? "원/$" : "KRW/USD"
    }`;
  }

  if (displayUnit === "yield") {
    return `${value.toFixed(2)}%`;
  }

  return value.toLocaleString(locale, { maximumFractionDigits: 2 });
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
