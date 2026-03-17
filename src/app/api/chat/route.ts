import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `너는 BabaBang(아빠방) AI 어시스턴트야. 칭다오(青岛)에 거주하는 한국인 교민들을 위한 생활 도우미야.
주요 도움 분야: 맛집 추천, 비자/법률 정보, 부동산, 병원/의료, 교육/국제학교, 생활 팁, 중국어 번역.
항상 친절하고 실용적으로 답변해. 한국어로 답변하되, 중국어 지명이나 용어는 병기해줘.
예: 시난구(市南区), 팔대관(八大关)
답변은 간결하게, 핵심 위주로. 이모지를 적절히 사용해서 읽기 쉽게.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = body.messages as Array<{ role: string; content: string }> | undefined;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey === "여기에키넣을거임") {
      return NextResponse.json(
        { error: "DeepSeek API key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.map((m) => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
          })),
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("DeepSeek API error:", response.status, errText);
      return NextResponse.json(
        { error: "AI service error" },
        { status: response.status }
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content =
      data.choices?.[0]?.message?.content ?? "답변을 생성하지 못했어요.";

    return NextResponse.json({ content });
  } catch (e) {
    console.error("Chat API error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
