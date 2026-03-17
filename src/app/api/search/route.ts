import { NextResponse } from "next/server";

const NAVER_BASE = "https://openapi.naver.com/v1/search";
const DISPLAY = 5;

type NaverItem = {
  title?: string;
  link?: string;
  description?: string;
  bloggername?: string;
  cafename?: string;
};

async function fetchNaver(
  type: "blog" | "cafearticle" | "kin",
  query: string,
  clientId: string,
  clientSecret: string
): Promise<NaverItem[]> {
  const url = `${NAVER_BASE}/${type}.json?query=${encodeURIComponent(query)}&display=${DISPLAY}`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: NaverItem[] };
  return data.items ?? [];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();
  if (!query) {
    return NextResponse.json(
      { error: "query parameter is required" },
      { status: 400 }
    );
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Naver API credentials not configured" },
      { status: 500 }
    );
  }

  try {
    const [blog, cafe, kin] = await Promise.all([
      fetchNaver("blog", query, clientId, clientSecret),
      fetchNaver("cafearticle", query, clientId, clientSecret),
      fetchNaver("kin", query, clientId, clientSecret),
    ]);

    const result = {
      query,
      blog: blog.map((i) => ({ ...i, _source: "blog" as const })),
      cafe: cafe.map((i) => ({ ...i, _source: "cafe" as const })),
      kin: kin.map((i) => ({ ...i, _source: "kin" as const })),
      total:
        (blog.length || 0) + (cafe.length || 0) + (kin.length || 0),
    };

    return NextResponse.json(result);
  } catch (e) {
    console.error("Naver search error:", e);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
