import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { text, targetLang } = (await request.json()) as {
      text?: string;
      targetLang?: "ko" | "zh";
    };
    if (!text || !targetLang) {
      return NextResponse.json({ error: "text and targetLang required" }, { status: 400 });
    }
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key missing" }, { status: 500 });
    }
    const target = targetLang === "ko" ? "한국어" : "중국어";
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "너는 번역기야. 입력된 텍스트를 지정된 언어로 번역해. 번역만 출력해. 다른 말 하지마.",
          },
          { role: "user", content: `다음을 ${target}로 번역해: ${text}` },
        ],
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "translate failed" }, { status: res.status });
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return NextResponse.json({ translated: data.choices?.[0]?.message?.content ?? "" });
  } catch {
    return NextResponse.json({ error: "translate error" }, { status: 500 });
  }
}
