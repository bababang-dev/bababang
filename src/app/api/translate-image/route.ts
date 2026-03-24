import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      image?: string;
      mode?: "translate" | "menu" | "document";
    };
    const { image, mode = "translate" } = body;
    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "image required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    const systemPrompt =
      mode === "menu"
        ? "이 메뉴판 사진을 번역해줘. 각 메뉴를 이 형식으로: 중국어원문 → 한국어번역 (간단한 설명) 가격. 깔끔하게 정리해줘."
        : "이 사진에 있는 중국어 텍스트를 모두 찾아서 한국어로 번역해줘. 원문과 번역을 같이 보여줘. 맥락에 맞게 자연스럽게 번역해줘.";

    const imageUrl = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1000,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "이 이미지를 보고 위 지시에 따라 번역해줘." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message || "OpenAI error" },
        { status: res.status }
      );
    }
    const translation =
      data.choices?.[0]?.message?.content?.trim() || "번역에 실패했어요.";

    try {
      const pool = (await import("@/lib/db")).default;
      await pool.query(
        `INSERT INTO review_cache (shop_name, review_text, reviewer, rating, review_date, source, source_url, language, search_keyword) VALUES (?, ?, NULL, NULL, NULL, 'user', NULL, 'ko', ?)`,
        ["사진번역", translation.slice(0, 2000), "사진번역"]
      );
    } catch {
      /* ignore DB */
    }

    return NextResponse.json({ translation });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
