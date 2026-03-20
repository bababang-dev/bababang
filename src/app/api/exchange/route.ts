import { NextResponse } from "next/server";

export async function GET() {
  try {
    // USD 기준으로 가져와서 계산 (가장 안정적)
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();

    const usdToKrw = data.rates?.KRW || 1380;
    const usdToCny = data.rates?.CNY || 7.25;

    // 1 CNY = ? KRW
    const cnyToKrw = Math.round(usdToKrw / usdToCny);
    // 1 USD = ? KRW
    const usdToKrwRounded = Math.round(usdToKrw);

    console.log("=== 환율: 1CNY=" + cnyToKrw + "KRW, 1USD=" + usdToKrwRounded + "KRW ===");

    return NextResponse.json({
      cnyToKrw: cnyToKrw,
      usdToKrw: usdToKrwRounded,
      cnyToUsd: (1 / usdToCny).toFixed(3),
    });
  } catch (e) {
    console.error("환율 에러:", e);
    return NextResponse.json({
      cnyToKrw: 190,
      usdToKrw: 1380,
      cnyToUsd: "0.138",
    });
  }
}
