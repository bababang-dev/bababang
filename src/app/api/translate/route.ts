import { NextResponse } from "next/server";

function normalizeTargetLang(
  raw: string | undefined
): { label: string; instruction: string } | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (s === "ko" || s === "한국어" || s.includes("한국"))
    return { label: "한국어", instruction: "한국어" };
  if (s === "zh" || s === "중국어" || s.includes("중국") || s.includes("中文"))
    return { label: "중국어", instruction: "중국어(간체)" };
  return { label: s, instruction: s };
}

export async function POST(request: Request) {
  try {
    const { text, targetLang } = (await request.json()) as {
      text?: string;
      targetLang?: string;
    };
    if (!text || !String(text).trim()) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    const norm = normalizeTargetLang(targetLang);
    if (!norm) {
      return NextResponse.json({ error: "targetLang required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key missing" }, { status: 500 });
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content:
              "너는 번역기야. 입력 문장을 지시된 목표 언어로만 번역해. 번역문만 출력하고 다른 말은 하지 마.",
          },
          {
            role: "user",
            content: `다음을 ${norm.instruction}로 번역해:\n\n${text}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "translate failed" }, { status: res.status });
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const translation = (data.choices?.[0]?.message?.content ?? "").trim();
    const translated = translation;

    return NextResponse.json({ translation, translated });
  } catch {
    return NextResponse.json({ error: "translate error" }, { status: 500 });
  }
}
