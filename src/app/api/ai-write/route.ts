import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export async function POST(request: Request) {
  try {
    const { type, data } = (await request.json()) as {
      type?: string;
      data?: { title?: string; content?: string; name?: string; category?: string; extra?: string };
    };
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    let prompt = "";
    if (type === "post") {
      prompt =
        "아래 글을 자연스럽고 읽기 쉽게 다듬어줘. 원래 의미는 유지하고 맞춤법만 고치고 문장을 매끄럽게. 다듬은 글만 출력해. 마크다운 쓰지마.\n\n제목: " +
        String(data?.title ?? "") +
        "\n내용: " +
        String(data?.content ?? "");
    } else if (type === "description") {
      prompt =
        "아래 업체 정보로 매력적인 한줄 소개를 만들어줘. 20자 이내로. 한줄 소개만 출력해. 마크다운 쓰지마.\n\n업체명: " +
        String(data?.name ?? "") +
        "\n카테고리: " +
        String(data?.category ?? "") +
        "\n기타 정보: " +
        String(data?.extra ?? "");
    } else {
      return NextResponse.json({ error: "invalid type" }, { status: 400 });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const result = (await response.json()) as ChatCompletionResponse & { error?: { message?: string } };
    if (!response.ok) {
      const errMsg = result.error?.message ?? "OpenAI request failed";
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    const content = result.choices?.[0]?.message?.content?.trim() || "";
    if (!content) {
      return NextResponse.json({ error: "AI 응답이 비었어요" }, { status: 502 });
    }
    return NextResponse.json({ content });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
