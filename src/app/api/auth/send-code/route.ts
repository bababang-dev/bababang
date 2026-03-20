import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { phone } = (await request.json()) as { phone?: string };
    if (!phone) return NextResponse.json({ error: "폰번호를 입력해주세요" }, { status: 400 });

    console.log("=== SMS 인증코드: " + phone + " → 123456 ===");

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
