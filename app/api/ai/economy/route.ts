import { NextResponse } from "next/server";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const MARKET_KEYWORDS = [
  "경제",
  "시장",
  "금융",
  "거시경제",
  "미시경제",
  "경기",
  "경기침체",
  "리세션",
  "스태그플레이션",
  "디플레이션",
  "증시",
  "주식",
  "주식시장",
  "종목",
  "매수",
  "매도",
  "배당",
  "배당금",
  "실적발표",
  "어닝",
  "어닝서프라이즈",
  "밸류에이션",
  "시가총액",
  "per",
  "pbr",
  "roe",
  "eps",
  "코인",
  "암호화폐",
  "가상자산",
  "디지털자산",
  "알트코인",
  "스테이블코인",
  "비트",
  "비트코인",
  "리플",
  "xrp",
  "솔라나",
  "sol",
  "도지코인",
  "doge",
  "이더리움",
  "블록체인",
  "디파이",
  "defi",
  "nft",
  "온체인",
  "거래소",
  "금리",
  "기준금리",
  "미국금리",
  "국채금리",
  "채권금리",
  "연준",
  "fed",
  "파월",
  "환율",
  "달러",
  "원달러",
  "달러인덱스",
  "dxy",
  "엔화",
  "유로",
  "인플레이션",
  "물가",
  "물가상승",
  "pce",
  "ppi",
  "실업률",
  "고용",
  "비농업",
  "nfp",
  "gdp",
  "제조업지수",
  "pmi",
  "소비자심리",
  "소매판매",
  "cpi",
  "fomc",
  "ecb",
  "boj",
  "한국은행",
  "통화정책",
  "긴축",
  "완화",
  "나스닥",
  "코스피",
  "코스닥",
  "다우",
  "다우존스",
  "러셀",
  "니케이",
  "항셍",
  "s&p500",
  "s&p",
  "dow",
  "btc",
  "eth",
  "주가",
  "채권",
  "회사채",
  "국채",
  "채권시장",
  "원자재",
  "원유",
  "wti",
  "브렌트",
  "천연가스",
  "구리",
  "은값",
  "금값",
  "금리인상",
  "금리인하",
  "환헤지",
  "변동성",
  "vix",
  "리스크온",
  "리스크오프",
  "포트폴리오",
  "자산배분",
  "리밸런싱",
  "etf",
  "인덱스펀드",
  "뮤추얼펀드",
  "펀드",
  "헤지펀드",
  "사모펀드",
  "매크로",
  "실적",
  "가이던스",
  "경제지표"
];

function isEconomyMarketQuestion(question: string): boolean {
  const normalized = question.toLowerCase();
  return MARKET_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function extractText(data: OpenAIResponse): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks =
    data.output
      ?.flatMap((item) => item.content || [])
      ?.filter((c) => c.type === "output_text" || c.type === "text")
      ?.map((c) => c.text || "")
      ?.join("\n")
      ?.trim() || "";

  return chunks;
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const question = (body?.question || "").toString().trim();

    if (!question) {
      return NextResponse.json(
        { error: "질문을 입력해 주세요." },
        { status: 400 }
      );
    }

    if (question.length > 600) {
      return NextResponse.json(
        { error: "질문은 600자 이하로 입력해 주세요." },
        { status: 400 }
      );
    }

    if (!isEconomyMarketQuestion(question)) {
      return NextResponse.json(
        {
          error:
            "이 AI는 경제/시장 질문 전용입니다. 금리, 환율, 주식, 코인, 경제지표 관련 질문을 입력해 주세요."
        },
        { status: 400 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.3,
        max_output_tokens: 350,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "You are a Korean financial assistant. Provide concise, practical economic insight in Korean. " +
                  "Do not provide guaranteed investment returns. Clearly mark uncertainty."
              }
            ]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: question }]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `OpenAI API error: ${response.status}`, detail: errText },
        { status: 502 }
      );
    }

    const data = (await response.json()) as OpenAIResponse;
    const answer = extractText(data);

    if (!answer) {
      return NextResponse.json(
        { error: "AI 응답을 생성하지 못했습니다." },
        { status: 502 }
      );
    }

    return NextResponse.json({ answer });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI 요청 처리 중 오류가 발생했습니다."
      },
      { status: 500 }
    );
  }
}
