import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import pool from "@/lib/db";
import { findAllShops } from "@/lib/shopDict";
import { getShopDictFromDB } from "@/lib/shopDictServer";
import { findCategories } from "@/lib/categoryDict";
import {
  getCachedSearch,
  cacheShop,
  cacheReview,
  cacheSearchResult,
} from "@/lib/searchCache";
import { firecrawlScrape } from "@/lib/firecrawl";
import { amapSearch, type AmapPoiItem } from "@/lib/amap";

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

type NaverItem = { title: string; desc: string; source: string; link: string };

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

/** 高德 주변 검색 (반경 m, location = 경도,위도) */
async function amapAround(
  lng: number,
  lat: number,
  keywords: string,
  radiusM = 5000
): Promise<
  Array<{
    name: string;
    address: string;
    tel: string;
    rating: string;
    cost: string;
    openTime: string;
    photos: string[];
    type: string;
    location: string;
  }>
> {
  try {
    const key = process.env.AMAP_API_KEY;
    if (!key) return [];
    const loc = `${lng},${lat}`;
    const url = `https://restapi.amap.com/v3/place/around?key=${key}&location=${encodeURIComponent(loc)}&keywords=${encodeURIComponent(keywords)}&radius=${radiusM}&output=json&offset=30&extensions=all`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as {
      pois?: Array<{
        name?: string;
        address?: string;
        tel?: string;
        rating?: string;
        location?: string;
        photos?: Array<{ url?: string } | string>;
        biz_ext?: { rating?: string; cost?: string; open_time?: string; meal_ordering?: string };
        type?: string;
      }>;
    };
    console.log(
      "=== 高德 around [" + keywords + "] r=" + radiusM + "m: " + (data.pois?.length || 0) + "개 ==="
    );
    return (data.pois || []).map((poi) => {
      const photos =
        poi.photos?.slice(0, 3).map((p) => (typeof p === "string" ? p : p?.url ?? "")).filter(Boolean) ?? [];
      return {
        name: poi.name ?? "",
        address: poi.address ?? "",
        tel: poi.tel ?? "",
        rating: poi.biz_ext?.rating || poi.rating || "",
        cost: poi.biz_ext?.cost || "",
        openTime: poi.biz_ext?.open_time || "",
        photos,
        type: poi.type ?? "",
        location: poi.location ?? "",
      };
    });
  } catch {
    return [];
  }
}

// ═══ SerpAPI 百度 4방향 검색 (大众点评 / 小红书 / 知乎 / 美团) ═══
async function searchBaiduMulti(keyword: string): Promise<{
  lines: string[];
  rawItems: Array<{ link?: string; title?: string; snippet?: string }>;
  urls: Array<{ url: string; title: string }>;
}> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return { lines: [], rawItems: [], urls: [] };

  const queries = [
    keyword + " 大众点评 评价",
    keyword + " 小红书 推荐",
    keyword + " 知乎",
    keyword + " 美团 评价",
  ];
  const sources = ["大众点评", "小红书", "知乎", "美团"];
  const allResults: string[] = [];
  const rawItems: Array<{ link?: string; title?: string; snippet?: string }> = [];
  const seenUrl = new Set<string>();
  const urls: Array<{ url: string; title: string }> = [];

  await Promise.all(
    queries.map(async (q, i) => {
      try {
        const url =
          "https://serpapi.com/search.json?engine=baidu&q=" +
          encodeURIComponent(q) +
          "&api_key=" +
          apiKey;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const data = (await res.json()) as {
          organic_results?: Array<{ title?: string; snippet?: string; link?: string }>;
        };

        if (data.organic_results) {
          for (const item of data.organic_results.slice(0, 5)) {
            allResults.push(
              "[" +
                sources[i] +
                "] " +
                (item.title || "") +
                ": " +
                (item.snippet || "").slice(0, 300)
            );
            rawItems.push({
              link: item.link,
              title: item.title,
              snippet: item.snippet,
            });
            const link = item.link?.trim();
            if (link && !seenUrl.has(link)) {
              seenUrl.add(link);
              urls.push({ url: link, title: item.title || "" });
            }
          }
        }
      } catch {
        /* ignore */
      }
    })
  );

  console.log("=== 百度 4방향 검색 결과: " + allResults.length + "개, URL " + urls.length + "개 ===");
  return { lines: allResults, rawItems, urls };
}

// ═══ 네이버 Open API (SerpAPI 실패 시 폴백) ═══
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

// ═══ SerpAPI 네이버 검색 ═══
async function searchNaver(
  query: string
): Promise<Array<{ title: string; desc: string; source: string; link: string }>> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  try {
    const url = `https://serpapi.com/search.json?engine=naver&query=${encodeURIComponent(query + " 칭다오")}&api_key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      blog_results?: Array<{ title?: string; snippet?: string; description?: string; link?: string }>;
      cafe_results?: Array<{ title?: string; snippet?: string; description?: string; link?: string }>;
      organic_results?: Array<{ title?: string; snippet?: string; link?: string }>;
    };

    const results: Array<{ title: string; desc: string; source: string; link: string }> = [];

    if (data.blog_results) {
      for (const item of data.blog_results.slice(0, 10)) {
        results.push({
          title: item.title || "",
          desc: item.snippet || item.description || "",
          source: "블로그",
          link: item.link || "",
        });
      }
    }

    if (data.cafe_results) {
      for (const item of data.cafe_results.slice(0, 5)) {
        results.push({
          title: item.title || "",
          desc: item.snippet || item.description || "",
          source: "카페",
          link: item.link || "",
        });
      }
    }

    if (data.organic_results) {
      for (const item of data.organic_results.slice(0, 5)) {
        results.push({
          title: item.title || "",
          desc: item.snippet || "",
          source: "네이버",
          link: item.link || "",
        });
      }
    }

    console.log("=== SerpAPI 네이버 결과: " + results.length + "개 ===");
    return results;
  } catch (e) {
    console.log("=== SerpAPI 네이버 실패, 기존 방식 시도 ===", e);
    return [];
  }
}

async function searchGoogleNews(query: string): Promise<string[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  try {
    const url = `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(query + " 青岛")}&gl=cn&hl=zh-cn&api_key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      news_results?: Array<{ title?: string; snippet?: string }>;
    };

    const results: string[] = [];
    if (data.news_results) {
      for (const item of data.news_results.slice(0, 5)) {
        results.push(`[뉴스] ${item.title}: ${(item.snippet || "").slice(0, 100)}`);
      }
    }

    console.log("=== Google 뉴스 결과: " + results.length + "개 ===");
    return results;
  } catch {
    return [];
  }
}

async function fetchNaverItemsSerpOrFallback(
  searchQuery: string,
  sortType: string,
  startPos: number
): Promise<NaverItem[]> {
  const serpItems = await searchNaver(searchQuery);
  if (serpItems.length > 0) {
    const mapped = serpItems.map((i) => ({
      title: stripHtml(i.title),
      desc: stripHtml(i.desc),
      source: i.source,
      link: i.link,
    }));
    return mapped.filter((item, idx, arr) => arr.findIndex((a) => a.link === item.link) === idx);
  }

  console.log("=== SerpAPI 네이버 빈 결과 → 네이버 Open API 폴백 ===");
  const naverResults = await Promise.all([
    naverSearch("blog", searchQuery, 15, startPos, sortType),
    naverSearch("blog", searchQuery, 15, 11, sortType === "sim" ? "date" : "sim"),
    naverSearch("cafearticle", searchQuery + " 중정공", 10, 1, "sim"),
    naverSearch("cafearticle", searchQuery, 5, 1, "sim"),
    naverSearch("kin", searchQuery, 5, 1, "sim"),
  ]);
  const [blog1, blog2, cafeZh, cafe1, kin1] = naverResults;
  const merged = [
    ...(blog1 || []).map((i) => ({ title: stripHtml(i.title ?? ""), desc: stripHtml(i.description ?? ""), source: "블로그", link: i.link ?? "" })),
    ...(blog2 || []).map((i) => ({ title: stripHtml(i.title ?? ""), desc: stripHtml(i.description ?? ""), source: "블로그", link: i.link ?? "" })),
    ...(cafeZh || []).map((i) => ({ title: stripHtml(i.title ?? ""), desc: stripHtml(i.description ?? ""), source: "카페", link: i.link ?? "" })),
    ...(cafe1 || []).map((i) => ({ title: stripHtml(i.title ?? ""), desc: stripHtml(i.description ?? ""), source: "카페", link: i.link ?? "" })),
    ...(kin1 || []).map((i) => ({ title: stripHtml(i.title ?? ""), desc: stripHtml(i.description ?? ""), source: "지식인", link: i.link ?? "" })),
  ];
  return merged.filter((item, idx, arr) => arr.findIndex((a) => a.link === item.link) === idx);
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

/** 한국어 지역 표기 → 高德/번역용 중국어 (키별 개별 치환) */
const DISTRICT_KO_TO_ZH: Record<string, string> = {
  청양: "城阳",
  성양: "城阳",
  청양구: "城阳区",
  성양구: "城阳区",
  시난: "市南",
  스난: "市南",
  시남: "市南",
  시난구: "市南区",
  시남구: "市南区",
  시베이: "市北",
  시북: "市北",
  시베이구: "市北区",
  시북구: "市北区",
  황다오: "黄岛",
  황도: "黄岛",
  황다오구: "黄岛区",
  황도구: "黄岛区",
  라오산: "崂山",
  로산: "崂山",
  라오산구: "崂山区",
  로산구: "崂山区",
  리창: "李沧",
  이창: "李沧",
  리창구: "李沧区",
  이창구: "李沧区",
  즉묵: "即墨",
  지묵: "即墨",
  즉묵구: "即墨区",
  지묵구: "即墨区",
  자오저우: "胶州",
  교주: "胶州",
  자오저우시: "胶州市",
  교주시: "胶州市",
};

function applyDistrictMapping(text: string): string {
  let processed = text;
  const keys = Object.keys(DISTRICT_KO_TO_ZH).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const zh = DISTRICT_KO_TO_ZH[k];
    if (!zh) continue;
    processed = processed.split(k).join(zh);
  }
  return processed;
}

const CATEGORY_ZH_KEYWORDS: Record<string, string[]> = {
  맛집: ["餐厅", "美食", "饭店"],
  고기: ["烤肉", "烧烤", "肉"],
  치킨: ["炸鸡", "韩式炸鸡"],
  국밥: ["汤饭", "米饭"],
  카페: ["咖啡", "咖啡厅", "甜品"],
  병원: ["医院", "诊所", "医疗"],
  약국: ["药店", "药房"],
  마트: ["超市", "商店"],
  미용: ["美容", "美发", "理发"],
  학원: ["培训", "学校", "教育"],
};

function detectDistrictZhInQuery(text: string): string {
  const values = Array.from(new Set(Object.values(DISTRICT_KO_TO_ZH))).sort((a, b) => b.length - a.length);
  for (const v of values) {
    if (text.includes(v)) return v;
  }
  return "";
}

function detectExtraCategoryZh(text: string): string[] {
  for (const [ko, zhList] of Object.entries(CATEGORY_ZH_KEYWORDS)) {
    if (text.includes(ko)) return zhList;
  }
  return [];
}

type AmapPoi = AmapPoiItem;

function calculateShopScore(
  poi: AmapPoi,
  naverMentions: Map<string, number>,
  shopDictMatch: boolean
): number {
  let score = 0;

  const rating = parseFloat(poi.rating) || 0;
  if (rating >= 4.5) score += 50;
  else if (rating >= 4.0) score += 40;
  else if (rating >= 3.5) score += 25;
  else if (rating >= 3.0) score += 10;
  else if (rating > 0) score += 5;

  const name = poi.name?.split("(")[0]?.split("（")[0]?.trim() || "";
  const mentions = naverMentions.get(name) || 0;
  score += Math.min(mentions * 5, 30);

  if (shopDictMatch) score += 15;

  if (poi.tel) score += 1;
  if (poi.address) score += 1;
  if (poi.cost) score += 1;
  if (poi.openTime) score += 1;
  if (poi.rating) score += 1;

  return score;
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
      const sc = poi._score ?? 0;
      const costText = poi.cost ? `${poi.cost}위안` : "없음";
      report += `[P${i + 1}] ${poi.name} ⭐${poi.rating || "없음"} (추천점수: ${sc}점) | 주소: ${poi.address} | 전화: ${poi.tel || "없음"} | 인당: ${costText} | 영업시간: ${poi.openTime || "없음"}\n`;
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

/** review_cache에서 검색어와 연관된 기존 리뷰 */
async function getCachedReviewsForQuery(searchQueryZh: string): Promise<RowDataPacket[]> {
  try {
    const q = searchQueryZh.trim().slice(0, 80);
    if (!q) return [];
    const like = `%${q}%`;
    const [rows] = await pool.query(
      `SELECT shop_name, review_text, source, search_keyword FROM review_cache 
       WHERE COALESCE(trust_score, 50) >= 20 AND (is_reported IS NULL OR is_reported = 0)
       AND (search_keyword LIKE ? OR review_text LIKE ? OR shop_name LIKE ?)
       ORDER BY cached_at DESC LIMIT 15`,
      [like, like, like]
    );
    return rows as RowDataPacket[];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  let body: {
    messages?: unknown;
    localShops?: unknown;
    userId?: unknown;
    userLocation?: unknown;
    cacheMaxAgeDays?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawUid = body.userId;
  const chatUserId =
    typeof rawUid === "number" && Number.isFinite(rawUid) && rawUid > 0
      ? rawUid
      : typeof rawUid === "string" && Number(rawUid) > 0
        ? Number(rawUid)
        : 1;

  const messages = body.messages as Array<{ role: string; content: string }>;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        const sendStatus = (text: string) => send({ type: "status", content: text });

        const rawLoc = body.userLocation as { lat?: unknown; lng?: unknown } | undefined;
        const userLocation =
          rawLoc &&
          typeof rawLoc.lat === "number" &&
          typeof rawLoc.lng === "number" &&
          Number.isFinite(rawLoc.lat) &&
          Number.isFinite(rawLoc.lng)
            ? { lat: rawLoc.lat, lng: rawLoc.lng }
            : null;
        if (userLocation) {
          console.log(
            "=== 채팅 API userLocation: " + userLocation.lat + ", " + userLocation.lng + " ==="
          );
        }

        const userMessage = messages[messages.length - 1]?.content || "";
        const shopDictData = await getShopDictFromDB();
        const processedMessage = applyDistrictMapping(userMessage);

        sendStatus("🔍 이전 검색 결과 확인중...");
        const searchQuery = "칭다오 " + processedMessage.slice(0, 30).trim();
        const sortType = Math.random() > 0.5 ? "sim" : "date";
        const startPos = Math.floor(Math.random() * 5) + 1;

        const shopListText = shopDictData
          .filter((s) => Boolean(s.zh?.trim()))
          .map((s) => `${s.zh} = ${s.koreanNames.join(",")}`)
          .join("\n");

        let searchQueryZh = processedMessage;
        let chinazoaData: string[] = [];
        let bababangDbLines: string[] = [];
        let uniquePois: AmapPoi[] = [];
        let shopAmapResults: AmapPoi[] = [];
        let allNaverItems: NaverItem[] = [];
        let baiduResults: string[] = [];
        let crawlableUrls: string[] = [];
        let crawledContents: string[] = [];
        let newsResults: string[] = [];
        let needsNews = false;
        let totalSources = 0;
        let searchContext = "";
        let usedCache = false;

        const cached = await getCachedSearch(processedMessage, {
          maxAgeDays: body.cacheMaxAgeDays,
        });
        if (cached) {
          usedCache = true;
          console.log("=== 캐시 사용! API 호출 건너뜀 ===");

          let cachedContext = "";
          if (cached.shops.length > 0) {
            cachedContext += "[캐시된 가게 정보]\n";
            cached.shops.forEach((s: RowDataPacket, i: number) => {
              cachedContext += `${i + 1}. ${s.name_zh} (${s.name_ko || ""}) | 주소: ${s.address || ""} | 평점: ${s.rating ?? ""} | 전화: ${s.phone || ""} | 인당: ${s.cost || ""} | 영업시간: ${s.open_time || ""}\n`;
            });
          }
          if (cached.reviews.length > 0) {
            cachedContext += "\n[캐시된 리뷰]\n";
            cached.reviews.forEach((r: RowDataPacket) => {
              cachedContext += `[${r.source}] ${r.shop_name}: ${String(r.review_text || "").slice(0, 200)}\n`;
            });
          }

          searchContext = cachedContext;
          searchContext += "\n\n=== BabaBang 등록 업체 목록 ===\n" + shopListText;

          uniquePois = cached.shops.map((s: RowDataPacket) => {
            let photos: string[] = [];
            if (s.photo_urls && typeof s.photo_urls === "string") {
              try {
                const p = JSON.parse(s.photo_urls);
                if (Array.isArray(p)) photos = p as string[];
              } catch {
                photos = [];
              }
            }
            const lng = s.lng != null ? String(s.lng) : "";
            const lat = s.lat != null ? String(s.lat) : "";
            return {
              name: String(s.name_zh || ""),
              address: String(s.address || ""),
              tel: String(s.phone || ""),
              rating: s.rating != null ? String(s.rating) : "",
              cost: String(s.cost || ""),
              openTime: String(s.open_time || ""),
              photos,
              type: String(s.category || ""),
              location: lng && lat ? `${lng},${lat}` : "",
              _score: 40,
            };
          });

          totalSources =
            Number(cached.cache.total_sources) ||
            cached.shops.length + cached.reviews.length;

          console.log("=== 분석 보고서 길이: " + searchContext.length + "자 ===");
          sendStatus("✅ 캐시에서 데이터를 찾았어요!");
        }

        const amapOpts = { sortrule: 2 as const, offset: 20 as const };

        const appendKbContext = (kbRows: RowDataPacket[]) => {
          if (!Array.isArray(kbRows) || kbRows.length === 0) return;
          searchContext += "\n\n=== BabaBang 지식 베이스 ===\n";
          for (const kb of kbRows) {
            searchContext +=
              "[" +
              String(kb.title ?? "") +
              "]\n" +
              String(kb.content ?? "").slice(0, 1000) +
              "\n\n";
          }
          console.log("=== 지식 베이스 매칭: " + kbRows.length + "개 ===");
        };

        if (!usedCache) {
        const matchedShops = findAllShops(processedMessage, shopDictData);
        if (matchedShops.length > 0 && matchedShops[0].zh) {
          searchQueryZh = matchedShops[0].zh;
          console.log("=== shopDict 매칭: " + searchQueryZh + " ===");
        } else {
          const hasKorean = /[가-힣]/.test(processedMessage);
          if (hasKorean) {
            sendStatus("🌐 검색어 번역중...");
            try {
              const transRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
                signal: AbortSignal.timeout(5000),
                body: JSON.stringify({
                  model: "gpt-4o-mini",
                  temperature: 0,
                  max_tokens: 100,
                  messages: [
                    {
                      role: "user",
                      content:
                        "아래 한국어를 중국어로 번역해. 번역만 출력해. 다른 말 하지마. 장소명, 기관명, 카테고리 등을 정확히 번역해. '맛집'은 '美食'으로, '고기집'은 '烤肉'으로, '병원'은 '医院'으로 번역해. 지역명은 정확한 중국어 행정구역명으로 번역해.\n\n" +
                        processedMessage,
                    },
                  ],
                }),
              });
              const transData = (await transRes.json()) as {
                choices?: Array<{ message?: { content?: string } }>;
              };
              const translated = transData.choices?.[0]?.message?.content?.trim();
              if (translated && translated.length > 0) {
                searchQueryZh = translated;
                console.log("=== 번역: " + processedMessage + " → " + searchQueryZh + " ===");
              }
            } catch {
              console.log("=== 번역 실패, 원문 사용 ===");
            }
          }
        }

        console.log("=== 검색 키워드: 高德/百度=" + searchQueryZh + ", 네이버=" + processedMessage + " ===");

        const districtZh = detectDistrictZhInQuery(searchQueryZh);
        const baiduQuery =
          districtZh && !searchQueryZh.includes(districtZh)
            ? `${districtZh} ${searchQueryZh}`.trim()
            : searchQueryZh;

        const amapKeywordsFromDict = findCategories(searchQueryZh);
        const baseCategoryWords = amapKeywordsFromDict.length > 0 ? amapKeywordsFromDict : ["美食"];
        const extraCategoryZh = detectExtraCategoryZh(processedMessage + searchQueryZh);

        const amapKeywordList: string[] = [];
        const pushAmapKw = (kw: string) => {
          const t = kw.trim();
          if (!t) return;
          if (!amapKeywordList.includes(t)) amapKeywordList.push(t);
        };

        if (searchQueryZh.trim()) {
          const q =
            districtZh && !searchQueryZh.includes(districtZh)
              ? `${districtZh} ${searchQueryZh}`.trim()
              : searchQueryZh.trim();
          pushAmapKw(q);
        }

        for (const kw of baseCategoryWords) {
          const q =
            districtZh && !kw.includes(districtZh) ? `${districtZh} ${kw}`.trim() : kw;
          pushAmapKw(q);
        }

        for (const ek of extraCategoryZh.slice(0, 2)) {
          pushAmapKw(districtZh ? `${districtZh} ${ek}`.trim() : ek);
        }

        if (
          processedMessage.includes("맛집") ||
          searchQueryZh.includes("美食") ||
          searchQueryZh.includes("餐")
        ) {
          pushAmapKw(districtZh ? `${districtZh} 美食`.trim() : "美食");
        }

        if (amapKeywordList.length === 0) {
          pushAmapKw(districtZh ? `${districtZh} 美食`.trim() : "美食");
        }

        const amapKeywords = amapKeywordList.slice(0, 10);

        const newsKeywords = [
          "뉴스",
          "소식",
          "최근",
          "요즘",
          "코로나",
          "정책",
          "비자",
          "규정",
          "법",
          "사건",
          "날씨",
          "환율",
          "부동산시장",
        ];
        needsNews = newsKeywords.some((k) => userMessage.includes(k));

        const mainQueryForAmap = (() => {
          let q = searchQueryZh.trim();
          if (!q) return "美食";
          if (q.includes("餐厅") && !q.includes("美食")) q = q.replace(/餐厅/g, "美食");
          return q;
        })();

        sendStatus("🔍 大众点评 리뷰 검색중...");
        sendStatus("📕 小红书 후기 검색중...");
        sendStatus("💬 知乎 정보 검색중...");
        sendStatus("🍽️ 美团 평가 검색중...");
        const baiduPack = await searchBaiduMulti(baiduQuery);
        baiduResults = baiduPack.lines;
        const baiduUrlResults = baiduPack.urls;

        sendStatus("🗄️ BabaBang 데이터베이스 검색중...");
        const cachedReviewRows = await getCachedReviewsForQuery(searchQueryZh);

        sendStatus("🇰🇷 네이버 블로그/카페 검색중...");
        allNaverItems = await fetchNaverItemsSerpOrFallback(searchQuery, sortType, startPos);

        chinazoaData = await crawlChinazoa(processedMessage);

        sendStatus("🗺️ 高德地图에서 가게 정보 검색중...");
        const mainAmapResults = await amapSearch(mainQueryForAmap, "青岛", amapOpts);
        if (mainAmapResults.length < 10) {
          const categoryMapZh: Record<string, string[]> = {
            美食: ["餐厅", "饭店", "小吃"],
            烤肉: ["烧烤", "韩式烤肉", "肉"],
            炸鸡: ["韩式炸鸡", "鸡排"],
            汤饭: ["米饭", "韩式汤饭", "汤"],
            咖啡: ["咖啡厅", "甜品", "奶茶"],
            医院: ["诊所", "医疗", "门诊"],
            超市: ["商店", "便利店", "韩国超市"],
          };
          for (const [key, alternatives] of Object.entries(categoryMapZh)) {
            if (searchQueryZh.includes(key)) {
              for (const alt of alternatives.slice(0, 2)) {
                const altKeyword = searchQueryZh.replace(key, alt);
                const altResults = await amapSearch(altKeyword, "青岛", {
                  sortrule: 2,
                  offset: 10,
                });
                mainAmapResults.push(...altResults);
              }
              break;
            }
          }
        }

        const amapCount = amapKeywords.length;
        const parallelBundle = await Promise.all([
          ...amapKeywords.map((kw) => amapSearch(kw, "青岛", amapOpts)),
          needsNews ? searchGoogleNews(userMessage) : Promise.resolve([] as string[]),
        ]);
        const categoryAmapBaiduNews = parallelBundle;

        const categoryAmapResults = categoryAmapBaiduNews.slice(0, amapCount) as Array<Array<AmapPoi>>;
        newsResults = (categoryAmapBaiduNews[amapCount] as string[]) || [];
        shopAmapResults = [];
        if (matchedShops.length > 0) {
          const shopSearchPromises = matchedShops.slice(0, 5).map((shop) => {
            if (!shop.zh) return Promise.resolve([] as AmapPoi[]);
            const searchName = shop.zh.replace(/[\(\)（）]/g, " ").trim();
            return amapSearch(searchName, "青岛", amapOpts).catch(() => [] as AmapPoi[]);
          });
          const results = await Promise.all(shopSearchPromises);
          shopAmapResults = results.flat();
          console.log("=== shopDict → 高德 추가 검색: " + shopAmapResults.length + "개 ===");
        }

        let allAmapPois = [...mainAmapResults, ...(categoryAmapResults as Array<Array<AmapPoi>>).flat()];
        if (userLocation) {
          const aroundBatches = await Promise.all(
            amapKeywords.map((kw) =>
              amapAround(userLocation.lng, userLocation.lat, kw, 5000).catch(() => [] as AmapPoi[])
            )
          );
          allAmapPois = [...allAmapPois, ...aroundBatches.flat()];
        }
        uniquePois = allAmapPois.filter(
          (poi, idx, arr) => arr.findIndex((p) => p.name === poi.name) === idx
        );

        const seenAmapNames = new Set<string>();
        for (const poi of uniquePois) {
          const n = poi.name?.split("(")[0]?.split("（")[0]?.trim() || "";
          if (n) seenAmapNames.add(n);
        }

        if (uniquePois.length < 5 && searchQueryZh.trim()) {
          try {
            const broadQuery = searchQueryZh.replace(/[区市]/g, "").trim();
            if (broadQuery) {
              const broadResults = await amapSearch(broadQuery, "青岛", amapOpts);
              for (const poi of broadResults) {
                const name = poi.name?.split("(")[0]?.split("（")[0]?.trim() || "";
                if (name && !seenAmapNames.has(name)) {
                  seenAmapNames.add(name);
                  uniquePois.push(poi);
                }
              }
            }
          } catch {
            /* ignore */
          }
          console.log("=== 추가 검색 후 총 " + uniquePois.length + "개 ===");
        }

        console.log(
          "=== 高德 " + amapKeywords.length + "개 키워드로 " + uniquePois.length + "개 결과 ==="
        );

        const naverMentionCount = new Map<string, number>();
        if (allNaverItems.length > 0) {
          for (const item of allNaverItems) {
            const text = (item.title || "") + " " + (item.desc || "");
            for (const poi of uniquePois) {
              const name = poi.name?.split("(")[0]?.split("（")[0]?.trim() || "";
              if (name.length >= 2 && text.includes(name)) {
                naverMentionCount.set(name, (naverMentionCount.get(name) || 0) + 1);
              }
            }
          }
        }

        const shopDictNames = new Set(
          shopDictData
            .map((s) => s.zh?.split("(")[0]?.split("（")[0]?.trim())
            .filter((x): x is string => Boolean(x))
        );

        for (const poi of uniquePois) {
          const nameBase = poi.name?.split("(")[0]?.split("（")[0]?.trim() || "";
          const isInDict = shopDictNames.has(nameBase);
          poi._score = calculateShopScore(poi, naverMentionCount, isInDict);
        }

        uniquePois.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));

        const topBlogs = allNaverItems.filter((i) => i.source === "블로그").slice(0, 3);
        const blogContents = await Promise.all(
          topBlogs.map(async (item) => {
            const full = await fetchBlogContent(item.link);
            return full ? `${item.title}\n${full}` : `${item.title}: ${item.desc}`;
          })
        );

        bababangDbLines = await fetchBababangDbContext(processedMessage);

        totalSources = 0;
        searchContext = "";

        if (baiduResults.length > 0) {
          searchContext += "=== 중국 플랫폼 리뷰/정보 (가장 신뢰) ===\n";
          searchContext += baiduResults.join("\n") + "\n\n";
          totalSources += baiduResults.length;
        }

        if (cachedReviewRows.length > 0) {
          searchContext += "=== BabaBang 축적 데이터 ===\n";
          for (const r of cachedReviewRows.slice(0, 10)) {
            const row = r as { source?: string; shop_name?: string; review_text?: string };
            searchContext +=
              "[" +
              String(row.source ?? "") +
              "] " +
              String(row.shop_name ?? "") +
              ": " +
              String(row.review_text ?? "").slice(0, 200) +
              "\n";
          }
          searchContext += "\n";
          totalSources += cachedReviewRows.length;
        }

        if (allNaverItems.length > 0) {
          searchContext += "=== 한국인 블로그/카페 후기 ===\n";
          for (const item of allNaverItems.slice(0, 10)) {
            searchContext +=
              "[" + item.source + "] " + item.title + ": " + item.desc.slice(0, 200) + "\n";
          }
          searchContext += "\n";
          totalSources += allNaverItems.length;
        }

        if (chinazoaData.length > 0) {
          searchContext += "=== 칭다오 한인 커뮤니티 (차이나조아) ===\n";
          searchContext += chinazoaData.slice(0, 10).join("\n") + "\n\n";
          totalSources += chinazoaData.length;
        }

        if (uniquePois.length > 0) {
          searchContext += "=== 가게 기본 정보 (高德地图) ===\n";
          for (const poi of uniquePois.slice(0, 15)) {
            searchContext +=
              poi.name +
              " | 평점: " +
              (poi.rating || "없음") +
              " | 주소: " +
              (poi.address || "") +
              " | 전화: " +
              (poi.tel || "") +
              " | 인당: " +
              (poi.cost || "") +
              "위안 | 영업: " +
              (poi.openTime || "") +
              "\n";
          }
          searchContext += "\n";
          totalSources += uniquePois.length;
        }

        if (matchedShops.length > 0) {
          searchContext += "=== BabaBang 등록 업체 매칭 ===\n";
          for (const s of matchedShops) {
            if (s.zh) searchContext += s.zh + " (한국어: " + s.koreanNames.join(",") + ")\n";
          }
          searchContext += "\n";
        }

        try {
          const [kbRows] = (await pool.query(
            "SELECT title, content FROM knowledge_base WHERE is_active = TRUE AND MATCH(content) AGAINST(? IN NATURAL LANGUAGE MODE) LIMIT 3",
            [processedMessage]
          )) as unknown as [RowDataPacket[]];
          appendKbContext(kbRows);
        } catch {
          try {
            const slice = processedMessage.slice(0, 20);
            const like = "%" + slice + "%";
            const [kbRows] = (await pool.query(
              "SELECT title, content FROM knowledge_base WHERE is_active = TRUE AND (content LIKE ? OR title LIKE ?) LIMIT 3",
              [like, like]
            )) as unknown as [RowDataPacket[]];
            appendKbContext(kbRows);
          } catch (e2) {
            console.log("=== 지식 베이스 검색 실패 ===", e2);
          }
        }

        if (bababangDbLines.length > 0) {
          searchContext += "\n\n=== BabaBang 유저 등록 정보 (가장 신뢰도 높음) ===\n";
          searchContext += bababangDbLines.join("\n");
          totalSources += bababangDbLines.length;
        }

        const analysisReport = analyzeCollectedData([], allNaverItems, [], blogContents);
        if (analysisReport.trim().length > 0) {
          searchContext +=
            "\n\n=== 교차 분석 요약 (키워드·블로그) ===\n" + analysisReport.slice(0, 2000);
        }

        searchContext +=
          "\n\n=== BabaBang 등록 업체 목록 (355개, 중국어이름=한국어이름) ===\n" + shopListText;

        if (shopAmapResults.length > 0) {
          searchContext += "\n\n=== shopDict 매칭 업체의 高德 상세 정보 ===\n";
          shopAmapResults.forEach((poi, i) => {
            const ratingStar = poi.rating ? `⭐${poi.rating}` : "⭐-";
            const costText = poi.cost ? `${poi.cost}위안` : "없음";
            searchContext += `${i + 1}. ${poi.name} ${ratingStar} | 주소: ${poi.address || "없음"} | 전화: ${poi.tel || "없음"} | 인당: ${costText} | 영업시간: ${poi.openTime || "없음"}\n`;
          });
        }

        if (needsNews && newsResults.length > 0) {
          searchContext += "\n\n=== 최신 뉴스 ===\n" + newsResults.join("\n");
          totalSources += newsResults.length;
        }

        console.log(
          `=== 총 수집: 차이나조아 ${chinazoaData.length} + 高德 ${uniquePois.length} + 네이버 ${allNaverItems.length} + 百度 ${baiduResults.length} + 뉴스 ${newsResults.length} + BabaBangDB ${bababangDbLines.length} + 캐시리뷰 ${cachedReviewRows.length} = 약 ${totalSources}개 ===`
        );

        sendStatus("📊 " + totalSources + "개 결과 분석중...");

        const blockedDomains = ["dianping.com", "xiaohongshu.com", "meituan.com"];
        crawlableUrls = baiduUrlResults
          .filter((item) => !blockedDomains.some((d) => item.url.includes(d)))
          .slice(0, 5)
          .map((item) => item.url);
        if (crawlableUrls.length > 0) {
          sendStatus("📄 상세 정보 크롤링중... (" + crawlableUrls.length + "개 페이지)");
        }
        crawledContents = await Promise.all(crawlableUrls.map((url) => firecrawlScrape(url)));
        totalSources += crawledContents.filter((c) => c.length > 100).length;

        const firecrawlContext = crawledContents
          .filter((c) => c.length > 100)
          .map((c, i) => "[상세 전문 " + (i + 1) + "]\n" + c.slice(0, 2000))
          .join("\n\n");

        if (firecrawlContext) {
          searchContext += "\n\n=== 상세 전문 크롤링 결과 ===\n" + firecrawlContext;
        }

        console.log("=== 분석 보고서 길이: " + searchContext.length + "자 ===");

        sendStatus("💾 검색 결과 저장중...");
        const savedShopIds: number[] = [];
        const savedReviewIds: number[] = [];

        const kwForCache = searchQueryZh || processedMessage;

        if (baiduResults.length > 0) {
          for (const text of baiduResults) {
            let source: "dianping" | "xiaohongshu" | "meituan" | "zhihu" = "zhihu";
            if (text.includes("[大众点评]")) source = "dianping";
            else if (text.includes("[小红书]")) source = "xiaohongshu";
            else if (text.includes("[美团]")) source = "meituan";
            else if (text.includes("[知乎]")) source = "zhihu";
            const rid = await cacheReview(
              { text, language: "zh" },
              kwForCache,
              source,
              processedMessage
            );
            if (rid) savedReviewIds.push(rid);
          }
          console.log("=== 百度 결과 " + baiduResults.length + "개 DB 저장 ===");
        }

        if (allNaverItems.length > 0) {
          for (const item of allNaverItems) {
            const naverSource: "naver_blog" | "naver_cafe" =
              item.source === "카페" ? "naver_cafe" : "naver_blog";
            const rid = await cacheReview(
              {
                text: (item.title || "") + " " + (item.desc || ""),
                url: item.link,
                language: "ko",
              },
              kwForCache,
              naverSource,
              processedMessage
            );
            if (rid) savedReviewIds.push(rid);
          }
          console.log("=== 네이버 결과 " + allNaverItems.length + "개 DB 저장 ===");
        }

        if (uniquePois.length > 0) {
          for (const poi of uniquePois.slice(0, 20)) {
            const sid = await cacheShop(
              {
                name_zh: poi.name,
                name_ko: null,
                address: poi.address,
                tel: poi.tel,
                rating: poi.rating,
                cost: poi.cost,
                openTime: poi.openTime ? String(poi.openTime) : "",
                lat: poi.location ? poi.location.split(",")[1] : "",
                lng: poi.location ? poi.location.split(",")[0] : "",
                photos: poi.photos,
                category: poi.type,
              },
              "amap",
              processedMessage
            );
            if (sid) savedShopIds.push(sid);
          }
          console.log("=== 高德 결과 " + uniquePois.length + "개 DB 저장 ===");
        }

        if (chinazoaData.length > 0) {
          for (const text of chinazoaData) {
            const rid = await cacheReview(
              { text, language: "ko" },
              kwForCache,
              "chinazoa",
              processedMessage
            );
            if (rid) savedReviewIds.push(rid);
          }
          console.log("=== 차이나조아 결과 " + chinazoaData.length + "개 DB 저장 ===");
        }

        if (crawledContents.length > 0) {
          let fcSaved = 0;
          for (let i = 0; i < crawledContents.length; i++) {
            if (crawledContents[i].length > 100) {
              const rid = await cacheReview(
                {
                  text: crawledContents[i].slice(0, 5000),
                  url: crawlableUrls[i],
                  language: "zh",
                },
                kwForCache,
                "firecrawl",
                processedMessage
              );
              if (rid) {
                savedReviewIds.push(rid);
                fcSaved++;
              }
            }
          }
          console.log("=== Firecrawl 전문 " + fcSaved + "개 DB 저장 ===");
        }

        await cacheSearchResult(
          processedMessage,
          searchContext.slice(0, 3000),
          savedShopIds,
          savedReviewIds,
          totalSources
        );
        console.log(
          "=== DB 저장: 가게 " + savedShopIds.length + "개, 리뷰 " + savedReviewIds.length + "개 ==="
        );

        }

        if (usedCache) {
          try {
            const [kbRows] = (await pool.query(
              "SELECT title, content FROM knowledge_base WHERE is_active = TRUE AND MATCH(content) AGAINST(? IN NATURAL LANGUAGE MODE) LIMIT 3",
              [processedMessage]
            )) as unknown as [RowDataPacket[]];
            appendKbContext(kbRows);
          } catch {
            try {
              const slice = processedMessage.slice(0, 20);
              const like = "%" + slice + "%";
              const [kbRows] = (await pool.query(
                "SELECT title, content FROM knowledge_base WHERE is_active = TRUE AND (content LIKE ? OR title LIKE ?) LIMIT 3",
                [like, like]
              )) as unknown as [RowDataPacket[]];
              appendKbContext(kbRows);
            } catch (e2) {
              console.log("=== 지식 베이스 검색 실패 ===", e2);
            }
          }
        }

        const locationContext = "";

        sendStatus("✨ 답변 생성중...");

        let userInterestsLine = "";
        try {
          const pool = (await import("@/lib/db")).default;
          const [prefRows] = await pool.query(
            `SELECT category, COUNT(*) as cnt FROM user_activity WHERE user_id = ? AND category IS NOT NULL AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY category ORDER BY cnt DESC LIMIT 3`,
            [chatUserId]
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

        const systemPrompt = `당신은 "아빠방 AI" - 칭다오(青岛) 거주 한국 교민을 위한 전문 생활 컨설턴트입니다.

=== 당신의 성격 ===
- 칭다오에 10년 이상 거주한 전문가
- 법률, 의료, 비자, 부동산, 사업, 교육 등 모든 분야에 정통
- 현실적이고 실전적인 조언을 줌
- 핵심을 먼저 말하고 구체적인 방법을 알려줌
- 이모지를 적절히 사용해서 가독성 좋게
- 한국인 교민의 입장에서 공감하면서 답변

=== 답변 스타일 ===
1. 핵심 먼저: 결론/해결책을 맨 처음에
2. 구체적 행동: "이렇게 해" 라고 단계별로
3. 현실적 조언: 중국에서의 실제 경험 기반
4. 중국어 병기: 중요한 용어는 한국어(中文) 형태로
5. 비용/시간 포함: 대략적인 비용, 소요시간 알려줘
6. 주의사항: 교민이 자주 실수하는 점 경고
7. 연락처: 관련 기관/병원/업체 번호, 주소

=== 답변 형식 ===
- 번호와 이모지로 구조화
- 중요한 건 👉 이렇게 강조
- 전화번호, 주소는 꼭 포함
- "혹시 더 궁금한 거 있으면 물어봐!" 로 마무리
- 맛집/장소 추천시: 가게명(中文), 평점, 인당가격, 영업시간, 주소 꼭 포함

=== 중요 규칙 ===
- 검색 데이터에서 大众点评, 小红书, 知乎, 美团 정보를 최우선으로 참고
- 네이버 블로그는 한국인 관점의 보조 자료
- 高德地图 데이터는 주소, 전화번호 등 팩트 확인용
- BabaBang 등록 업체는 검증된 정보
- 지식 베이스 내용은 공식 정보
- 확실하지 않은 정보는 "확인이 필요해요" 라고 밝혀
- 맛집/장소 추천시 평점 높은 순으로 추천
- 추천점수 30점 이하인 곳은 추천하지 마

=== 유저 질문이 애매할 때 ===
- 바로 답하지 말고 선택지를 줘서 구체화
- 선택지는 이모지 + 텍스트로 보기 좋게
- 질문은 1개만 (종류만 물어봐. 지역은 묻지마)
- 지역은 유저 위치 기반 자동 추천
- "현재 위치에서 가장 가까운 곳으로 추천해드릴게요!" 안내

=== 체크리스트 요청시 ===
- 절차나 준비물 질문이면 체크리스트 형태로 답변
- 각 항목 '□' 로 시작
- 마지막에 관련 기관의 주소, 영업시간, 전화번호
- 칭다오 기준 최신 정보 제공${userInterestsLine}`;

        const userContent = searchContext
          ? `질문: ${userMessage}
${locationContext}

아래는 BabaBang 앱에 유저가 올린 커뮤니티 글·업체 홍보(DB), 高德地图, 百度搜索(大众点评/小红书), 한국인 블로그/카페/지식인, 한인 커뮤니티${needsNews && newsResults.length > 0 ? ", 최신 뉴스" : ""}에서 총 ${totalSources}개 소스를 수집하고 분석한 결과야.
빈도가 높은 것 = 많은 사람이 추천한 검증된 정보야.

답변 규칙:
1. [BabaBang 유저 등록 정보] 섹션이 있으면 이 정보를 최우선으로 활용해. 실제 유저가 직접 등록한 업체·게시글이라서 가장 정확해.
2. [BabaBang 등록 업체 목록]에 있는 업체들은 실제 칭다오에서 운영중인 검증된 업체야. 유저 질문에 관련된 업체가 있으면 우선 추천해. 한국어 이름과 중국어 이름 둘 다 알려줘. 유저가 카테고리로 질문해도 (예: 한국슈퍼, 치킨집, 병원) 너가 목록을 보고 관련 업체를 찾아서 알려줘.
3. [자주 언급된 키워드]에서 빈도 높은 것을 우선 추천
4. [高德地图 공식 정보]의 주소, 전화, 평점을 사용
5. 맛집이나 장소를 추천할 때 평점이 높은 곳을 우선 추천해. 평점, 인당 가격, 영업시간을 꼭 포함해서 알려줘. 高德地图 데이터에 평점이 있으면 반드시 언급해. 예: '⭐ 4.7/5 · 인당 80위안 · 11:00~22:00'
6. [상세 후기]에서 구체적인 메뉴, 가격, 팁을 가져와
7. [百度搜索]에 大众点评이나 小红书 리뷰가 있으면 참고해서 실제 이용자 후기를 자연스럽게 답변에 포함해줘.
8. 여러 소스에서 공통으로 나오는 정보를 강조
9. 수집된 정보에 없는 가게명, 주소, 가격을 지어내지 마
10. 출처 관련 단어 언급하지 마 (블로그, 카페, 네이버, 高德 등)
11. 마크다운 문법 절대 쓰지마
12. 줄바꿈 많이 넣어서 읽기 쉽게
13. [高德地图 공식 정보]의 추천점수가 높은 가게를 우선 추천해. 추천점수는 高德 평점·한국인 블로그 언급·BabaBang 등록을 종합한 점수야. 추천점수 30점 이하인 곳은 추천하지 마.

${searchContext}`
          : userMessage;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
          signal: AbortSignal.timeout(50000),
          body: JSON.stringify({
            model: "gpt-4o-mini",
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

        type RecommendedCard = {
          name: string;
          koreanName: string;
          address: string;
          tel: string;
          rating: string;
          cost: string;
          openTime: string;
          photos: string[];
          lat: string;
          lng: string;
        };

        let recommendedShopNames: string[] = [];
        try {
          const extractRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
            signal: AbortSignal.timeout(5000),
            body: JSON.stringify({
              model: "gpt-4o-mini",
              temperature: 0,
              max_tokens: 200,
              messages: [
                {
                  role: "user",
                  content:
                    "아래 텍스트에서 추천하거나 언급한 가게/업체/기관 이름만 중국어로 뽑아줘. 없으면 '없음'이라고 해. 쉼표로 구분해서 이름만 출력해. 다른 말 하지마.\n\n" +
                    fullContent.slice(0, 1500),
                },
              ],
            }),
          });
          const extractData = (await extractRes.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const extracted = extractData.choices?.[0]?.message?.content?.trim() || "";
          console.log("=== 추천 가게 추출: " + extracted + " ===");

          if (extracted && extracted !== "없음") {
            recommendedShopNames = extracted
              .split(/[,，、]/)
              .map((n: string) => n.trim())
              .filter((n: string) => n.length >= 2)
              .filter((n: string) => {
                const hasHangul = /[가-힣]/.test(n);
                const hasCJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufadf]/.test(n);
                if (hasHangul && !hasCJK) return false;
                return true;
              });
          }
        } catch {
          console.log("=== 추천 가게 추출 실패 ===");
        }

        const allRecommendedShops: RecommendedCard[] = [];

        for (const zhName of recommendedShopNames.slice(0, 5)) {
          const shortName = zhName.split("(")[0].split("（")[0].trim();

          let matched: AmapPoi | undefined = uniquePois.find((poi) => {
            const poiShort = (poi.name || "").split("(")[0].split("（")[0].trim();
            return poiShort === shortName || poiShort.includes(shortName) || shortName.includes(poiShort);
          });

          if (!matched && shopAmapResults.length > 0) {
            matched = shopAmapResults.find((poi) => {
              const poiShort = (poi.name || "").split("(")[0].split("（")[0].trim();
              return poiShort === shortName || poiShort.includes(shortName) || shortName.includes(poiShort);
            });
          }

          if (!matched) {
            try {
              const nameForSearch = shortName || zhName;
              const solo = await amapSearch(nameForSearch, "青岛", amapOpts);
              if (solo?.length) matched = solo[0];
            } catch {
              /* ignore */
            }
          }

          const dictMatch = shopDictData.find((s) => {
            if (!s.zh?.trim()) return false;
            const dZh = s.zh.split("(")[0].split("（")[0].trim();
            return dZh === shortName || dZh.includes(shortName) || shortName.includes(dZh);
          });
          const koreanName = dictMatch ? dictMatch.koreanNames[0] : "";

          if (matched) {
            allRecommendedShops.push({
              name: matched.name || zhName,
              koreanName,
              address: matched.address || "",
              tel: matched.tel || "",
              rating: matched.rating || "",
              cost: matched.cost || "",
              openTime: matched.openTime ? String(matched.openTime) : "",
              photos: matched.photos ?? [],
              lat: matched.location ? matched.location.split(",")[1]?.trim() ?? "" : "",
              lng: matched.location ? matched.location.split(",")[0]?.trim() ?? "" : "",
            });
          } else {
            allRecommendedShops.push({
              name: zhName,
              koreanName,
              address: "",
              tel: "",
              rating: "",
              cost: "",
              openTime: "",
              photos: [],
              lat: "",
              lng: "",
            });
          }
        }

        const needInfo = allRecommendedShops.filter((s) => !s.address && s.name);
        console.log("=== 추가 검색 필요: " + needInfo.length + "개 ===");
        if (needInfo.length > 0) {
          const extraSearches = needInfo.map(async (shop) => {
            try {
              const zhName = shop.name.split("(")[0].split("（")[0].trim();
              const results = await amapSearch(zhName, "青岛", amapOpts);
              if (results && results.length > 0) {
                const poi = results[0];
                shop.address = poi.address || "";
                shop.tel = poi.tel || "";
                shop.rating = poi.rating || "";
                shop.cost = poi.cost || "";
                shop.openTime = poi.openTime ? String(poi.openTime) : "";
                if (poi.photos?.length) shop.photos = poi.photos;
                shop.lat = poi.location ? poi.location.split(",")[1]?.trim() ?? "" : shop.lat;
                shop.lng = poi.location ? poi.location.split(",")[0]?.trim() ?? "" : shop.lng;
              }
            } catch {
              /* ignore */
            }
          });
          await Promise.all(extraSearches);
        }

        console.log(
          "=== 추천 카드: " + allRecommendedShops.map((s) => s.koreanName || s.name).join(", ") + " ==="
        );

        const emojiLines = fullContent.split("\n").filter((line) => {
          const t = line.trim();
          if (!t) return false;
          const code = t.codePointAt(0) || 0;
          return code > 0x1f000 || (code >= 0x2600 && code <= 0x27bf);
        });
        const isAskingQuestion = emojiLines.length >= 3;

        const finalRecommendedShops = isAskingQuestion ? [] : allRecommendedShops;

        const fullContentForUser = fullContent;

        send({
          type: "done",
          content: fullContentForUser,
          meta: { totalSources },
          recommendedShops: finalRecommendedShops,
        });

        try {
          const pool = (await import("@/lib/db")).default;
          await pool.query("INSERT INTO chat_history (user_id, user_message, ai_response) VALUES (?, ?, ?)", [
            chatUserId,
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
