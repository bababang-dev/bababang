import { NextResponse } from "next/server";
import { getOSSClient } from "@/lib/oss";

export async function POST(request: Request) {
  try {
    const { description } = (await request.json()) as { description?: string };
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    const prompt = description
      ? "Create a cute cartoon avatar character based on this description: " +
        description +
        ". Style: Pixar-like 3D cartoon, friendly face, simple background, profile picture suitable, circular crop friendly."
      : "Create a cute random cartoon avatar character. Style: Pixar-like 3D cartoon, friendly face, colorful, simple background, profile picture suitable, circular crop friendly. Make it unique and fun.";

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DALL-E error:", err);
      return NextResponse.json({ error: "이미지 생성에 실패했어요" }, { status: 500 });
    }

    const data = (await response.json()) as { data?: Array<{ url?: string }> };
    const imageUrl = data.data?.[0]?.url;

    if (!imageUrl) {
      return NextResponse.json({ error: "이미지를 생성하지 못했어요" }, { status: 500 });
    }

    try {
      const imgRes = await fetch(imageUrl);
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

      const client = getOSSClient();
      const fileName =
        "avatars/" + Date.now() + "_" + Math.random().toString(36).slice(2) + ".png";
      await client.put(fileName, imgBuffer, {
        headers: { "Content-Type": "image/png" },
      });

      const ossUrl =
        "https://" +
        (process.env.OSS_BUCKET || "bababang-files") +
        "." +
        (process.env.OSS_REGION || "oss-cn-hongkong") +
        ".aliyuncs.com/" +
        fileName;

      return NextResponse.json({ success: true, url: ossUrl });
    } catch (ossErr) {
      console.error("OSS upload failed, returning temporary URL:", ossErr);
      return NextResponse.json({ success: true, url: imageUrl });
    }
  } catch (e: unknown) {
    console.error("AI avatar error:", e);
    const message = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
