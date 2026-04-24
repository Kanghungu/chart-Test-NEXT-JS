/**
 * Signal insight data — 판단 포인트, 트리거, 무효화 조건
 * Used by both SignalChartModal (CryptoSignal) and TechCard (TechSignal).
 */

export type SignalInsight = {
  points: string[];   // 판단 포인트
  trigger: string;    // 트리거 (진입 확인 조건)
  invalidation: string; // 무효화 조건
};

// ── CryptoSignal insights ─────────────────────────────────────────────────

type CryptoType = "HARMONIC" | "DIVERGENCE" | "ZONE_BREAK" | "HARMONIC_PRZ" | "ZONE_APPROACH";
type Direction  = "BULLISH" | "BEARISH";

const CRYPTO_INSIGHTS: Record<
  CryptoType,
  Record<Direction, Record<"ko" | "en", SignalInsight>>
> = {
  HARMONIC: {
    BULLISH: {
      ko: {
        points: [
          "PRZ 진입 시 거래량 증가 여부 반드시 확인",
          "핀바·강세 엔겔핑 등 반전 캔들 완성 후 진입",
          "상위 타임프레임 상승 추세이면 신뢰도 크게 상승",
          "D 포인트 이전 스윙 저점을 손절 기준으로 설정",
        ],
        trigger: "PRZ 내 양봉 반전 캔들 완성 + 다음 캔들 양봉 확인봉",
        invalidation: "PRZ Min (przMin) 아래로 종가 마감 → 패턴 무효",
      },
      en: {
        points: [
          "Confirm volume increase on PRZ entry",
          "Wait for reversal candle (pin bar, bullish engulfing) before entering",
          "Higher timeframe uptrend significantly boosts reliability",
          "Set stop-loss below the last swing low before point D",
        ],
        trigger: "Bullish reversal candle inside PRZ + next candle confirmation",
        invalidation: "Candle closes below PRZ Min → pattern invalidated",
      },
    },
    BEARISH: {
      ko: {
        points: [
          "PRZ 진입 시 거래량 증가 여부 반드시 확인",
          "슈팅스타·약세 엔겔핑 등 반전 캔들 완성 후 진입",
          "상위 타임프레임 하락 추세이면 신뢰도 크게 상승",
          "D 포인트 이전 스윙 고점을 손절 기준으로 설정",
        ],
        trigger: "PRZ 내 음봉 반전 캔들 완성 + 다음 캔들 음봉 확인봉",
        invalidation: "PRZ Max (przMax) 위로 종가 마감 → 패턴 무효",
      },
      en: {
        points: [
          "Confirm volume increase on PRZ entry",
          "Wait for reversal candle (shooting star, bearish engulfing) before entering",
          "Higher timeframe downtrend significantly boosts reliability",
          "Set stop-loss above the last swing high before point D",
        ],
        trigger: "Bearish reversal candle inside PRZ + next candle confirmation",
        invalidation: "Candle closes above PRZ Max → pattern invalidated",
      },
    },
  },

  DIVERGENCE: {
    BULLISH: {
      ko: {
        points: [
          "RSI가 30 아래 과매도 구간에서 상승 전환하는지 확인",
          "두 번째 저점(L2)에서 거래량 증가 동반 시 신뢰도 상승",
          "가격 L2에서 핀바·도지 등 반전 캔들 패턴 병행 확인",
          "상위 타임프레임에서도 지지 구간과 겹칠 경우 우선순위↑",
        ],
        trigger: "RSI 30선 상향 돌파 + L2 이후 가격 고점 갱신",
        invalidation: "새로운 가격 저점 경신 + RSI도 새 저점 → 다이버전스 취소",
      },
      en: {
        points: [
          "Confirm RSI turning up from below 30 (oversold)",
          "Volume increase at L2 significantly boosts reliability",
          "Look for reversal candle pattern (pin bar, doji) at L2",
          "Overlap with support zone on higher timeframe = higher priority",
        ],
        trigger: "RSI breaks above 30 + price makes a new higher low after L2",
        invalidation: "New price low + RSI also makes new low → divergence cancelled",
      },
    },
    BEARISH: {
      ko: {
        points: [
          "RSI가 70 위 과매수 구간에서 하락 전환하는지 확인",
          "두 번째 고점(H2) 거래량이 H1보다 적을수록 신뢰도 상승",
          "가격 H2에서 슈팅스타·약세 엔겔핑 캔들 패턴 병행 확인",
          "상위 타임프레임 저항 구간과 겹칠 경우 우선순위↑",
        ],
        trigger: "RSI 70선 하향 돌파 + H2 이후 가격 저점 갱신",
        invalidation: "새로운 가격 고점 경신 + RSI도 새 고점 → 다이버전스 취소",
      },
      en: {
        points: [
          "Confirm RSI turning down from above 70 (overbought)",
          "H2 volume lower than H1 strengthens the signal",
          "Look for reversal candle (shooting star, bearish engulfing) at H2",
          "Overlap with resistance zone on higher timeframe = higher priority",
        ],
        trigger: "RSI breaks below 70 + price makes a new lower high after H2",
        invalidation: "New price high + RSI also makes new high → divergence cancelled",
      },
    },
  },

  ZONE_BREAK: {
    BULLISH: {
      ko: {
        points: [
          "돌파 이후 구간(박스) 재테스트 시 지지로 작동하는지 확인",
          "돌파 캔들 거래량 > 평균 1.3배 이상이면 신뢰도 상승",
          "상위 타임프레임에서도 같은 방향이면 추세 연장 가능",
          "구간 재테스트 후 반등 캔들이 진입 타이밍",
        ],
        trigger: "구간 상단 재테스트 후 양봉 확인 + 거래량 증가",
        invalidation: "구간 내부로 종가 재진입 → 돌파 실패 / 속임수 돌파",
      },
      en: {
        points: [
          "Confirm zone (box) acts as support on retest after breakout",
          "Breakout candle volume > 1.3× average = higher reliability",
          "Same direction on higher timeframe suggests trend continuation",
          "Retest bounce candle is the ideal entry timing",
        ],
        trigger: "Retest of zone top → bullish candle + volume confirmation",
        invalidation: "Close back inside zone → failed breakout / bull trap",
      },
    },
    BEARISH: {
      ko: {
        points: [
          "돌파 이후 구간(박스) 재테스트 시 저항으로 작동하는지 확인",
          "돌파 캔들 거래량 > 평균 1.3배 이상이면 신뢰도 상승",
          "상위 타임프레임에서도 같은 방향이면 추세 연장 가능",
          "구간 재테스트 후 반락 캔들이 진입 타이밍",
        ],
        trigger: "구간 하단 재테스트 후 음봉 확인 + 거래량 증가",
        invalidation: "구간 내부로 종가 재진입 → 돌파 실패 / 속임수 돌파",
      },
      en: {
        points: [
          "Confirm zone (box) acts as resistance on retest after breakdown",
          "Breakdown candle volume > 1.3× average = higher reliability",
          "Same direction on higher timeframe suggests trend continuation",
          "Retest rejection candle is the ideal short entry",
        ],
        trigger: "Retest of zone bottom → bearish candle + volume confirmation",
        invalidation: "Close back inside zone → failed breakdown / bear trap",
      },
    },
  },

  HARMONIC_PRZ: {
    BULLISH: {
      ko: {
        points: [
          "D 포인트 완성까지 아직 진입 금지 — 패턴이 형성 중",
          "PRZ 범위에 지정가 주문 미리 설정해 두는 전략 유효",
          "D 진입 후 반전 캔들 형성 시 하모닉 완성으로 최종 확인",
          "PRZ 폭이 좁을수록 정교한 패턴 → 신뢰도 상승",
        ],
        trigger: "가격이 PRZ 진입 + 반전 캔들 완성 = 하모닉 완성 신호",
        invalidation: "PRZ Min 아래로 통과 종가 → 패턴 붕괴",
      },
      en: {
        points: [
          "Do NOT enter yet — point D has not formed, pattern is still developing",
          "Pre-setting limit orders inside the PRZ range is a valid strategy",
          "Reversal candle after D forms = harmonic pattern confirmed",
          "Narrower PRZ = more precise pattern = higher reliability",
        ],
        trigger: "Price enters PRZ + reversal candle completes = full harmonic signal",
        invalidation: "Candle closes below PRZ Min → pattern collapsed",
      },
    },
    BEARISH: {
      ko: {
        points: [
          "D 포인트 완성까지 아직 진입 금지 — 패턴이 형성 중",
          "PRZ 범위에 공매도 지정가 주문 미리 설정 전략 유효",
          "D 진입 후 반전 캔들 형성 시 하모닉 완성으로 최종 확인",
          "PRZ 폭이 좁을수록 정교한 패턴 → 신뢰도 상승",
        ],
        trigger: "가격이 PRZ 진입 + 반전 캔들 완성 = 하모닉 완성 신호",
        invalidation: "PRZ Max 위로 통과 종가 → 패턴 붕괴",
      },
      en: {
        points: [
          "Do NOT enter yet — point D has not formed, pattern is still developing",
          "Pre-setting short limit orders inside the PRZ range is a valid strategy",
          "Reversal candle after D forms = harmonic pattern confirmed",
          "Narrower PRZ = more precise pattern = higher reliability",
        ],
        trigger: "Price enters PRZ + reversal candle completes = full harmonic signal",
        invalidation: "Candle closes above PRZ Max → pattern collapsed",
      },
    },
  },

  ZONE_APPROACH: {
    BULLISH: {
      ko: {
        points: [
          "구간 돌파 전 거래량·RSI 모멘텀이 축적되고 있는지 확인",
          "구간 근처에서 망치형·불리시 엔겔핑 캔들 주시",
          "속임수 돌파(위크아웃) 대비: 종가 확정 후 진입 원칙",
          "RSI > 50 이상이면 모멘텀 확인, 진입 신뢰도 상승",
        ],
        trigger: "구간 상단 돌파 + 종가 확정 + 거래량 급증",
        invalidation: "구간 못 넘고 밀림 + RSI 꺾임 하락 → 진입 포기",
      },
      en: {
        points: [
          "Check if volume & RSI momentum are building before the breakout",
          "Watch for hammer / bullish engulfing candles near the zone",
          "Guard against fake breakout (wick out): wait for candle close confirmation",
          "RSI > 50 confirms momentum, increases entry confidence",
        ],
        trigger: "Zone top breakout + candle close above + volume surge",
        invalidation: "Rejected at zone + RSI turns down → skip entry",
      },
    },
    BEARISH: {
      ko: {
        points: [
          "구간 이탈 전 거래량·RSI 모멘텀이 약화되고 있는지 확인",
          "구간 근처에서 슈팅스타·약세 엔겔핑 캔들 주시",
          "속임수 돌파 대비: 종가 확정 후 진입 원칙",
          "RSI < 50 이하이면 하락 모멘텀 확인, 신뢰도 상승",
        ],
        trigger: "구간 하단 이탈 + 종가 확정 + 거래량 급증",
        invalidation: "구간 위로 반등 + RSI 회복 → 진입 포기",
      },
      en: {
        points: [
          "Check if volume & RSI momentum are weakening before breakdown",
          "Watch for shooting star / bearish engulfing candles near the zone",
          "Guard against fake breakdown: wait for candle close confirmation",
          "RSI < 50 confirms bearish momentum, increases entry confidence",
        ],
        trigger: "Zone bottom breakdown + candle close below + volume surge",
        invalidation: "Price bounces back above zone + RSI recovers → skip entry",
      },
    },
  },
};

export function getCryptoInsight(
  type: CryptoType,
  direction: Direction,
  lang: "ko" | "en",
): SignalInsight {
  return CRYPTO_INSIGHTS[type]?.[direction]?.[lang] ?? {
    points: [],
    trigger: "",
    invalidation: "",
  };
}

// ── TechSignal insights ───────────────────────────────────────────────────

type TechType = "EMA_CROSS" | "BB_SQUEEZE" | "VOL_SPIKE" | "STOCH_RSI";

const TECH_INSIGHTS: Record<
  TechType,
  Record<Direction | "NEUTRAL", Record<"ko" | "en", SignalInsight>>
> = {
  EMA_CROSS: {
    BULLISH: {
      ko: {
        points: [
          "크로스 이후 종가가 느린 EMA 위에서 유지되는지 확인",
          "다음 캔들 거래량이 평균보다 증가하면 신뢰도 상승",
          "상위 타임프레임 추세와 같은 방향이면 우선순위 높음",
          "빠른 EMA가 느린 EMA 위에서 벌어질수록 모멘텀 강화",
        ],
        trigger: "가격이 느린 EMA 위에서 지지받으며 반등 확인",
        invalidation: "종가가 다시 느린 EMA 아래로 내려가면 신호 무효",
      },
      en: {
        points: [
          "Confirm candle closes stay above the slow EMA after the cross",
          "Volume above average on next candles = higher reliability",
          "Same direction on higher timeframe = higher priority",
          "Widening gap between EMAs = strengthening momentum",
        ],
        trigger: "Price bounces off slow EMA as support = confirmed entry",
        invalidation: "Close below slow EMA again → signal invalidated",
      },
    },
    BEARISH: {
      ko: {
        points: [
          "크로스 이후 종가가 느린 EMA 아래에서 유지되는지 확인",
          "다음 캔들 거래량이 평균보다 증가하면 신뢰도 상승",
          "상위 타임프레임 하락 추세와 방향 일치 시 우선순위 높음",
          "빠른 EMA가 느린 EMA 아래에서 벌어질수록 하락 모멘텀 강화",
        ],
        trigger: "가격이 느린 EMA 아래에서 저항받으며 반락 확인",
        invalidation: "종가가 다시 느린 EMA 위로 올라가면 신호 무효",
      },
      en: {
        points: [
          "Confirm candle closes stay below the slow EMA after the cross",
          "Volume above average on next candles = higher reliability",
          "Same direction on higher timeframe downtrend = higher priority",
          "Widening gap below slow EMA = strengthening bearish momentum",
        ],
        trigger: "Price rejects slow EMA as resistance = confirmed short entry",
        invalidation: "Close above slow EMA again → signal invalidated",
      },
    },
    NEUTRAL: {
      ko: {
        points: ["방향 미결정 — 크로스 이후 캔들 추이 확인 필요"],
        trigger: "EMA 교차 방향 유지 + 거래량 확인",
        invalidation: "EMA 재역전",
      },
      en: {
        points: ["Direction undecided — monitor candles after the cross"],
        trigger: "EMA cross direction holds + volume confirmation",
        invalidation: "EMA re-crosses in opposite direction",
      },
    },
  },

  BB_SQUEEZE: {
    BULLISH: {
      ko: {
        points: [
          "스퀴즈 해제 첫 큰 캔들 방향 = 돌파 방향 (상승 선호)",
          "거래량 급등 동반 시 방향성 신뢰도 크게 상승",
          "스퀴즈 기간이 길수록(캔들 수 많을수록) 폭발력 강해지는 경향",
          "BB 중심선(20 SMA) 위에서 해제되면 상승 편향 강화",
        ],
        trigger: "BB 폭 확장 + 상방 돌파 캔들 완성 + 거래량 증가",
        invalidation: "돌파 없이 BB 재수축 / 하방으로 큰 캔들 발생",
      },
      en: {
        points: [
          "First large candle after squeeze release = breakout direction (bullish bias here)",
          "Volume surge alongside = significantly higher directional reliability",
          "Longer squeeze duration = stronger explosive potential",
          "Release above BB midline (20 SMA) reinforces bullish bias",
        ],
        trigger: "BB bandwidth expanding + upward breakout candle + volume surge",
        invalidation: "No breakout + BB re-contracts / bearish candle dominates",
      },
    },
    BEARISH: {
      ko: {
        points: [
          "스퀴즈 해제 첫 큰 캔들 방향 = 돌파 방향 (하락 선호)",
          "거래량 급등 동반 시 방향성 신뢰도 크게 상승",
          "스퀴즈 기간이 길수록 폭발력 강해지는 경향",
          "BB 중심선(20 SMA) 아래에서 해제되면 하락 편향 강화",
        ],
        trigger: "BB 폭 확장 + 하방 돌파 캔들 완성 + 거래량 증가",
        invalidation: "돌파 없이 BB 재수축 / 상방으로 큰 캔들 발생",
      },
      en: {
        points: [
          "First large candle after squeeze release = breakout direction (bearish bias here)",
          "Volume surge alongside = significantly higher directional reliability",
          "Longer squeeze duration = stronger explosive potential",
          "Release below BB midline (20 SMA) reinforces bearish bias",
        ],
        trigger: "BB bandwidth expanding + downward breakout candle + volume surge",
        invalidation: "No breakout + BB re-contracts / bullish candle dominates",
      },
    },
    NEUTRAL: {
      ko: {
        points: [
          "스퀴즈 활성 중 — 방향 미결정, 돌파 대기",
          "스퀴즈 해제 첫 캔들 방향을 반드시 확인 후 진입",
        ],
        trigger: "BB 폭 급확장 + 방향성 캔들 완성",
        invalidation: "폭발 없이 BB 재수축",
      },
      en: {
        points: [
          "Squeeze active — direction undecided, awaiting breakout",
          "Always confirm the direction of the first release candle before entering",
        ],
        trigger: "BB bandwidth surges + directional candle completes",
        invalidation: "No breakout + BB re-contracts",
      },
    },
  },

  VOL_SPIKE: {
    BULLISH: {
      ko: {
        points: [
          "급등 거래량이 2-3 캔들 지속되는지 확인 (단발성 vs 추세)",
          "급등 캔들 꼬리가 짧을수록 매수세 강도 높음",
          "뉴스·이벤트 없는 거래량 급등은 기관 누적 가능성↑",
          "고점 갱신 동반 여부로 모멘텀 방향 재확인",
        ],
        trigger: "거래량 급등 방향으로 연속 2 캔들 이상 지속",
        invalidation: "다음 캔들이 급등 캔들 전체를 완전히 소화(엔겔핑) 시",
      },
      en: {
        points: [
          "Check if elevated volume persists for 2-3 candles (trend vs one-off)",
          "Short upper wick on spike candle = stronger buying conviction",
          "Volume spike without news = potential institutional accumulation",
          "New price high alongside = momentum direction confirmed",
        ],
        trigger: "Bullish direction continues for 2+ candles after spike",
        invalidation: "Next candle fully engulfs the spike candle bearishly",
      },
    },
    BEARISH: {
      ko: {
        points: [
          "급등 거래량이 2-3 캔들 지속되는지 확인",
          "급락 캔들 꼬리가 짧을수록 매도세 강도 높음",
          "뉴스·이벤트 없는 거래량 급등 매도는 기관 분산 가능성↑",
          "저점 갱신 동반 여부로 하락 모멘텀 재확인",
        ],
        trigger: "하락 방향으로 연속 2 캔들 이상 지속",
        invalidation: "다음 캔들이 급락 캔들 전체를 완전히 소화 시",
      },
      en: {
        points: [
          "Check if elevated volume persists for 2-3 candles",
          "Short lower wick on spike candle = stronger selling conviction",
          "Volume spike without news = potential institutional distribution",
          "New price low alongside = bearish momentum confirmed",
        ],
        trigger: "Bearish direction continues for 2+ candles after spike",
        invalidation: "Next candle fully engulfs the spike candle bullishly",
      },
    },
    NEUTRAL: {
      ko: {
        points: ["거래량 급등이지만 방향 불명확 — 다음 캔들 방향 확인 필수"],
        trigger: "방향성 캔들 확인 후 추종",
        invalidation: "방향 없는 거래량 소멸",
      },
      en: {
        points: ["Volume spike but direction unclear — confirm next candle direction"],
        trigger: "Follow directional candle after spike",
        invalidation: "Volume fades with no directional follow-through",
      },
    },
  },

  STOCH_RSI: {
    BULLISH: {
      ko: {
        points: [
          "K선이 D선을 완전히 교차 후 위에서 유지되는지 확인",
          "RSI(14)가 30-50 구간에서 회복 중이면 신뢰도 상승",
          "가격 액션(캔들 패턴)과 방향 일치 여부 교차 검증",
          "과매도 구간(<20)에서 교차 시 반등 가능성 가장 높음",
        ],
        trigger: "K > D 유지 + 가격 반등 캔들 확인 + 거래량 증가",
        invalidation: "K선이 다시 D선 아래로 역전 / 가격 신저점 경신",
      },
      en: {
        points: [
          "Confirm K line holds above D line after the cross",
          "RSI(14) recovering from 30-50 range = higher reliability",
          "Cross-verify with price action (candlestick patterns)",
          "Cross in oversold zone (<20) = highest bounce probability",
        ],
        trigger: "K > D sustained + bullish candle + volume increase",
        invalidation: "K crosses back below D / price makes new low",
      },
    },
    BEARISH: {
      ko: {
        points: [
          "K선이 D선을 완전히 교차 후 아래에서 유지되는지 확인",
          "RSI(14)가 50-70 구간에서 하락 중이면 신뢰도 상승",
          "가격 액션과 방향 일치 여부 교차 검증",
          "과매수 구간(>80)에서 교차 시 조정 가능성 가장 높음",
        ],
        trigger: "K < D 유지 + 가격 하락 캔들 확인 + 거래량 증가",
        invalidation: "K선이 다시 D선 위로 역전 / 가격 신고점 경신",
      },
      en: {
        points: [
          "Confirm K line holds below D line after the cross",
          "RSI(14) declining from 50-70 range = higher reliability",
          "Cross-verify with price action (candlestick patterns)",
          "Cross in overbought zone (>80) = highest pullback probability",
        ],
        trigger: "K < D sustained + bearish candle + volume increase",
        invalidation: "K crosses back above D / price makes new high",
      },
    },
    NEUTRAL: {
      ko: {
        points: ["Stoch RSI 방향 불명확 — 교차 방향 확인 후 진입"],
        trigger: "명확한 K/D 교차 + 방향성 캔들",
        invalidation: "Stoch RSI 재역전",
      },
      en: {
        points: ["Stoch RSI direction unclear — confirm cross direction before entering"],
        trigger: "Clear K/D cross + directional candle",
        invalidation: "Stoch RSI re-crosses opposite",
      },
    },
  },
};

export function getTechInsight(
  type: TechType,
  direction: Direction | "NEUTRAL",
  lang: "ko" | "en",
): SignalInsight {
  return TECH_INSIGHTS[type]?.[direction]?.[lang] ?? {
    points: [],
    trigger: "",
    invalidation: "",
  };
}
