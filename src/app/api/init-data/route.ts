import { NextResponse } from "next/server";

/**
 * GET: 기본 검색어 10개로 크롤링 실행 후 vectorStore에 저장.
 * 앱 시작 시 또는 수동으로 호출.
 */
export async function GET(request: Request) {
  const origin =
    request.headers.get("x-forwarded-proto") && request.headers.get("x-forwarded-host")
      ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("x-forwarded-host")}`
      : new URL(request.url).origin;

  try {
    const res = await fetch(`${origin}/api/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error ?? "Crawl failed" },
        { status: res.status }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Initial data loaded",
      ...data,
    });
  } catch (e) {
    console.error("Init-data error:", e);
    return NextResponse.json(
      { error: "Initial data load failed" },
      { status: 500 }
    );
  }
}
