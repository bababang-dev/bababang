import { NextResponse } from "next/server";

type VisionChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

type ImagesResponse = {
  data?: Array<{ url?: string }>;
};

export async function POST(request: Request) {
  try {
    const { photoUrl } = (await request.json()) as { photoUrl?: string };
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    let dallePrompt = "";

    if (photoUrl) {
      const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 200,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Describe this person's appearance in detail for creating a cartoon avatar. Include: hair style, hair color, face shape, eye shape, skin tone, notable features, glasses if any, expression. Be specific. English only. Description only, no other text.",
                },
                {
                  type: "image_url",
                  image_url: { url: photoUrl },
                },
              ],
            },
          ],
        }),
      });

      if (!visionRes.ok) {
        const err = await visionRes.text();
        console.error("Vision API error:", err);
        return NextResponse.json({ error: "얼굴 분석에 실패했어요" }, { status: 500 });
      }

      const visionData = (await visionRes.json()) as VisionChatResponse;
      const description = visionData.choices?.[0]?.message?.content || "";
      console.log("=== 얼굴 분석: " + description.slice(0, 100) + " ===");

      dallePrompt =
        "Create a Disney Pixar style 3D animated character portrait based on this person: " +
        description +
        ". Style: exactly like a Disney Pixar movie character (like characters from Coco, Inside Out, Up). Round friendly face, big expressive eyes, smooth 3D render, soft studio lighting. Close-up portrait shot, shoulders up only, simple gradient background. The image should be square and work perfectly as a circular profile picture. Make the character clearly resemble the described person but in adorable Pixar style.";
    } else {
      const styles = [
        "a friendly young Korean man with neat short hair, wearing a casual polo shirt, warm smile",
        "a cheerful young Korean woman with shoulder-length hair, wearing a cute cardigan, bright eyes",
        "a cool Korean guy with styled hair and round glasses, wearing a hoodie, confident smile",
        "a sweet Korean girl with long straight hair and bangs, wearing a turtleneck, gentle expression",
        "a fun Korean person with wavy hair, wearing a denim jacket, playful grin",
      ];
      const randomStyle = styles[Math.floor(Math.random() * styles.length)];
      dallePrompt =
        "Create a Disney Pixar style 3D animated character portrait of " +
        randomStyle +
        ". Style: exactly like a Disney Pixar movie character. Round friendly face, big expressive eyes, smooth 3D render, soft studio lighting. Close-up portrait shot, shoulders up only, simple pastel gradient background. Square image, perfect for circular profile picture crop. Adorable and unique.";
    }

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: dallePrompt,
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

    const data = (await response.json()) as ImagesResponse;
    const imageUrl = data.data?.[0]?.url;

    if (!imageUrl) {
      return NextResponse.json({ error: "이미지를 생성하지 못했어요" }, { status: 500 });
    }

    try {
      const imgRes = await fetch(imageUrl);
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
      const { getOSSClient } = await import("@/lib/oss");
      const client = getOSSClient();
      const fileName =
        "avatars/" + Date.now() + "_" + Math.random().toString(36).slice(2) + ".png";
      await client.put(fileName, imgBuffer, { headers: { "Content-Type": "image/png" } });
      const ossUrl =
        "https://" +
        (process.env.OSS_BUCKET || "bababang-files") +
        "." +
        (process.env.OSS_REGION || "oss-cn-hongkong") +
        ".aliyuncs.com/" +
        fileName;
      return NextResponse.json({ success: true, url: ossUrl });
    } catch {
      return NextResponse.json({ success: true, url: imageUrl });
    }
  } catch (e: unknown) {
    console.error("AI avatar error:", e);
    const message = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
