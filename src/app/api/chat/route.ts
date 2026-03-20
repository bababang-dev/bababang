import { NextResponse } from "next/server";
import { findShop, shopDict, type ShopEntry } from "@/lib/shopDict";
import { findCategories } from "@/lib/categoryDict";

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
async function amapSearch(keywords: string, city: string = "青岛"): Promise<Array<{ name: string; address: string; tel: string; rating: string; cost: string; type: string }>> {
  try {
    const key = process.env.AMAP_API_KEY;
    if (!key) return [];
    const url = `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(keywords)}&city=${encodeURIComponent(city)}&output=json&key=${key}&offset=30&extensions=all`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as {
      pois?: Array<{ name?: string; address?: string; tel?: string; biz_ext?: { rating?: string; cost?: string }; type?: string }>;
    };
    console.log("=== 高德 [" + keywords + "]: " + (data.pois?.length || 0) + "개 ===");
    return (data.pois || []).map((poi) => ({
      name: poi.name ?? "",
      address: poi.address ?? "",
      tel: poi.tel ?? "",
      rating: poi.biz_ext?.rating ?? "",
      cost: poi.biz_ext?.cost ?? "",
      type: poi.type ?? "",
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
type AmapPoi = { name: string; address: string; tel: string; rating: string; cost: string; type: string };

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

  const amapInfo = amapPois.map((poi) => {
    return `${poi.name} | 주소: ${poi.address} | 평점: ${poi.rating || "없음"}/5 | 전화: ${poi.tel || "없음"} | 1인당: ${poi.cost ? poi.cost + "위안" : "없음"}`;
  });

  let report = "";

  if (topMentions.length > 0) {
    report += "[여러 글에서 자주 언급된 키워드 - 많이 언급될수록 신뢰도 높음]\n";
    topMentions.forEach(([word, data]) => {
      report += `"${word}": ${data.count}회 언급 (${Array.from(data.sources).join("+")})\n`;
      if (data.contexts[0]) report += `  → ${data.contexts[0].slice(0, 80)}\n`;
    });
    report += "\n";
  }

  if (amapInfo.length > 0) {
    report += "[高德地图 공식 정보 - 주소/전화/평점 정확]\n";
    amapInfo.slice(0, 10).forEach((info, i) => {
      report += `${i + 1}. ${info}\n`;
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

async function callDeepSeek(messages: Array<{ role: string; content: string }>, apiKey: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      console.log("=== DeepSeek 호출 시도 " + (i + 1) + "/" + retries + " ===");
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          model: "deepseek-chat",
          temperature: 0.7,
          max_tokens: 1500,
          messages: messages,
        }),
      });
      if (!response.ok) {
        console.error("DeepSeek HTTP error:", response.status);
        continue;
      }
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log("=== DeepSeek 시도 " + (i + 1) + " 실패: " + msg + " ===");
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  return "지금 네트워크가 불안정해요. 잠시 후 다시 물어봐주세요~";
}

function uniqueByZh(list: ShopEntry[]): ShopEntry[] {
  return list.filter((s, idx, arr) => arr.findIndex((x) => x.zh === s.zh) === idx);
}

function matchRecommendedShops(
  userMessage: string,
  aiContent: string,
  extraShops: ShopEntry[]
): ShopEntry[] {
  const merged = uniqueByZh([...shopDict, ...extraShops]);
  const text = `${userMessage} ${aiContent}`;
  const result: ShopEntry[] = [];

  // 1) 별명 매칭
  merged.forEach((shop) => {
    if (shop.koreanNames.some((name) => userMessage.includes(name)) || userMessage.includes(shop.zh)) {
      result.push(shop);
    }
  });

  // 2) 카테고리 매칭
  const categoryKeywords: Record<string, string[]> = {
    맛집: ["맛집", "식당", "밥", "술", "고기", "양꼬치"],
    카페: ["카페", "커피", "디저트", "차"],
    병원: ["병원", "의원", "진료", "치과", "응급"],
    마트: ["마트", "장보기", "쇼핑", "식재료"],
  };
  Object.entries(categoryKeywords).forEach(([category, keys]) => {
    if (keys.some((k) => userMessage.includes(k))) {
      merged.filter((s) => s.category.includes(category)).forEach((s) => result.push(s));
    }
  });

  // 3) 지역 매칭
  merged.forEach((shop) => {
    if (text.includes(shop.district)) result.push(shop);
  });

  // 4) AI 답변 가게명 매칭
  merged.forEach((shop) => {
    if (aiContent.includes(shop.zh) || shop.koreanNames.some((n) => aiContent.includes(n))) {
      result.push(shop);
    }
  });

  return uniqueByZh(result);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = body.messages as Array<{ role: string; content: string }>;
    const localShops = (body.localShops ?? []) as ShopEntry[];
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }

    const userMessage = messages[messages.length - 1]?.content || "";
    const searchQuery = "칭다오 " + userMessage.slice(0, 30).trim();
    const sortType = Math.random() > 0.5 ? "sim" : "date";
    const startPos = Math.floor(Math.random() * 5) + 1;

    // ═══ 1. 3개 소스 동시 검색 ═══

    // 가게 별명 감지
    const detectedShop = findShop(userMessage);
    if (detectedShop) {
      console.log("=== 가게 감지: " + detectedShop.koreanNames[0] + " → " + detectedShop.zh + " ===");
    }

    // 카테고리 감지
    const amapKeywordsFromDict = findCategories(userMessage);

    // 高德 검색 키워드 결정
    let amapKeywords: string[];
    if (detectedShop) {
      amapKeywords = [detectedShop.zh];
    } else if (amapKeywordsFromDict.length > 0) {
      amapKeywords = amapKeywordsFromDict;
    } else {
      amapKeywords = ["美食"];
    }

    // 동시 실행: 차이나조아 + 高德 + 네이버(6개)
    const [chinazoaData, ...amapAndNaverResults] = await Promise.all([
      crawlChinazoa(userMessage),
      ...amapKeywords.map((kw) => amapSearch(kw)),
      naverSearch("blog", searchQuery, 15, startPos, sortType),
      naverSearch("blog", searchQuery, 15, 11, sortType === "sim" ? "date" : "sim"),
      naverSearch("cafearticle", searchQuery + " 중정공", 10, 1, "sim"),
      naverSearch("cafearticle", searchQuery, 5, 1, "sim"),
      naverSearch("kin", searchQuery, 5, 1, "sim"),
    ]);

    // 高德 결과 합치기
    const amapCount = amapKeywords.length;
    const allAmapPois = (amapAndNaverResults.slice(0, amapCount) as Array<Array<{ name: string; address: string; tel: string; rating: string; cost: string; type: string }>>).flat();
    const uniquePois = allAmapPois.filter(
      (poi, idx, arr) => arr.findIndex((p) => p.name === poi.name) === idx
    );

    // 네이버 결과 합치기
    const naverResults = amapAndNaverResults.slice(amapCount) as Array<Array<{ title?: string; description?: string; link?: string }>>;
    const [blog1, blog2, cafeZh, cafe1, kin1] = naverResults;
    const allNaverItems = [
      ...(blog1 || []).map((i) => ({ title: stripHtml(i.title ?? ""), desc: stripHtml(i.description ?? ""), source: "블로그", link: i.link ?? "" })),
      ...(blog2 || []).map((i) => ({ title: stripHtml(i.title ?? ""), desc: stripHtml(i.description ?? ""), source: "블로그", link: i.link ?? "" })),
      ...(cafeZh || []).map((i) => ({ title: stripHtml(i.title ?? ""), desc: stripHtml(i.description ?? ""), source: "카페", link: i.link ?? "" })),
      ...(cafe1 || []).map((i) => ({ title: stripHtml(i.title ?? ""), desc: stripHtml(i.description ?? ""), source: "카페", link: i.link ?? "" })),
      ...(kin1 || []).map((i) => ({ title: stripHtml(i.title ?? ""), desc: stripHtml(i.description ?? ""), source: "지식인", link: i.link ?? "" })),
    ].filter((item, idx, arr) => arr.findIndex((a) => a.link === item.link) === idx);

    // 블로그 원문 크롤링 (상위 3개)
    const topBlogs = allNaverItems.filter((i) => i.source === "블로그").slice(0, 3);
    const blogContents = await Promise.all(
      topBlogs.map(async (item) => {
        const full = await fetchBlogContent(item.link);
        return full ? `${item.title}\n${full}` : `${item.title}: ${item.desc}`;
      })
    );

    const totalSources = chinazoaData.length + uniquePois.length + allNaverItems.length;
    console.log(`=== 총 수집: 차이나조아 ${chinazoaData.length} + 高德 ${uniquePois.length} + 네이버 ${allNaverItems.length} = ${totalSources}개 ===`);

    // ═══ 2. 수집 데이터 분석 → DeepSeek용 요약만 전달 ═══
    const analysisReport = analyzeCollectedData(uniquePois, allNaverItems, chinazoaData, blogContents);
    const searchContext = analysisReport.slice(0, 2000);
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

    // ═══ 3. DeepSeek 호출 ═══
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

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
- 마지막은 "궁금한 거 더 있으면 편하게 물어보세요~" 같은 가벼운 마무리`;

    const userContent = searchContext
      ? `질문: ${userMessage}
${locationContext}${shopContext}

아래는 高德地图, 한국인 블로그/카페/지식인, 한인 커뮤니티에서 총 ${totalSources}개 글을 수집하고 분석한 결과야.
빈도가 높은 것 = 많은 사람이 추천한 검증된 정보야.

답변 규칙:
1. [자주 언급된 키워드]에서 빈도 높은 것을 우선 추천
2. [高德地图 공식 정보]의 주소, 전화, 평점을 사용
3. [상세 후기]에서 구체적인 메뉴, 가격, 팁을 가져와
4. 여러 소스에서 공통으로 나오는 정보를 강조
5. 검색결과에 없는 가게명, 주소, 가격을 지어내지 마
6. 출처 관련 단어 언급하지 마 (블로그, 카페, 네이버, 高德 등)
7. 마크다운 문법 절대 쓰지마
8. 줄바꿈 많이 넣어서 읽기 쉽게

${searchContext}`
      : userMessage;

    let content = await callDeepSeek(
      [
        { role: "system", content: systemPrompt },
        ...messages.slice(0, -1).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
        { role: "user", content: userContent },
      ],
      apiKey
    );

    content = content
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/```[^`]*```/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();

    const matchedShops = matchRecommendedShops(userMessage, content, localShops);

    return NextResponse.json({
      content,
      recommendedShops: matchedShops.slice(0, 3).map((shop) => ({
        zh: shop.zh,
        koreanName: shop.koreanNames[0],
        category: shop.category,
        district: shop.district,
        description: shop.description || "",
        recommendMenu: shop.recommendMenu || "",
        priceRange: shop.priceRange || "",
        tip: shop.tip || "",
      })),
      meta: { totalSources },
    });
  } catch (e) {
    console.error("Chat API error:", e);
    return NextResponse.json({
      content: "지금 네트워크가 불안정해요. 잠시 후 다시 물어봐주세요~",
      meta: { totalSources: 0 },
    });
  }
}
