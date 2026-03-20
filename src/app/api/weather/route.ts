import { NextResponse } from "next/server";

export async function GET() {
  try {
    // wttr.in 간단 포맷 사용
    const res = await fetch("https://wttr.in/Qingdao?format=%t|%f|%C|%h", {
      headers: { "User-Agent": "curl/7.0" },
      signal: AbortSignal.timeout(5000),
    });
    const text = await res.text();
    console.log("=== 날씨 원본: " + text + " ===");

    // 포맷: +15°C|+13°C|Sunny|45%
    const parts = text.split("|");
    const temp = parts[0]?.replace(/[^0-9-]/g, "") || "";
    const feelsLike = parts[1]?.replace(/[^0-9-]/g, "") || "";
    const condition = parts[2]?.trim() || "";
    const humidity = parts[3]?.replace(/[^0-9]/g, "") || "";

    return NextResponse.json({ temp, feelsLike, condition, humidity });
  } catch (e) {
    console.error("날씨 에러:", e);
    return NextResponse.json({ temp: "", feelsLike: "", condition: "", humidity: "" });
  }
}
