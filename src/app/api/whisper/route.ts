import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio") as Blob | File | null;
    const langRaw = formData.get("lang");
    const lang = typeof langRaw === "string" ? langRaw : "";

    if (!audio || typeof (audio as Blob).arrayBuffer !== "function") {
      return NextResponse.json({ error: "No audio" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key missing" }, { status: 500 });
    }

    const whisperForm = new FormData();
    whisperForm.append("file", audio, "audio.webm");
    whisperForm.append("model", "whisper-1");
    if (lang.trim()) whisperForm.append("language", lang.trim());

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey },
      body: whisperForm,
    });

    const data = (await res.json()) as { text?: string; error?: { message?: string } };
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Whisper failed" },
        { status: res.status }
      );
    }

    return NextResponse.json({ text: data.text || "" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
