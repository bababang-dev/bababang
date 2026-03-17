import { NextResponse } from "next/server";
import { stripHtml, addDocuments } from "@/lib/vectorStore";

const DEFAULT_KEYWORDS = [
  "칭다오 한인 맛집",
  "칭다오 비자 정보",
  "칭다오 부동산 렌트",
  "칭다오 국제학교",
  "칭다오 병원 한국어",
  "칭다오 생활 팁",
  "칭다오 한인 커뮤니티",
  "청도 여행 추천",
  "칭다오 중국어 학원",
  "칭다오 배달 앱",
];

type NaverItem = {
  title?: string;
  link?: string;
  description?: string;
  _source?: string;
};

export async function POST(request: Request) {
  let keywords = DEFAULT_KEYWORDS;
  try {
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body.keywords) && body.keywords.length > 0) {
      keywords = body.keywords.map((k: unknown) => String(k).trim()).filter(Boolean);
    }
  } catch {
    // use default
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Naver API credentials not configured" },
      { status: 500 }
    );
  }

  const documents: Array<{ text: string; source: string; category?: string; date?: string }> = [];
  const display = 5;

  for (const keyword of keywords) {
    try {
      const [blogRes, cafeRes, kinRes] = await Promise.all([
        fetch(
          `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=${display}`,
          {
            headers: {
              "X-Naver-Client-Id": clientId,
              "X-Naver-Client-Secret": clientSecret,
            },
          }
        ),
        fetch(
          `https://openapi.naver.com/v1/search/cafearticle.json?query=${encodeURIComponent(keyword)}&display=${display}`,
          {
            headers: {
              "X-Naver-Client-Id": clientId,
              "X-Naver-Client-Secret": clientSecret,
            },
          }
        ),
        fetch(
          `https://openapi.naver.com/v1/search/kin.json?query=${encodeURIComponent(keyword)}&display=${display}`,
          {
            headers: {
              "X-Naver-Client-Id": clientId,
              "X-Naver-Client-Secret": clientSecret,
            },
          }
        ),
      ]);

      const toItems = async (res: Response) => {
        if (!res.ok) return [];
        const data = (await res.json()) as { items?: NaverItem[] };
        return data.items ?? [];
      };

      const [blog, cafe, kin] = await Promise.all([
        toItems(blogRes),
        toItems(cafeRes),
        toItems(kinRes),
      ]);

      const pushDoc = (
        item: NaverItem,
        sourceLabel: string
      ) => {
        const title = stripHtml(item.title ?? "");
        const desc = stripHtml(item.description ?? "");
        const text = [title, desc].filter(Boolean).join(" ");
        if (text.length > 0) {
          documents.push({
            text,
            source: item.link ?? sourceLabel,
            category: keyword,
            date: new Date().toISOString().slice(0, 10),
          });
        }
      };

      blog.forEach((i) => pushDoc(i, "blog"));
      cafe.forEach((i) => pushDoc(i, "cafe"));
      kin.forEach((i) => pushDoc(i, "kin"));
    } catch (e) {
      console.error("Crawl keyword error:", keyword, e);
    }
  }

  const added = addDocuments(documents);

  return NextResponse.json({
    success: true,
    keywords: keywords.length,
    documents: documents.length,
    chunksAdded: added,
  });
}
