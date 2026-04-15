"use client";

import { useState } from "react";
import styles from "./SideEconomyAI.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const COPY = {
  ko: {
    title: "AI 시장 어시스턴트",
    description: "시장이나 거시 질문을 입력하면 핵심만 짧게 정리해 답합니다.",
    prompt: "오늘 시장에서 가장 중요한 거시 변수 3가지만 정리해줘",
    rates: "금리 인하 기대감이 미국주식과 한국주식에 어떤 영향을 주는지 알려줘",
    risk: "지금 변동성이 큰 장세에서 리스크 관리 포인트를 알려줘",
    placeholder: "예: 오늘 CPI 발표가 나스닥과 코스피에 어떤 영향을 줄까?",
    submit: "AI에게 질문하기",
    loading: "답변 생성 중...",
    empty: "아직 답변이 없습니다. 위 질문 예시를 눌러 시작해보세요.",
    requestError: "AI 응답 요청에 실패했습니다.",
    fallbackError: "오류가 발생했습니다."
  },
  en: {
    title: "AI Market Assistant",
    description: "Ask a market or macro question and get a concise answer.",
    prompt: "What are the three most important macro variables today?",
    rates: "How do rate-cut expectations affect US and Korean stocks?",
    risk: "Give me a risk-management plan for the current volatile market.",
    placeholder: "Example: How could today's CPI affect Nasdaq and KOSPI?",
    submit: "Ask AI",
    loading: "Generating answer...",
    empty: "No answer yet. Start with one of the prompts above.",
    requestError: "Failed to request an AI response.",
    fallbackError: "Something went wrong."
  }
};

export default function SideEconomyAI() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const QUICK_QUESTIONS = [copy.prompt, copy.rates, copy.risk];
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ask = async (q) => {
    const userQuestion = (q ?? question).trim();
    if (!userQuestion) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ai/economy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: userQuestion })
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || copy.requestError);
      }

      setAnswer(json.answer || "");
      setQuestion(userQuestion);
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.fallbackError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.panel}>
      <h3 className={styles.title}>{copy.title}</h3>
      <p className={styles.desc}>{copy.description}</p>

      <div className={styles.quickWrap}>
        {QUICK_QUESTIONS.map((q) => (
          <button key={q} onClick={() => ask(q)} className={styles.quickBtn}>
            {q}
          </button>
        ))}
      </div>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={copy.placeholder}
        className={styles.input}
      />

      <button onClick={() => ask()} disabled={loading} className={styles.submitBtn}>
        {loading ? copy.loading : copy.submit}
      </button>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.answerBox}>
        {answer ? <p className={styles.answerText}>{answer}</p> : <p className={styles.placeholder}>{copy.empty}</p>}
      </div>
    </section>
  );
}
