import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { findShop } from "@/lib/shopDict";
import { findCategories } from "@/lib/categoryDict";

type ChatDbPostRow = RowDataPacket & {
  title: string;
  content?: string | null;
  category?: string;
  tags?: string | null;
};

type ChatDbPromoRow = RowDataPacket & {
  business_name: string;
  business_name_zh?: string | null;
  category?: string;
  address?: string | null;
  phone?: string | null;
  description?: string | null;
  template_data?: unknown;
  tags?: string | null;
};

function stripHtml(str: string): string {
  return (str ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\n{3,}/g, "\n\n").trim();
}

// ═══ 차이나조아 크롤링 ═══
async function crawlChinazoa(query: string): Promise<string[]> {
  const results: string[] = [];
  try {
    // 카테고리 매핑
    const categoryMap: Record<string, string[]> = {
      "맛집": ["cate_id=1", "model_id=55"],
      "식당": ["cate_id=1"],
      "카페": ["cate_id=1"],
      "병원": ["cate_id=38"],
      "의료": ["cate_id=38"],
      "미용": ["cate_id=38"],
      "학교": ["cate_id=77"],
      "학원": ["cate_id=77"],
      "부동산": ["cate_id=67", "model_id=14"],
      "마트": ["cate_id=29"],
      "쇼핑": ["cate_id=29"],
      "물류": ["cate_id=94"],
      "여행": ["cate_id=53"],
      "숙박": ["cate_id=53"],
      "구인": ["model_id=12"],
      "구직": ["model_id=12"],
    };

    let urls: string[] = [];
    for (const [keyword, params] of Object.entries(categoryMap)) {
      if (query.includes(keyword)) {
        params.forEach((p) => {
          if (p.startsWith("cate_id")) {
            urls.push(`https://chinazoa.net/plugin.php?id=tom_tcpc&site=1&mod=shoplist&${p}`);
          } else {
            urls.push(`https://chinazoa.net/plugin.php?id=tom_tcpc&site=1&mod=list&${p}`);
          }
        });
        break;
      }
    }
    // 기본: 식당 + 커뮤니티
    if (urls.length === 0) {
      urls = [
        "https://chinazoa.net/plugin.php?id=tom_tcpc&site=1&mod=shoplist&cate_id=1",
        "https://chinazoa.net/plugin.php?id=tom_tcpc&site=1&mod=list&model_id=20",
      ];
    }

    // 동시 크롤링
    const pages = await Promise.all(
      urls.map(async (url) => {
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" },
            signal: AbortSignal.timeout(5000),
          });
          return await res.text();
        } catch {
          return "";
        }
      })
    );

    pages.forEach((html) => {
      if (!html) return;
      const text = stripHtml(html);
      // 의미있는 텍스트 청크 추출
      const lines = text.split("\n").filter((l) => l.trim().length > 10 && l.trim().length < 200);
      results.push(...lines.slice(0, 30));
    });

    console.log("=== 차이나조아 결과: " + results.length + "개 라인 ===");
  } catch (e) {
    console.log("=== 차이나조아 에러 ===", e);
  }
  return results.slice(0, 60);
}

// ═══ 高德地图 검색 ═══
async function amapSearch(keywords: string, city: string = "青岛"): Promise<Array<{ name: string; address: string; tel: string; rating: string; cost: string; type: string; location: string }>> {
  try {
    const key = process.env.AMAP_API_KEY;
    if (!key) return [];
    const url = `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(keywords)}&city=${encodeURIComponent(city)}&output=json&key=${key}&offset=30&extensions=all`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as {
      pois?: Array<{
        name?: string;
        address?: string;
        tel?: string;
        location?: string;
        biz_ext?: { rating?: string; cost?: string };
        type?: string;
      }>;
    };
    console.log("=== 高德 [" + keywords + "]: " + (data.pois?.length || 0) + "개 ===");
    return (data.pois || []).map((poi) => ({
      name: poi.name ?? "",
      address: poi.address ?? "",
      tel: poi.tel ?? "",
      rating: poi.biz_ext?.rating ?? "",
      cost: poi.biz_ext?.cost ?? "",
      type: poi.type ?? "",
      location: poi.location ?? "",
    }));
  } catch {
    return [];
  }
}

// ═══ 네이버 검색 ═══
async function naverSearch(
  type: string,
  query: string,
  display: number,
  start: number,
  sort: string
): Promise<Array<{ title?: string; description?: string; link?: string }>> {
  try {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;
    if (!clientId || !clientSecret) return [];
    const url = `https://openapi.naver.com/v1/search/${type}.json?query=${encodeURIComponent(query)}&display=${display}&start=${start}&sort=${sort}`;
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { items?: Array<{ title?: string; description?: string; link?: string }> };
    return data.items || [];
  } catch {
    return [];
  }
}

// ═══ 블로그 원문 크롤링 ═══
async function fetchBlogContent(url: string): Promise<string> {
  try {
    const mobileUrl = url.replace("blog.naver.com", "m.blog.naver.com");
    const res = await fetch(mobileUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" },
      signal: AbortSignal.timeout(3000),
    });
    const html = await res.text();
    const content = stripHtml(html);
    return content.length > 150 ? content.slice(0, 1200) : "";
  } catch {
    return "";
  }
}

type NaverItem = { title: string; desc: string; source: string; link: string };
type AmapPoi = {
  name: string;
  address: string;
  tel: string;
  rating: string;
  cost: string;
  type: string;
  location: string;
};

function poiToRecommendedPayload(poi: AmapPoi) {
  const parts = poi.location ? poi.location.split(",").map((s) => s.trim()) : [];
  return {
    name: poi.name,
    address: poi.address,
    tel: poi.tel,
    rating: poi.rating,
    cost: poi.cost,
    lat: parts[1] ?? "",
    lng: parts[0] ?? "",
  };
}

function analyzeCollectedData(
  amapPois: AmapPoi[],
  naverItems: NaverItem[],
  chinazoaData: string[],
  blogContents: string[]
): string {
  const excludeWords = new Set([
    "칭다오", "청도", "중국", "한국", "맛집", "추천", "여행", "후기", "정보", "방문", "소개", "블로그", "카페", "사진", "메뉴", "가격", "위치", "주소", "영업", "시간", "분위기", "예약", "웨이팅", "서비스", "요리", "음식", "식당", "정말", "진짜", "완전", "엄청", "대박", "너무", "그냥", "미식", "아주",
  ]);

  const wordCount = new Map<string, { count: number; sources: Set<string>; contexts: string[] }>();

  naverItems.forEach((item) => {
    const text = item.title + " " + item.desc;
    const words = text.match(/[가-힣]{2,8}/g) || [];
    const seen = new Set<string>();
    words.forEach((word) => {
      if (excludeWords.has(word) || word.length < 2 || seen.has(word)) return;
      seen.add(word);
      if (!wordCount.has(word)) wordCount.set(word, { count: 0, sources: new Set(), contexts: [] });
      const e = wordCount.get(word)!;
      e.count++;
      e.sources.add(item.source);
      if (e.contexts.length < 2) {
        const idx = text.indexOf(word);
        e.contexts.push(text.slice(Math.max(0, idx - 30), Math.min(text.length, idx + word.length + 50)));
      }
    });
  });

  const topMentions = Array.from(wordCount.entries())
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20);

  let report = "";

  if (topMentions.length > 0) {
    report += "[여러 글에서 자주 언급된 키워드 - 많이 언급될수록 신뢰도 높음]\n";
    topMentions.forEach(([word, data]) => {
      report += `"${word}": ${data.count}회 언급 (${Array.from(data.sources).join("+")})\n`;
      if (data.contexts[0]) report += `  → ${data.contexts[0].slice(0, 80)}\n`;
    });
    report += "\n";
  }

  if (amapPois.length > 0) {
    report += "[高德地图 공식 정보 - 주소/전화/평점 정확]\n";
    amapPois.slice(0, 10).forEach((poi, i) => {
      report += `[P${i + 1}] ${poi.name} | 주소: ${poi.address} | 평점: ${poi.rating || "없음"}/5 | 전화: ${poi.tel || "없음"} | 1인당: ${poi.cost ? poi.cost + "위안" : "없음"}\n`;
    });
    report += "\n";
  }

  if (blogContents.length > 0) {
    report += "[상세 후기 핵심 요약]\n";
    blogContents.forEach((content) => {
      report += content.slice(0, 300) + "\n---\n";
    });
    report += "\n";
  }

  if (chinazoaData.length > 0) {
    report += "[칭다오 한인 커뮤니티 업체 정보]\n";
    chinazoaData.slice(0, 10).forEach((line) => {
      report += line + "\n";
    });
  }

  return report;
}

/** 커뮤니티 게시글 + 업체 홍보(DB) — 네이버/高德/차이나조아와 함께 참고자료로 사용 */
async function fetchBababangDbContext(userMessage: string): Promise<string[]> {
  const communityData: string[] = [];
  try {
    const pool = (await import("@/lib/db")).default;

    const keywords = userMessage
      .replace(/[?？ 를을에서의로]/g, " ")
      .split(" ")
      .filter((w: string) => w.length >= 2)
      .slice(0, 3);

    if (keywords.length > 0) {
      const likeConditions = keywords.map(() => "(title LIKE ? OR content LIKE ? OR tags LIKE ?)").join(" OR ");
      const likeParams = keywords.flatMap((k: string) => [`%${k}%`, `%${k}%`, `%${k}%`]);

      const [posts] = (await pool.query(
        `SELECT title, content, category, tags, created_at FROM posts WHERE ${likeConditions} ORDER BY created_at DESC LIMIT 5`,
        likeParams
      )) as [ChatDbPostRow[], unknown];

      if (Array.isArray(posts) && posts.length > 0) {
        communityData.push(
          ...posts.map(
            (p: { title: string; content?: string | null }) =>
              `[커뮤니티] ${p.title}: ${stripHtml(p.content || "").slice(0, 200)}`
          )
        );
      }
    }

    const [promotions] = (await pool.query(
      `SELECT business_name, business_name_zh, category, address, phone, description, template_data, tags 
       FROM promotions WHERE status = 'active' ORDER BY created_at DESC LIMIT 10`
    )) as [ChatDbPromoRow[], unknown];

    if (Array.isArray(promotions) && promotions.length > 0) {
      const relevantPromos = promotions.filter((p: Record<string, unknown>) => {
        const allText = [p.business_name, p.business_name_zh, p.description, p.category, p.tags, p.address]
          .filter(Boolean)
          .join(" ");
        return keywords.some((k: string) => allText.includes(k));
      });

      const promosToUse = relevantPromos.length > 0 ? relevantPromos : promotions.slice(0, 3);

      promosToUse.forEach((p: Record<string, unknown>) => {
        let info = `[등록업체] ${p.business_name}`;
        if (p.business_name_zh) info += ` (${p.business_name_zh})`;
        if (p.address) info += ` | 주소: ${p.address}`;
        if (p.phone) info += ` | 전화: ${p.phone}`;
        if (p.description) info += ` | ${p.description}`;
        if (p.template_data) {
          try {
            const td = typeof p.template_data === "string" ? JSON.parse(p.template_data as string) : p.template_data;
            const details = Object.entries(td as Record<string, unknown>)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ");
            if (details) info += ` | ${details}`;
          } catch {
            /* ignore */
          }
        }
        communityData.push(info);
      });
    }

    console.log("=== DB 데이터: 게시글+" + "업체 " + communityData.length + "개 ===");
  } catch (e) {
    console.log("=== DB 조회 실패 ===", e);
  }
  return communityData;
}

export async function POST(request: Request) {
  let body: { messages?: unknown; localShops?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = body.messages as Array<{ role: string; content: string }>;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        send({ type: "status", content: "정보를 수집하고 있어요..." });

        const userMessage = messages[messages.length - 1]?.content || "";
        const searchQuery = "칭다오 " + userMessage.slice(0, 30).trim();
        const sortType = Math.random() > 0.5 ? "sim" : "date";
        const startPos = Math.floor(Math.random() * 5) + 1;

        const detectedShop = findShop(userMessage);
        if (detectedShop) {
          console.log("=== 가게 감지: " + detectedShop.koreanNames[0] + " → " + detectedShop.zh + " ===");
        }

        const amapKeywordsFromDict = findCategories(userMessage);

        let amapKeywords: string[];
        if (detectedShop) {
          amapKeywords = [detectedShop.zh];
        } else if (amapKeywordsFromDict.length > 0) {
          amapKeywords = amapKeywordsFromDict;
        } else {
          amapKeywords = ["美食"];
        }

        const [chinazoaData, bababangDbLines, ...amapAndNaverResults] = await Promise.all([
          crawlChinazoa(userMessage),
          fetchBababangDbContext(userMessage),
          ...amapKeywords.map((kw) => amapSearch(kw)),
          naverSearch("blog", searchQuery, 15, startPos, sortType),
          naverSearch("blog", searchQuery, 15, 11, sortType === "sim" ? "date" : "sim"),
          naverSearch("cafearticle", searchQuery + " 중정공", 10, 1, "sim"),
          naverSearch("cafearticle", searchQuery, 5, 1, "sim"),
          naverSearch("kin", searchQuery, 5, 1, "sim"),
        ]);

        const amapCount = amapKeywords.length;
        const allAmapPois = (amapAndNaverResults.slice(0, amapCount) as Array<Array<AmapPoi>>).flat();
        const uniquePois = allAmapPois.filter(
          (poi, idx, arr) => arr.findIndex((p) => p.name === poi.name) === idx
        );

        const naverResults = amapAndNaverResults.slice(amapCount) as Array<Array<{ title?: string; description?: string; link?: string }>>;
        const [blog1, blog2, cafeZh, cafe1, kin1] = naverResults;
        const allNaverItems = [
          ...(blog1 || []).map((i) => ({ title: stripHtml(i.title ?? ""), desc: stripHtml(i.description ?? ""), source: "블로그", link: i.link ?? "" })),
          ...(blog2 || []).map((i) => ({ title: stripHtml(i.title ?? ""), desc: stripHtml(i.description ?? ""), source: "블로그", link: i.link ?? "" })),
          ...(cafeZh || []).map((i) => ({ title: stripHtml(i.title ?? ""), desc: stripHtml(i.description ?? ""), source: "카페", link: i.link ?? "" })),
          ...(cafe1 || []).map((i) => ({ title: stripHtml(i.title ?? ""), desc: stripHtml(i.description ?? ""), source: "카페", link: i.link ?? "" })),
          ...(kin1 || []).map((i) => ({ title: stripHtml(i.title ?? ""), desc: stripHtml(i.description ?? ""), source: "지식인", link: i.link ?? "" })),
        ].filter((item, idx, arr) => arr.findIndex((a) => a.link === item.link) === idx);

        const topBlogs = allNaverItems.filter((i) => i.source === "블로그").slice(0, 3);
        const blogContents = await Promise.all(
          topBlogs.map(async (item) => {
            const full = await fetchBlogContent(item.link);
            return full ? `${item.title}\n${full}` : `${item.title}: ${item.desc}`;
          })
        );

        const totalSources =
          chinazoaData.length + uniquePois.length + allNaverItems.length + bababangDbLines.length;
        console.log(
          `=== 총 수집: 차이나조아 ${chinazoaData.length} + 高德 ${uniquePois.length} + 네이버 ${allNaverItems.length} + BabaBangDB ${bababangDbLines.length} = ${totalSources}개 ===`
        );

        const analysisReport = analyzeCollectedData(uniquePois, allNaverItems, chinazoaData, blogContents);
        let searchContext = analysisReport.slice(0, 2000);
        if (bababangDbLines.length > 0) {
          searchContext += "\n\n=== BabaBang 유저 등록 정보 (가장 신뢰도 높음) ===\n";
          searchContext += bababangDbLines.join("\n");
        }
        console.log("=== 분석 보고서 길이: " + searchContext.length + "자 ===");

        const locationContext = "";
        const shopContext = detectedShop
          ? "\n유저가 찾는 가게: " +
            detectedShop.koreanNames[0] +
            " = " +
            detectedShop.zh +
            " (" +
            (detectedShop.description ?? "") +
            ", " +
            detectedShop.district +
            " 지역)\n"
          : "";

        send({ type: "status", content: `${totalSources}개 소스에서 분석 완료! 답변 생성중...` });

        let userInterestsLine = "";
        try {
          const pool = (await import("@/lib/db")).default;
          const [prefRows] = await pool.query(
            `SELECT category, COUNT(*) as cnt FROM user_activity WHERE user_id = ? AND category IS NOT NULL AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY category ORDER BY cnt DESC LIMIT 3`,
            [1]
          );
          const rows = prefRows as Array<{ category: string }>;
          if (Array.isArray(rows) && rows.length > 0) {
            userInterestsLine =
              "\n\n이 유저는 " +
              rows.map((p) => p.category).join(", ") +
              " 에 관심이 많아. 가능하면 이 분야와 연관된 정보를 우선 알려줘.";
          }
        } catch (e) {
          console.error("user_activity prefs:", e);
        }

        const systemPrompt = `너는 BabaBang(아빠방) AI야. 칭다오에 사는 한국인들을 도와주는 친근한 생활 도우미.

말투:
- 친한 형이나 누나가 카톡으로 알려주듯이 편하게
- 반말 아니고 존댓말이지만 딱딱하지 않게

포맷 규칙 (매우 중요):
- 마크다운 문법 절대 금지. ** ## 백틱 쓰지마
- 줄바꿈을 많이 넣어. 한 문장 쓰고 줄바꿈.
- 가게 하나 소개하고 줄바꿈 두 번.
- 번호 매길 때 "1." "2." 이렇게
- 가게 정보는 이런 식으로:

1. 가게이름 (中文名)
주소: xxx
추천메뉴: xxx
가격대: 1인당 xx위안
한줄평: xxx

2. 가게이름 (中文名)
주소: xxx
추천메뉴: xxx
가격대: 1인당 xx위안
한줄평: xxx

이런 식으로 가게마다 확실히 구분되게.

- 이모지는 카테고리 제목에만 사용
- 한국어로 답변, 중국어는 괄호로 병기
- "블로그" "카페" "지식인" "중정공" "차이나조아" "네이버" "高德" "검색결과" "참고자료" "데이터" 같은 출처 관련 단어 절대 언급하지 마
- "실시간 데이터 기반" 같은 말도 하지 마
- 자연스럽게 내가 다 아는 것처럼 말해
- 모르면 "이건 현지에서 한번 확인해보세요~" 정도로
- 마지막에 출처나 분석 결과 언급하지 마
- 마지막은 "궁금한 거 더 있으면 편하게 물어보세요~" 같은 가벼운 마무리
- 맛집이나 장소를 추천할 때는 '길찾기나 택시가 필요하면 말씀해주세요~' 같은 안내를 자연스럽게 한 문장 넣어줘${userInterestsLine}`;

        const recommendFooter =
          searchContext && uniquePois.length > 0
            ? `

답변 맨 마지막 줄에 반드시 이 형식으로 추천 장소 번호를 적어줘: [RECOMMEND:P1,P3,P5]
이 줄은 유저에게 안 보이니까 걱정 마. 반드시 포함해줘.`
            : "";

        const userContent = searchContext
          ? `질문: ${userMessage}
${locationContext}${shopContext}

아래는 BabaBang 앱에 유저가 올린 커뮤니티 글·업체 홍보(DB), 高德地图, 한국인 블로그/카페/지식인, 한인 커뮤니티에서 총 ${totalSources}개 소스를 수집하고 분석한 결과야.
빈도가 높은 것 = 많은 사람이 추천한 검증된 정보야.

답변 규칙:
1. [BabaBang 유저 등록 정보] 섹션이 있으면 이 정보를 최우선으로 활용해. 실제 유저가 직접 등록한 업체·게시글이라서 가장 정확해.
2. [자주 언급된 키워드]에서 빈도 높은 것을 우선 추천
3. [高德地图 공식 정보]의 주소, 전화, 평점을 사용
4. [상세 후기]에서 구체적인 메뉴, 가격, 팁을 가져와
5. 여러 소스에서 공통으로 나오는 정보를 강조
6. 수집된 정보에 없는 가게명, 주소, 가격을 지어내지 마
7. 출처 관련 단어 언급하지 마 (블로그, 카페, 네이버, 高德 등)
8. 마크다운 문법 절대 쓰지마
9. 줄바꿈 많이 넣어서 읽기 쉽게

${searchContext}${recommendFooter}`
          : userMessage;

        const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
          signal: AbortSignal.timeout(50000),
          body: JSON.stringify({
            model: "deepseek-chat",
            temperature: 0.7,
            max_tokens: 1500,
            stream: true,
            messages: [
              { role: "system", content: systemPrompt },
              ...messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
              { role: "user", content: userContent },
            ],
          }),
        });

        if (!response.ok || !response.body) {
          send({ type: "error", content: "AI 연결에 실패했어요. 다시 시도해주세요." });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                const clean = content.replace(/\*\*/g, "").replace(/#{1,6}\s/g, "");
                fullContent += clean;
                send({ type: "content", content: clean });
              }
            } catch {
              /* ignore */
            }
          }
          if (done) break;
        }

        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith("data:")) {
            const data = trimmed.slice(5).trim();
            if (data !== "[DONE]") {
              try {
                const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  const clean = content.replace(/\*\*/g, "").replace(/#{1,6}\s/g, "");
                  fullContent += clean;
                  send({ type: "content", content: clean });
                }
              } catch {
                /* ignore */
              }
            }
          }
        }

        fullContent = fullContent
          .replace(/\*\*/g, "")
          .replace(/\*/g, "")
          .replace(/```[^`]*```/g, "")
          .replace(/#{1,6}\s/g, "")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .trim();

        const indexedPois = uniquePois.slice(0, 10);
        const recommendMatch = fullContent.match(/\[RECOMMEND:([^\]]+)\]/);
        let recommendedIndices: number[] = [];
        if (recommendMatch) {
          recommendedIndices = recommendMatch[1]
            .split(",")
            .map((p) => parseInt(p.replace(/^P/i, "").trim(), 10))
            .filter((n) => !isNaN(n) && n >= 1 && n <= indexedPois.length);
        }
        const finalPois =
          recommendedIndices.length > 0
            ? recommendedIndices.map((i) => indexedPois[i - 1]).filter(Boolean).slice(0, 5)
            : indexedPois.slice(0, 5);

        const fullContentForUser = fullContent.replace(/\n?\[RECOMMEND:[^\]]+\]\s*/g, "").trim();
        const recommendedShops = finalPois.map((poi) => poiToRecommendedPayload(poi));

        send({
          type: "done",
          content: fullContentForUser,
          meta: { totalSources },
          recommendedShops,
        });

        try {
          const pool = (await import("@/lib/db")).default;
          await pool.query("INSERT INTO chat_history (user_id, user_message, ai_response) VALUES (?, ?, ?)", [
            1,
            userMessage,
            fullContentForUser,
          ]);
        } catch (dbErr) {
          console.error("chat_history insert:", dbErr);
        }
      } catch (e: unknown) {
        console.error("Stream error:", e);
        send({ type: "error", content: "네트워크가 불안정해요. 다시 시도해주세요~" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
