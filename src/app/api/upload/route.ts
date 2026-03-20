import { NextResponse } from "next/server";
import { getOSSClient } from "@/lib/oss";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "파일이 없어요" }, { status: 400 });

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "10MB 이하만 업로드 가능해요" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "bin";
    const fileName = `uploads/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const client = getOSSClient();
    const result = await client.put(fileName, buffer, {
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });

    const bucket = process.env.OSS_BUCKET || "bababang-files";
    const region = process.env.OSS_REGION || "oss-cn-hongkong";
    const fallbackUrl = `https://${bucket}.${region}.aliyuncs.com/${fileName}`;
    const url = (result as { url?: string }).url || fallbackUrl;

    return NextResponse.json({ success: true, url, fileName });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("업로드 에러:", e);
    return NextResponse.json({ error: err.message ?? "Upload failed" }, { status: 500 });
  }
}
