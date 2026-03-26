"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./HomeSessionBoard.module.css";
import { formatPercent } from "@/lib/formatters";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type SnapshotAsset = {
  symbol: string;
  price: number | null;
  changePercent: number | null;
};

type SnapshotResponse = {
  assets?: SnapshotAsset[];
  fearGreed?: {
    value: number;
    classification: string;
  } | null;
};

type EventItem = {
  time: string;
  country: string;
  title: string;
  impact: string;
};

type SessionStatus = "live" | "next" | "closed";

const COPY = {
  ko: {
    eyebrow: "SESSION COMPASS",
    title: "지금 시장의 위치를 읽는 보드",
    description: "실시간 가격 요약과는 다른 관점으로, 현재 세션과 자산군의 흐름을 빠르게 읽습니다.",
    sessions: "주요 세션",
    crossAsset: "크로스에셋 톤",
    eventWindow: "다음 변동 시간대",
    openNow: "진행 중",
    opensNext: "다음 오픈",
    closed: "종료",
    regime: "심리 레짐",
    cryptoLead: "크립토 리더십",
    equityTone: "주식 톤",
    betaSpread: "ETH 대 BTC 베타",
    aheadOfEvent: "이벤트 대기",
    noEvents: "예정된 이벤트를 불러오는 중입니다.",
    positive: "우호적",
    neutral: "중립",
    defensive: "방어적",
    stronger: "더 강함",
    softer: "더 약함",
    balanced: "균형",
    activeNow: "현재 활성",
    opensAt: "오픈 예정",
    activeTag: "LIVE"
  },
  en: {
    eyebrow: "SESSION COMPASS",
    title: "A board for reading market positioning",
    description: "A different lens from raw prices, focused on sessions and cross-asset pressure.",
    sessions: "Key sessions",
    crossAsset: "Cross-asset tone",
    eventWindow: "Next volatility window",
    openNow: "Open now",
    opensNext: "Opens next",
    closed: "Closed",
    regime: "Sentiment regime",
    cryptoLead: "Crypto leadership",
    equityTone: "Equity tone",
    betaSpread: "ETH vs BTC beta",
    aheadOfEvent: "Ahead of event",
    noEvents: "Loading scheduled events.",
    positive: "Constructive",
    neutral: "Neutral",
    defensive: "Defensive",
    stronger: "Stronger",
    softer: "Softer",
    balanced: "Balanced",
    activeNow: "Active now",
    opensAt: "Opens at",
    activeTag: "LIVE"
  }
} as const;

function getSessionStatus(hour: number, start: number, end: number): SessionStatus {
  if (hour >= start && hour < end) return "live";
  if (hour < start) return "next";
  return "closed";
}

function getToneClass(value: number | null) {
  if (typeof value !== "number") return styles.toneNeutral;
  if (value > 0) return styles.toneUp;
  if (value < 0) return styles.toneDown;
  return styles.toneNeutral;
}

export default function HomeSessionBoard() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const [snapshot, setSnapshot] = useState<SnapshotResponse>({});
  const [events, setEvents] = useState<EventItem[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [snapshotRes, eventRes] = await Promise.all([
          fetch("/api/market/snapshot", { cache: "no-store" }),
          fetch("/api/market/events", { cache: "no-store" })
        ]);

        const [snapshotJson, eventJson] = await Promise.all([snapshotRes.json(), eventRes.json()]);

        if (!mounted) return;

        setSnapshot({
          assets: Array.isArray(snapshotJson?.assets) ? snapshotJson.assets : [],
          fearGreed: snapshotJson?.fearGreed ?? null
        });
        setEvents(Array.isArray(eventJson?.items) ? eventJson.items.slice(0, 3) : []);
      } catch {
        if (!mounted) return;
        setSnapshot({});
        setEvents([]);
      }
    };

    load();
    const refresh = setInterval(load, 60000);
    const clock = setInterval(() => setNow(new Date()), 30000);

    return () => {
      mounted = false;
      clearInterval(refresh);
      clearInterval(clock);
    };
  }, []);

  const sessions = useMemo(() => {
    const utcHour = Number(
      now.toLocaleString("en-US", {
        timeZone: "UTC",
        hour: "2-digit",
        hour12: false
      })
    );

    return [
      {
        city: "Seoul",
        hours: "09:00-15:30 KST",
        status: getSessionStatus(utcHour + 9 >= 24 ? utcHour - 15 : utcHour + 9, 9, 16)
      },
      {
        city: "London",
        hours: "08:00-16:30 GMT",
        status: getSessionStatus(utcHour, 8, 17)
      },
      {
        city: "New York",
        hours: "09:30-16:00 ET",
        status: getSessionStatus(utcHour - 4 < 0 ? utcHour + 20 : utcHour - 4, 9, 16)
      }
    ];
  }, [now]);

  const summary = useMemo(() => {
    const btc = snapshot.assets?.find((asset) => asset.symbol === "BTC");
    const eth = snapshot.assets?.find((asset) => asset.symbol === "ETH");
    const spx = snapshot.assets?.find((asset) => asset.symbol === "S&P 500");
    const fearGreed = snapshot.fearGreed?.value ?? null;
    const btcChange = btc?.changePercent ?? null;
    const ethChange = eth?.changePercent ?? null;
    const spxChange = spx?.changePercent ?? null;
    const betaSpread =
      typeof ethChange === "number" && typeof btcChange === "number" ? ethChange - btcChange : null;

    return {
      regimeLabel:
        typeof fearGreed === "number"
          ? fearGreed >= 60
            ? copy.positive
            : fearGreed <= 35
              ? copy.defensive
              : copy.neutral
          : copy.balanced,
      cryptoLeadLabel:
        typeof betaSpread === "number"
          ? betaSpread > 0.7
            ? copy.stronger
            : betaSpread < -0.7
              ? copy.softer
              : copy.balanced
          : copy.balanced,
      equityLabel:
        typeof spxChange === "number"
          ? spxChange > 0.3
            ? copy.positive
            : spxChange < -0.3
              ? copy.defensive
              : copy.neutral
          : copy.neutral,
      regimeValue: fearGreed,
      cryptoLeadValue: betaSpread,
      equityValue: spxChange
    };
  }, [copy, snapshot.assets, snapshot.fearGreed]);

  return (
    <section className={styles.root}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 className={styles.title}>{copy.title}</h2>
        </div>
        <p className={styles.description}>{copy.description}</p>
      </div>

      <div className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>{copy.sessions}</h3>
            <span className={styles.badge}>{copy.activeTag}</span>
          </div>

          <div className={styles.sessionList}>
            {sessions.map((session) => (
              <div key={session.city} className={styles.sessionCard}>
                <div>
                  <strong className={styles.sessionCity}>{session.city}</strong>
                  <p className={styles.sessionHours}>{session.hours}</p>
                </div>
                <span
                  className={`${styles.sessionStatus} ${
                    session.status === "live"
                      ? styles.sessionLive
                      : session.status === "next"
                        ? styles.sessionNext
                        : styles.sessionClosed
                  }`}
                >
                  {session.status === "live"
                    ? copy.openNow
                    : session.status === "next"
                      ? copy.opensNext
                      : copy.closed}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>{copy.crossAsset}</h3>
          </div>

          <div className={styles.metricGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>{copy.regime}</span>
              <strong className={styles.metricValue}>{summary.regimeLabel}</strong>
              <span className={getToneClass(summary.regimeValue)}>
                {typeof summary.regimeValue === "number" ? `${summary.regimeValue}` : "-"}
              </span>
            </div>

            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>{copy.cryptoLead}</span>
              <strong className={styles.metricValue}>{summary.cryptoLeadLabel}</strong>
              <span className={getToneClass(summary.cryptoLeadValue)}>
                {formatPercent(summary.cryptoLeadValue)}
              </span>
            </div>

            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>{copy.equityTone}</span>
              <strong className={styles.metricValue}>{summary.equityLabel}</strong>
              <span className={getToneClass(summary.equityValue)}>
                {formatPercent(summary.equityValue)}
              </span>
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>{copy.eventWindow}</h3>
          </div>

          <div className={styles.eventList}>
            {events.map((event, index) => (
              <div key={`${event.title}-${index}`} className={styles.eventCard}>
                <div className={styles.eventTop}>
                  <span className={styles.eventCountry}>{event.country}</span>
                  <span className={styles.eventImpact}>{event.impact}</span>
                </div>
                <strong className={styles.eventTitle}>{event.title}</strong>
                <p className={styles.eventTime}>{event.time}</p>
              </div>
            ))}
            {!events.length ? <p className={styles.empty}>{copy.noEvents}</p> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
