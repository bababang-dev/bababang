import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/CNY");
    const data = (await res.json()) as {
      rates?: Record<string, number>;
    };
    const cnyToKrw = data.rates?.KRW ?? 0;
    const cnyToUsd = data.rates?.USD ?? 0;
    const usdToKrw = cnyToUsd > 0 ? cnyToKrw / cnyToUsd : 0;
    return NextResponse.json({ cnyToKrw, cnyToUsd, usdToKrw });
  } catch {
    return NextResponse.json(
      { cnyToKrw: 0, cnyToUsd: 0, usdToKrw: 0 },
      { status: 500 }
    );
  }
}
