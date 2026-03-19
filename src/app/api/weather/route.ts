import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://wttr.in/Qingdao?format=j1");
    const data = (await res.json()) as {
      current_condition?: Array<{
        temp_C?: string;
        FeelsLikeC?: string;
        weatherDesc?: Array<{ value?: string }>;
        humidity?: string;
      }>;
    };
    const current = data.current_condition?.[0];
    return NextResponse.json({
      temp: current?.temp_C ?? "",
      feelsLike: current?.FeelsLikeC ?? "",
      condition: current?.weatherDesc?.[0]?.value ?? "",
      humidity: current?.humidity ?? "",
    });
  } catch {
    return NextResponse.json(
      { temp: "", feelsLike: "", condition: "", humidity: "" },
      { status: 500 }
    );
  }
}
