"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./HomeSessionBoard.module.css";
import { formatPercent } from "@/lib/formatters";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import {
  getLocalizedEventCountry,
  getLocalizedEventTitle,
  getLocalizedImpact
} from "@/lib/marketLocalization";

type SnapshotAsset = {
  symbol: string;
  price: number | null;
  changePercent: number | null;
};

type SessionRiskRow = {
  price: number | null;
  changePercent: number | null;
};

type SnapshotResponse = {
  assets?: SnapshotAsset[];
  fearGreed?: {
    value: number;
    classification: string;
  } | null;
  stockFearGreed?: {
    value: number;
    classification: string;
  } | null;
  sessionRisk?: {
    vix: SessionRiskRow;
    esFuture: SessionRiskRow;
    nqFuture: SessionRiskRow;
  };
};

type EventItem = {
  time: string;
  country: string;
  countryKo?: string;
  countryEn?: string;
  title: string;
  titleKo?: string;
  titleEn?: string;
  impact: string;
  impactKo?: string;
  impactEn?: string;
};

type SessionStatus = "live" | "next" | "closed";

const COPY = {
  ko: {
    eyebrow: "SESSION COMPASS",
    title: "한국/미국장 포지셔닝 보드",
    description: "실시간 가격보다 한 걸음 위에서, 한국장과 미국장의 힘의 균형을 빠르게 읽는 보드입니다.",
    sessions: "주요 세션",
    crossAsset: "시장 온도",
    eventWindow: "다음 변동성 이벤트",
    openNow: "진행 중",
    opensNext: "다음 오픈",
    closed: "종료",
    regime: "한국장 심리",
    koreaLead: "한국 리더십",
    usTone: "미국장 톤",
    relativeSpread: "KOSDAQ 대 KOSPI",
    riskStrip: "변동성 · 미국 선물 (야간)",
    noEvents: "일정 이벤트를 불러오는 중입니다.",
    positive: "우호적",
    neutral: "중립",
    defensive: "방어적",
    stronger: "강한 확산",
    softer: "대형주 우위",
    balanced: "균형",
    activeTag: "LIVE"
  },
  en: {
    eyebrow: "SESSION COMPASS",
    title: "US / Korea positioning board",
    description: "A higher-level view of how Korean and US equities are behaving right now.",
    sessions: "Key sessions",
    crossAsset: "Market tone",
    eventWindow: "Next volatility window",
    openNow: "Open now",
    opensNext: "Opens next",
    closed: "Closed",
    regime: "Korea sentiment",
    koreaLead: "Korea leadership",
    usTone: "US tone",
    relativeSpread: "KOSDAQ vs KOSPI",
    riskStrip: "Volatility · US futures (overnight)",
    noEvents: "Loading scheduled events.",
    positive: "Constructive",
    neutral: "Neutral",
    defensive: "Defensive",
    stronger: "Broader risk-on",
    softer: "Large-cap lead",
    balanced: "Balanced",
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
          fearGreed: snapshotJson?.fearGreed ?? null,
          stockFearGreed: snapshotJson?.stockFearGreed ?? null,
          sessionRisk: snapshotJson?.sessionRisk
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
    const kospi = snapshot.assets?.find((asset) => asset.symbol === "KOSPI");
    const kosdaq = snapshot.assets?.find((asset) => asset.symbol === "KOSDAQ");
    const nasdaq = snapshot.assets?.find((asset) => asset.symbol === "NASDAQ");
    const koreaFearGreed = snapshot.fearGreed?.value ?? null;
    const usFearGreed = snapshot.stockFearGreed?.value ?? null;
    const kospiChange = kospi?.changePercent ?? null;
    const kosdaqChange = kosdaq?.changePercent ?? null;
    const nasdaqChange = nasdaq?.changePercent ?? null;
    const relativeSpread =
      typeof kosdaqChange === "number" && typeof kospiChange === "number"
        ? kosdaqChange - kospiChange
        : null;

    return {
      regimeLabel:
        typeof koreaFearGreed === "number"
          ? koreaFearGreed >= 60
            ? copy.positive
            : koreaFearGreed <= 35
              ? copy.defensive
              : copy.neutral
          : copy.balanced,
      koreaLeadLabel:
        typeof relativeSpread === "number"
          ? relativeSpread > 0.5
            ? copy.stronger
            : relativeSpread < -0.5
              ? copy.softer
              : copy.balanced
          : copy.balanced,
      usLabel:
        typeof usFearGreed === "number"
          ? usFearGreed >= 60
            ? copy.positive
            : usFearGreed <= 35
              ? copy.defensive
              : copy.neutral
          : typeof nasdaqChange === "number"
            ? nasdaqChange > 0.3
              ? copy.positive
              : nasdaqChange < -0.3
                ? copy.defensive
                : copy.neutral
            : copy.neutral,
      regimeValue: koreaFearGreed,
      koreaLeadValue: relativeSpread,
      usValue: usFearGreed ?? nasdaqChange
    };
  }, [copy, snapshot.assets, snapshot.fearGreed, snapshot.stockFearGreed]);

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
              <span className={styles.metricLabel}>{copy.koreaLead}</span>
              <strong className={styles.metricValue}>{summary.koreaLeadLabel}</strong>
              <span className={getToneClass(summary.koreaLeadValue)}>
                {formatPercent(summary.koreaLeadValue)}
              </span>
            </div>

            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>{copy.usTone}</span>
              <strong className={styles.metricValue}>{summary.usLabel}</strong>
              <span className={getToneClass(summary.usValue)}>{formatPercent(summary.usValue)}</span>
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
                  <span className={styles.eventCountry}>{getLocalizedEventCountry(event, language)}</span>
                  <span className={styles.eventImpact}>{getLocalizedImpact(event, language)}</span>
                </div>
                <strong className={styles.eventTitle}>{getLocalizedEventTitle(event, language)}</strong>
                <p className={styles.eventTime}>{event.time}</p>
              </div>
            ))}
            {!events.length ? <p className={styles.empty}>{copy.noEvents}</p> : null}
          </div>
        </article>
      </div>

      {snapshot.sessionRisk &&
      [snapshot.sessionRisk.vix?.price, snapshot.sessionRisk.esFuture?.price, snapshot.sessionRisk.nqFuture?.price].some(
        (priceValue) => typeof priceValue === "number"
      ) ? (
        <div className={styles.riskStrip}>
          <div className={styles.riskStripHeader}>
            <h3 className={styles.riskStripTitle}>{copy.riskStrip}</h3>
          </div>
          <div className={styles.riskStripGrid}>
            {[
              { key: "vix", label: language === "ko" ? "VIX" : "VIX", row: snapshot.sessionRisk.vix },
              {
                key: "es",
                label: language === "ko" ? "S&P 미니" : "ES",
                row: snapshot.sessionRisk.esFuture
              },
              {
                key: "nq",
                label: language === "ko" ? "나스닥 미니" : "NQ",
                row: snapshot.sessionRisk.nqFuture
              }
            ].map(({ key, label, row }) => {
              const hasChange = typeof row?.changePercent === "number";
              const up = hasChange && row.changePercent >= 0;

              return (
                <div key={key} className={styles.riskCell}>
                  <span className={styles.riskLabel}>{label}</span>
                  <strong className={styles.riskPrice}>
                    {typeof row?.price === "number"
                      ? row.price.toLocaleString(language === "ko" ? "ko-KR" : "en-US", {
                          maximumFractionDigits: 2
                        })
                      : "-"}
                  </strong>
                  <span className={`${styles.riskChange} ${hasChange ? (up ? styles.toneUp : styles.toneDown) : styles.toneNeutral}`}>
                    {formatPercent(row?.changePercent ?? null)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
