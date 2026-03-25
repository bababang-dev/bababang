import { NextRequest, NextResponse } from "next/server";
import { logText } from "@/lib/textLogger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      text?: string;
      fromLang?: string;
      toLang?: string;
      userId?: number;
    };
    const { text, fromLang = "ko", toLang = "zh", userId } = body;
    if (!text || !String(text).trim()) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key missing" }, { status: 500 });
    }

    const langNames: Record<string, string> = {
      ko: "한국어",
      zh: "중국어",
      en: "영어",
      ja: "일본어",
      hi: "힌디어",
      es: "스페인어",
      ar: "아랍어",
      fr: "프랑스어",
      id: "인도네시아어",
      pt: "포르투갈어",
      ru: "러시아어",
      de: "독일어",
      it: "이탈리아어",
      th: "태국어",
      pl: "폴란드어",
      ms: "말레이시아어",
      el: "그리스어",
      nl: "네덜란드어",
    };

    const fromName = langNames[fromLang] || fromLang;
    const toName = langNames[toLang] || toLang;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              "당신은 전문 동시통역사입니다. " +
              fromName +
              "를 " +
              toName +
              "로 통역하세요. 규칙: 1. 번역 결과만 출력. 다른 말 하지마. 2. 구어체/슬랭도 자연스럽게 통역. 3. 문법 오류 있으면 자동 교정 후 통역. 4. 여러 언어가 섞여있으면 전체 맥락 이해해서 통역.",
          },
          { role: "user", content: String(text).trim() },
        ],
      }),
    });

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Interpret failed" },
        { status: res.status }
      );
    }

    const translated = data.choices?.[0]?.message?.content?.trim() || "";

    await logText({
      userId: typeof userId === "number" && userId > 0 ? userId : undefined,
      type: "interpret",
      inputText: String(text).trim(),
      outputText: translated,
      inputLang: fromLang,
      outputLang: toLang,
    });

    return NextResponse.json({ translated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
