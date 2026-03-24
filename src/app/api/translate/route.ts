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
    const { text, targetLang, mixedMode } = (await request.json()) as {
      text?: string;
      targetLang?: string;
      mixedMode?: boolean;
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

    const useKoZhInterpreter = norm.label === "한국어" || norm.label === "중국어";

    if (!useKoZhInterpreter) {
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
      return NextResponse.json({
        translation,
        translated: translation,
        corrected: String(text).trim(),
        wasChanged: false,
      });
    }

    const targetLangLabel = norm.label;
    const mixedModeOn = Boolean(mixedMode);
    const systemPrompt = mixedModeOn
      ? `당신은 한국어-중국어 전문 통역사입니다.

규칙:
1. 입력 텍스트가 음성인식 결과라서 부정확할 수 있습니다.
2. 한국어, 중국어, 또는 혼합 텍스트가 올 수 있습니다.
3. 음성인식 오류를 자연스럽게 교정하세요.
4. ${targetLangLabel}로 자연스럽게 번역하세요.
5. JSON으로만 응답: {"corrected": "교정된 원문", "translated": "번역결과"}
6. 다른 설명 하지 마세요.`
      : `당신은 전문 통역사입니다. 아래 규칙을 따르세요:

1. 한국어와 중국어가 섞여 있으면 전체 맥락을 이해해서 자연스러운 ${targetLangLabel}로 번역하세요.
2. 문법 오류, 불완전한 문장, 말 더듬기가 있으면 의미를 파악해서 완성된 문장으로 번역하세요.
3. 구어체/슬랭도 자연스럽게 번역하세요.
4. 사용자가 JSON 형식을 요청하면 corrected(교정된 원문)와 translated(번역문)만 JSON 객체로 출력하세요. 다른 설명은 하지 마세요.

예시:
"이거 多少钱이에요?" → "这个多少钱？"
"저기 그 뭐시기 양꼬치집" → "那家羊肉串店"
"내일 모레 그 什么时候 간다고 했지" → "说是后天什么时候去来着"`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 800,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              "다음 텍스트를 번역해주세요. JSON으로만 응답하세요:\n" +
              '{"corrected": "교정된 원문 (교정 필요없으면 원문 그대로)", "translated": "번역 결과"}\n\n' +
              "원문: " +
              String(text).trim() +
              "\n번역 대상: " +
              targetLangLabel,
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
    const content = (data.choices?.[0]?.message?.content ?? "").trim();
    const rawText = String(text).trim();

    let result: { corrected: string; translated: string };
    try {
      const cleaned = content.replace(/```json|```/g, "").trim();
      result = JSON.parse(cleaned) as { corrected: string; translated: string };
      if (typeof result.corrected !== "string") result.corrected = rawText;
      if (typeof result.translated !== "string") result.translated = content;
    } catch {
      result = { corrected: rawText, translated: content };
    }

    const translation = result.translated.trim();
    const corrected = result.corrected.trim();

    return NextResponse.json({
      translation,
      translated: translation,
      corrected,
      wasChanged: corrected !== rawText,
    });
  } catch {
    return NextResponse.json({ error: "translate error" }, { status: 500 });
  }
}
