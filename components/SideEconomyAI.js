"use client";

import { useState } from "react";
import styles from "./SideEconomyAI.module.css";

const QUICK_QUESTIONS = [
  "오늘 시장에서 가장 중요한 경제 변수 3가지만 알려줘",
  "금리 인하 기대가 코인과 기술주에 미치는 영향은?",
  "지금 변동성 장세에서 리스크 관리 팁을 알려줘"
];

export default function SideEconomyAI() {
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
        throw new Error(json?.error || "AI 응답 실패");
      }

      setAnswer(json.answer || "");
      setQuestion(userQuestion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.panel}>
      <h3 className={styles.title}>AI 경제 어시스턴트</h3>
      <p className={styles.desc}>시장/경제 질문을 입력하면 핵심만 요약해 드립니다.</p>

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
        placeholder="예) 오늘 CPI 발표가 나스닥과 비트코인에 어떤 영향을 줄까?"
        className={styles.input}
      />

      <button onClick={() => ask()} disabled={loading} className={styles.submitBtn}>
        {loading ? "답변 생성 중..." : "AI에게 질문하기"}
      </button>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.answerBox}>
        {answer ? (
          <p className={styles.answerText}>{answer}</p>
        ) : (
          <p className={styles.placeholder}>아직 답변이 없습니다. 위 질문 예시를 눌러 시작해 보세요.</p>
        )}
      </div>
    </section>
  );
}

