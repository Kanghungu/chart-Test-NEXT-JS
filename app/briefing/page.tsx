"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/components/discover/DiscoverPage.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { formatPercent } from "@/lib/formatters";
import {
  getLocalizedAssetName,
  getLocalizedEventCountry,
  getLocalizedEventTitle,
  getLocalizedImpact
} from "@/lib/marketLocalization";

type SnapshotAsset = {
  symbol: string;
  changePercent: number | null;
};

type WatchItem = {
  symbol: string;
  name: string;
  nameKo?: string;
  nameEn?: string;
  changePercent: number | null;
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

type Language = "ko" | "en";

const QUICK_PROMPTS: Record<Language, string[]> = {
  ko: [
    "오늘 시장에서 가장 중요한 변화 3가지만 짧게 정리해줘.",
    "지금 한국주식과 미국주식 중 어디에 더 강한 추세 신호가 있는지 설명해줘.",
    "오늘 주목해야 할 경제 일정이 시장에 어떤 영향을 줄지 알려줘."
  ],
  en: [
    "Summarize the three most important market changes today.",
    "Explain whether Korean or US stocks have the stronger trend right now.",
    "Tell me how today's key economic events could affect the market."
  ]
};

const COPY: Record<
  Language,
  {
    eyebrow: string;
    title: string;
    description: string;
    strongest: string;
    weakest: string;
    eventsToday: string;
    eventCountHint: string;
    marketBrief: string;
    marketContext: string;
    dailyMove: string;
    todayChecklist: string;
    macro: string;
    askAi: string;
    assistant: string;
    placeholder: string;
    loading: string;
    generate: string;
    emptyAnswer: string;
    askError: string;
  }
> = {
  ko: {
    eyebrow: "AI BRIEFING",
    title: "오늘의 시장 브리핑",
    description: "핵심 자산 움직임, 경제 일정, AI 요약을 한 화면에서 빠르게 확인할 수 있습니다.",
    strongest: "가장 강한 자산",
    weakest: "가장 약한 자산",
    eventsToday: "오늘 일정",
    eventCountHint: "우선 확인할 이벤트 수",
    marketBrief: "브리핑 요약",
    marketContext: "market context",
    dailyMove: "오늘 변동률",
    todayChecklist: "오늘 체크할 일정",
    macro: "macro",
    askAi: "AI에게 브리핑 요청",
    assistant: "assistant",
    placeholder: "오늘 움직임을 어떻게 해석해야 할지 물어보세요.",
    loading: "브리핑 생성 중...",
    generate: "브리핑 생성",
    emptyAnswer: "아직 생성된 브리핑이 없습니다. 빠른 질문을 누르거나 직접 입력해 보세요.",
    askError: "브리핑을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
  },
  en: {
    eyebrow: "AI BRIEFING",
    title: "Daily market briefing",
    description: "Review key asset moves, upcoming macro events, and an AI summary in one focused workspace.",
    strongest: "Strongest asset",
    weakest: "Weakest asset",
    eventsToday: "Events today",
    eventCountHint: "Priority events to watch",
    marketBrief: "Briefing summary",
    marketContext: "market context",
    dailyMove: "Today's move",
    todayChecklist: "Today's checklist",
    macro: "macro",
    askAi: "Ask AI for a briefing",
    assistant: "assistant",
    placeholder: "Ask how you should interpret today's market action.",
    loading: "Generating briefing...",
    generate: "Generate briefing",
    emptyAnswer: "No briefing yet. Start with a quick prompt or type your own question.",
    askError: "We couldn't generate the briefing. Please try again in a moment."
  }
};

function getImpactClassName(impact: string) {
  if (impact.includes("높") || impact.toUpperCase().includes("HIGH")) return styles.impactHigh;
  return styles.impactMedium;
}

export default function BriefingPage() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const prompts = QUICK_PROMPTS[language];

  const [question, setQuestion] = useState(prompts[0]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [snapshotAssets, setSnapshotAssets] = useState<SnapshotAsset[]>([]);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    setQuestion(prompts[0]);
  }, [prompts]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [snapshotRes, watchRes, eventRes] = await Promise.all([
          fetch("/api/market/snapshot", { cache: "no-store" }),
          fetch("/api/market/watchlist", { cache: "no-store" }),
          fetch("/api/market/events", { cache: "no-store" })
        ]);

        const [snapshotJson, watchJson, eventJson] = await Promise.all([
          snapshotRes.json(),
          watchRes.json(),
          eventRes.json()
        ]);

        if (!mounted) return;

        setSnapshotAssets(Array.isArray(snapshotJson?.assets) ? snapshotJson.assets : []);
        setWatchlist(Array.isArray(watchJson?.items) ? watchJson.items : []);
        setEvents(Array.isArray(eventJson?.items) ? eventJson.items.slice(0, 3) : []);
      } catch {
        if (!mounted) return;
        setSnapshotAssets([]);
        setWatchlist([]);
        setEvents([]);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const strongest = useMemo(() => {
    return [...watchlist]
      .filter((item) => typeof item.changePercent === "number")
      .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))[0];
  }, [watchlist]);

  const weakest = useMemo(() => {
    return [...watchlist]
      .filter((item) => typeof item.changePercent === "number")
      .sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))[0];
  }, [watchlist]);

  const ask = async (prompt?: string) => {
    const nextQuestion = (prompt ?? question).trim();
    if (!nextQuestion) return;

    setLoading(true);
    try {
      const res = await fetch("/api/ai/economy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: nextQuestion })
      });
      const json = await res.json();
      setQuestion(nextQuestion);
      setAnswer(json?.answer || "");
    } catch {
      setAnswer(copy.askError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 className={styles.title}>{copy.title}</h1>
            <p className={styles.description}>{copy.description}</p>
          </div>

          <div className={styles.heroStats}>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.strongest}</p>
              <p className={styles.statValue}>{strongest?.symbol || "-"}</p>
              <p className={styles.statHint}>
                {strongest ? getLocalizedAssetName(strongest, language) : formatPercent(null)}
              </p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.weakest}</p>
              <p className={styles.statValue}>{weakest?.symbol || "-"}</p>
              <p className={styles.statHint}>
                {weakest ? getLocalizedAssetName(weakest, language) : formatPercent(null)}
              </p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.eventsToday}</p>
              <p className={styles.statValue}>{events.length}</p>
              <p className={styles.statHint}>{copy.eventCountHint}</p>
            </article>
          </div>
        </section>

        <section className={styles.masonry}>
          <div className={styles.stack}>
            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>{copy.marketBrief}</h2>
                <span className={styles.panelCaption}>{copy.marketContext}</span>
              </div>
              <div className={styles.metricGrid}>
                {snapshotAssets.map((asset) => (
                  <div key={asset.symbol} className={styles.metricCard}>
                    <p className={styles.metricLabel}>{asset.symbol}</p>
                    <p className={styles.metricValue}>{formatPercent(asset.changePercent)}</p>
                    <p className={styles.metricSub}>{copy.dailyMove}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>{copy.todayChecklist}</h2>
                <span className={styles.pill}>{copy.macro}</span>
              </div>
              <div className={styles.stack}>
                {events.map((item) => {
                  const localizedImpact = getLocalizedImpact(item, language);

                  return (
                    <div key={`${item.time}-${item.title}`} className={styles.listCard}>
                      <div className={styles.itemRow}>
                        <div>
                          <p className={styles.itemTitle}>{getLocalizedEventTitle(item, language)}</p>
                          <p className={styles.itemMeta}>{getLocalizedEventCountry(item, language)}</p>
                          <p className={styles.itemMeta}>{item.time}</p>
                        </div>
                        <span className={getImpactClassName(localizedImpact)}>{localizedImpact}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>

          <article className={styles.inputCard}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{copy.askAi}</h2>
              <span className={styles.panelCaption}>{copy.assistant}</span>
            </div>

            <div className={styles.chipRow}>
              {prompts.map((prompt) => (
                <button key={prompt} className={styles.chip} onClick={() => ask(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>

            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className={styles.textarea}
              placeholder={copy.placeholder}
            />

            <div className={styles.buttonRow}>
              <button className={styles.button} onClick={() => ask()} disabled={loading}>
                {loading ? copy.loading : copy.generate}
              </button>
            </div>

            <div className={styles.answerBox}>{answer || copy.emptyAnswer}</div>
          </article>
        </section>
      </div>
    </main>
  );
}
