"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import styles from "./GeoRiskMonitor.module.css";
import type { GeoNewsItem } from "@/app/api/news/geopolitical/route";

type OverallRisk = "HIGH" | "MEDIUM" | "LOW" | "CLEAR";

type GeoData = {
  itemsKo: GeoNewsItem[];
  itemsEn: GeoNewsItem[];
  overallRisk: OverallRisk;
  fetchedAt: string;
};

function timeAgo(dateStr: string, lang: "ko" | "en"): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (isNaN(mins) || mins < 0) return "";
  if (mins < 1) return lang === "ko" ? "방금" : "just now";
  if (mins < 60) return lang === "ko" ? `${mins}분 전` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === "ko" ? `${hrs}시간 전` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return lang === "ko" ? `${days}일 전` : `${days}d ago`;
}

const RISK_CONFIG = {
  HIGH:   { labelKo: "고위험", labelEn: "HIGH RISK", cls: styles.riskHigh   },
  MEDIUM: { labelKo: "중위험", labelEn: "MED RISK",  cls: styles.riskMedium },
  LOW:    { labelKo: "저위험", labelEn: "LOW RISK",  cls: styles.riskLow    },
  CLEAR:  { labelKo: "안정",   labelEn: "CLEAR",     cls: styles.riskClear  },
};

export default function GeoRiskMonitor() {
  const { language } = useLanguage();
  const [data, setData] = useState<GeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/news/geopolitical");
        const json = await res.json();
        if (mounted) setData(json);
      } catch {
        // 이전 데이터 유지
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  const COPY = {
    ko: {
      eyebrow: "GEOPOLITICAL RISK",
      title: "지정학 리스크 모니터",
      noSignal: "현재 주요 지정학 리스크 신호 없음",
      expand: "더 보기",
      collapse: "접기",
      affects: "영향 자산",
      sourceTag: "연합뉴스",
      fallbackTag: "영문 기사",
    },
    en: {
      eyebrow: "GEOPOLITICAL RISK",
      title: "Geopolitical Risk Monitor",
      noSignal: "No active geopolitical risk signals",
      expand: "Show more",
      collapse: "Show less",
      affects: "Affected",
      sourceTag: "Yonhap",
      fallbackTag: "EN source",
    },
  };
  const copy = COPY[language];

  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  const risk = data?.overallRisk ?? "CLEAR";
  const cfg = RISK_CONFIG[risk];

  // 현재 언어에 맞는 기사 우선 사용, 없으면 반대 언어로 fallback
  const primaryItems  = language === "ko" ? (data?.itemsKo ?? []) : (data?.itemsEn ?? []);
  const fallbackItems = language === "ko" ? (data?.itemsEn ?? []) : (data?.itemsKo ?? []);
  const items = primaryItems.length > 0 ? primaryItems : fallbackItems;
  const usingFallback = primaryItems.length === 0 && fallbackItems.length > 0;

  const topItem   = items[0] ?? null;
  const restItems = items.slice(1);

  return (
    <div className={`${styles.root} ${styles[`rootRisk${risk}`]}`}>
      {/* ── 헤더 ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 className={styles.title}>{copy.title}</h2>
        </div>
        <div className={`${styles.riskBadge} ${cfg.cls}`}>
          <span className={styles.riskDot} />
          {language === "ko" ? cfg.labelKo : cfg.labelEn}
        </div>
      </div>

      {/* ── 신호 없음 ── */}
      {items.length === 0 && (
        <p className={styles.noSignal}>{copy.noSignal}</p>
      )}

      {/* ── fallback 안내 ── */}
      {usingFallback && (
        <p className={styles.fallbackNotice}>
          {language === "ko"
            ? "* 한국어 기사를 불러올 수 없어 영문 기사로 표시됩니다"
            : "* Showing English articles (Korean source unavailable)"}
        </p>
      )}

      {/* ── 메인 알림 카드 ── */}
      {topItem && (
        <div className={`${styles.alertCard} ${styles[`impact${topItem.impact}`]}`}>
          <div className={styles.alertTop}>
            <div className={styles.alertTopLeft}>
              <span className={`${styles.regionTag} ${styles[`impact${topItem.impact}Tag`]}`}>
                {language === "ko" ? topItem.regionKo : topItem.regionEn}
              </span>
              {topItem.lang === "ko" && (
                <span className={styles.sourceKo}>연합뉴스</span>
              )}
            </div>
            <span className={styles.alertTime}>{timeAgo(topItem.pubDate, language)}</span>
          </div>
          <p className={styles.alertTitle}>{topItem.title}</p>
          <div className={styles.assetRow}>
            <span className={styles.affectsLabel}>{copy.affects}</span>
            {topItem.assets.map((a) => (
              <span
                key={a.symbol}
                className={`${styles.assetChip} ${a.dir === "up" ? styles.chipUp : styles.chipDown}`}
              >
                {a.dir === "up" ? "↑" : "↓"} {language === "ko" ? a.nameKo : a.symbol}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── 확장 목록 ── */}
      {restItems.length > 0 && expanded && (
        <div className={styles.expandedList}>
          {restItems.map((item, i) => (
            <div key={i} className={`${styles.miniCard} ${styles[`impact${item.impact}`]}`}>
              <div className={styles.miniTop}>
                <div className={styles.alertTopLeft}>
                  <span className={`${styles.regionTagSm} ${styles[`impact${item.impact}Tag`]}`}>
                    {language === "ko" ? item.regionKo : item.regionEn}
                  </span>
                  {item.lang === "ko" && (
                    <span className={styles.sourceKoSm}>연합</span>
                  )}
                </div>
                <span className={styles.alertTime}>{timeAgo(item.pubDate, language)}</span>
              </div>
              <p className={styles.miniTitle}>{item.title}</p>
              <div className={styles.assetRowSm}>
                {item.assets.slice(0, 4).map((a) => (
                  <span
                    key={a.symbol}
                    className={`${styles.assetChipSm} ${a.dir === "up" ? styles.chipUp : styles.chipDown}`}
                  >
                    {a.dir === "up" ? "↑" : "↓"} {language === "ko" ? a.nameKo : a.symbol}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 더 보기 버튼 ── */}
      {restItems.length > 0 && (
        <button className={styles.expandBtn} onClick={() => setExpanded((v) => !v)}>
          {expanded ? copy.collapse : `${copy.expand} (${restItems.length})`}
        </button>
      )}
    </div>
  );
}
