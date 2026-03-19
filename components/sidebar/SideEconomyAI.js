"use client";

import { useState } from "react";
import styles from "./SideEconomyAI.module.css";

const COPY = {
  title: "AI \uACBD\uC81C \uC5B4\uC2DC\uC2A4\uD134\uD2B8",
  description:
    "\uC2DC\uC7A5\uACFC \uACBD\uC81C \uAD00\uB828 \uC9C8\uBB38\uC744 \uC785\uB825\uD558\uBA74 \uD575\uC2EC\uB9CC \uC694\uC57D\uD574\uC11C \uB2F5\uBCC0\uD569\uB2C8\uB2E4.",
  prompt:
    "\uC624\uB298 \uC2DC\uC7A5\uC5D0\uC11C \uAC00\uC7A5 \uC911\uC694\uD55C \uACBD\uC81C \uBCC0\uC218 3\uAC00\uC9C0\uB9CC \uC54C\uB824\uC918.",
  rates:
    "\uAE08\uB9AC \uC778\uD558 \uAE30\uB300\uAC10\uC774 \uCF54\uC778\uACFC \uAE30\uC220\uC8FC\uC5D0 \uBBF8\uCE58\uB294 \uC601\uD5A5\uC740 \uBB50\uC57C?",
  risk:
    "\uC9C0\uAE08 \uBCC0\uB3D9\uC131 \uC7A5\uC138\uC5D0\uC11C \uB9AC\uC2A4\uD06C \uAD00\uB9AC \uC804\uB7B5\uC744 \uC54C\uB824\uC918.",
  placeholder:
    "\uC608: \uC624\uB298 CPI \uBC1C\uD45C\uAC00 \uB098\uC2A4\uB2E5\uACFC \uBE44\uD2B8\uCF54\uC778\uC5D0 \uC5B4\uB5A4 \uC601\uD5A5\uC744 \uC904\uAE4C?",
  submit: "AI\uC5D0\uAC8C \uC9C8\uBB38\uD558\uAE30",
  loading: "\uB2F5\uBCC0 \uC0DD\uC131 \uC911...",
  empty:
    "\uC544\uC9C1 \uB2F5\uBCC0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC704 \uC9C8\uBB38 \uC608\uC2DC\uB97C \uB20C\uB7EC \uC2DC\uC791\uD574\uBCF4\uC138\uC694.",
  requestError: "AI \uC751\uB2F5 \uC694\uCCAD\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
  fallbackError: "\uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4."
};

const QUICK_QUESTIONS = [COPY.prompt, COPY.rates, COPY.risk];

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
        throw new Error(json?.error || COPY.requestError);
      }

      setAnswer(json.answer || "");
      setQuestion(userQuestion);
    } catch (e) {
      setError(e instanceof Error ? e.message : COPY.fallbackError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.panel}>
      <h3 className={styles.title}>{COPY.title}</h3>
      <p className={styles.desc}>{COPY.description}</p>

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
        placeholder={COPY.placeholder}
        className={styles.input}
      />

      <button onClick={() => ask()} disabled={loading} className={styles.submitBtn}>
        {loading ? COPY.loading : COPY.submit}
      </button>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.answerBox}>
        {answer ? <p className={styles.answerText}>{answer}</p> : <p className={styles.placeholder}>{COPY.empty}</p>}
      </div>
    </section>
  );
}
