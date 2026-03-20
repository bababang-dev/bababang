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
        "Create a Studio Ghibli and Disney inspired cartoon avatar character based on this person's appearance: " +
        description +
        ". Style: warm Ghibli watercolor meets Disney Pixar 3D charm, soft lighting, gentle expression, simple pastel background, profile picture suitable, circular crop friendly. The character should clearly resemble the described person but in a cute animated style.";
    } else {
      const styles = [
        "a friendly young man with messy hair and warm smile, wearing a cozy sweater",
        "a cheerful young woman with long flowing hair and bright eyes, wearing a cute beret",
        "a cool guy with short hair and glasses, wearing a casual hoodie",
        "a sweet girl with bob cut hair and freckles, wearing a scarf",
        "a playful young person with curly hair and dimples, wearing overalls",
      ];
      const randomStyle = styles[Math.floor(Math.random() * styles.length)];
      dallePrompt =
        "Create a Studio Ghibli and Disney inspired cartoon avatar of " +
        randomStyle +
        ". Style: warm Ghibli watercolor texture meets Disney Pixar 3D charm, soft golden lighting, gentle happy expression, simple dreamy pastel background, profile picture suitable, circular crop friendly. Make it adorable and unique.";
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
