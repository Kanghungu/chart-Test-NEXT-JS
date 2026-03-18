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

