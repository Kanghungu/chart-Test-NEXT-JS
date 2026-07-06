/**
 * 브라우저 알림(Web Notifications API) 기반 가격/시그널 알림 규칙.
 * 서버/로그인 없이 localStorage에만 저장 — 탭이 열려있는 동안만 동작한다
 * (서비스워커가 없어 탭을 닫으면 알림도 오지 않음).
 */

export type PriceAlertRule = {
  id: string;
  kind: "price";
  symbol: string;
  label: string;
  direction: "above" | "below";
  targetPrice: number;
  enabled: boolean;
  triggeredAt?: number;
};

export type SignalAlertRule = {
  id: string;
  kind: "signal";
  base: string; // "ALL" 또는 코인 베이스 심볼 (예: BTC)
  type: string; // "ALL" 또는 시그널 타입
  direction: "ALL" | "BULLISH" | "BEARISH";
  enabled: boolean;
};

export type AlertRule = PriceAlertRule | SignalAlertRule;

const RULES_KEY = "alertRules";
const NOTIFIED_SIGNALS_KEY = "alertNotifiedSignalIds";

export function loadAlertRules(): AlertRule[] {
  try {
    const raw = window.localStorage.getItem(RULES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAlertRules(rules: AlertRule[]): void {
  try {
    window.localStorage.setItem(RULES_KEY, JSON.stringify(rules));
  } catch {
    /* 저장소 비가용 시 무시 */
  }
}

export function loadNotifiedSignalIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(NOTIFIED_SIGNALS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function saveNotifiedSignalIds(ids: Set<string>): void {
  try {
    // 최근 500개만 유지 (무한 누적 방지)
    const arr = [...ids].slice(-500);
    window.localStorage.setItem(NOTIFIED_SIGNALS_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

/** 권한이 "default"면 요청하고, 최종 권한 상태를 반환 */
export async function ensureNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }
  return Notification.permission;
}

/** 권한이 있을 때만 알림 발송, 없으면 조용히 무시 */
export function fireNotification(title: string, body: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {
    /* 일부 환경(포커스/OS 설정)에서 실패할 수 있음 — 무시 */
  }
}

export function makeAlertId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
