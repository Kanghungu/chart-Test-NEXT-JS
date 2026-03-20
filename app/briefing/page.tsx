"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/components/discover/DiscoverPage.module.css";
import { formatPercent } from "@/lib/formatters";

type SnapshotAsset = {
  symbol: string;
  changePercent: number | null;
};

type WatchItem = {
  symbol: string;
  name: string;
  changePercent: number | null;
};

type EventItem = {
  time: string;
  country: string;
  title: string;
  impact: string;
};

const QUICK_PROMPTS = [
  "오늘 시장에서 가장 중요한 변수 3가지만 짧게 정리해줘.",
  "지금 코인과 기술주 중 어디에 더 리스크 온 신호가 강한지 설명해줘.",
  "오늘 주목해야 할 경제 일정이 시장에 어떤 영향을 줄지 알려줘."
];

export default function BriefingPage() {
  const [question, setQuestion] = useState(QUICK_PROMPTS[0]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [snapshotAssets, setSnapshotAssets] = useState<SnapshotAsset[]>([]);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

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
      setAnswer("브리핑을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>AI BRIEFING</p>
            <h1 className={styles.title}>오늘의 시장 브리핑</h1>
            <p className={styles.description}>
              핵심 자산 움직임, 예정된 경제 일정, 그리고 AI 요약을 한 곳에 묶어서 장 시작 전이나 변동성 확대 구간에 빠르게 읽을 수 있게 만들었습니다.
            </p>
          </div>

          <div className={styles.heroStats}>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>가장 강한 자산</p>
              <p className={styles.statValue}>{strongest?.symbol || "-"}</p>
              <p className={styles.statHint}>{formatPercent(strongest?.changePercent ?? null)}</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>가장 약한 자산</p>
              <p className={styles.statValue}>{weakest?.symbol || "-"}</p>
              <p className={styles.statHint}>{formatPercent(weakest?.changePercent ?? null)}</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>오늘 일정</p>
              <p className={styles.statValue}>{events.length}</p>
              <p className={styles.statHint}>우선 체크할 이벤트</p>
            </article>
          </div>
        </section>

        <section className={styles.masonry}>
          <div className={styles.stack}>
            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>브리핑 재료</h2>
                <span className={styles.panelCaption}>market context</span>
              </div>
              <div className={styles.metricGrid}>
                {snapshotAssets.map((asset) => (
                  <div key={asset.symbol} className={styles.metricCard}>
                    <p className={styles.metricLabel}>{asset.symbol}</p>
                    <p className={styles.metricValue}>{formatPercent(asset.changePercent)}</p>
                    <p className={styles.metricSub}>오늘 변동률</p>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>오늘 체크할 일정</h2>
                <span className={styles.pill}>macro</span>
              </div>
              <div className={styles.stack}>
                {events.map((item) => (
                  <div key={`${item.time}-${item.title}`} className={styles.listCard}>
                    <div className={styles.itemRow}>
                      <div>
                        <p className={styles.itemTitle}>{item.title}</p>
                        <p className={styles.itemMeta}>{item.country}</p>
                        <p className={styles.itemMeta}>{item.time}</p>
                      </div>
                      <span className={item.impact.includes("높") ? styles.impactHigh : styles.impactMedium}>{item.impact}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <article className={styles.inputCard}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>AI에게 브리핑 요청</h2>
              <span className={styles.panelCaption}>assistant</span>
            </div>

            <div className={styles.chipRow}>
              {QUICK_PROMPTS.map((prompt) => (
                <button key={prompt} className={styles.chip} onClick={() => ask(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>

            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className={styles.textarea}
              placeholder="오늘 장세를 어떻게 해석하면 좋을지 물어보세요."
            />

            <div className={styles.buttonRow}>
              <button className={styles.button} onClick={() => ask()} disabled={loading}>
                {loading ? "브리핑 생성 중..." : "브리핑 생성"}
              </button>
            </div>

            <div className={styles.answerBox}>
              {answer || "아직 생성된 브리핑이 없습니다. 위 빠른 질문이나 직접 입력으로 시작해보세요."}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
