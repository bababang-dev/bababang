import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { text?: string; lang?: string };
    const { text, lang = "ko" } = body;
    if (!text || !String(text).trim()) {
      return NextResponse.json({ error: "No text" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key missing" }, { status: 500 });
    }

    const voiceMap: Record<string, string> = {
      ko: "nova",
      zh: "nova",
      en: "nova",
      ja: "nova",
      es: "nova",
      fr: "nova",
      de: "nova",
      it: "nova",
      pt: "nova",
      ru: "nova",
      ar: "nova",
      hi: "nova",
      th: "nova",
      id: "nova",
      pl: "nova",
      ms: "nova",
      el: "nova",
      nl: "nova",
    };

    const voice = voiceMap[lang] || "nova";

    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: String(text).slice(0, 4096),
        voice,
        speed: 1.0,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "TTS failed" }, { status: 500 });
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
