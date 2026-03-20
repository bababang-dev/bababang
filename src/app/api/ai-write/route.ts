import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { type, data } = await request.json();
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    let prompt = "";
    if (type === "post") {
      prompt =
        "아래 글을 자연스럽고 읽기 쉽게 다듬어줘. 원래 의미는 유지하고 맞춤법만 고치고 문장을 매끄럽게. 다듬은 글만 출력해.\n\n제목: " +
        String(data.title ?? "") +
        "\n내용: " +
        String(data.content ?? "");
    } else if (type === "description") {
      prompt =
        "아래 업체 정보로 매력적인 한줄 소개를 만들어줘. 20자 이내로. 한줄 소개만 출력해.\n\n업체명: " +
        String(data.name ?? "") +
        "\n카테고리: " +
        String(data.category ?? "") +
        "\n기타 정보: " +
        String(data.extra ?? "");
    } else {
      return NextResponse.json({ error: "invalid type" }, { status: 400 });
    }

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.7,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const raw = await response.text();
    console.log("[ai-write] DeepSeek status:", response.status, "body snippet:", raw.slice(0, 200));

    if (!response.ok) {
      let errMsg = raw;
      try {
        const j = JSON.parse(raw) as { error?: { message?: string } };
        errMsg = j.error?.message ?? raw;
      } catch {
        /* keep raw */
      }
      return NextResponse.json({ error: errMsg || "DeepSeek request failed" }, { status: 502 });
    }

    const result = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = result.choices?.[0]?.message?.content?.trim() || "";
    if (!content) {
      console.warn("[ai-write] empty content from DeepSeek", result);
      return NextResponse.json({ error: "AI 응답이 비었어요" }, { status: 502 });
    }
    return NextResponse.json({ content });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
