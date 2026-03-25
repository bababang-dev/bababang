import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import pool from "@/lib/db";
import { findAllShops, type ShopEntry } from "@/lib/shopDict";
import { getShopDictFromDB } from "@/lib/shopDictServer";
import {
  getCachedSearch,
  cacheShop,
  cacheReview,
  cacheSearchResult,
} from "@/lib/searchCache";
import { firecrawlScrape } from "@/lib/firecrawl";
import { amapSearch, type AmapPoiItem, type AmapSearchOptions } from "@/lib/amap";

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

const keywordExtractPrompt = `아래 한국어 질문에서 검색 키워드만 추출해서 중국어로 변환해줘.

규칙:
1. "알려줘", "추천해줘", "어떻게", "뭐야" 같은 요청어는 제거
2. 핵심 명사/장소/카테고리만 추출
3. 칭다오(青岛) 관련이면 "青岛"을 앞에 붙여
4. 지역이 명시되지 않으면 "青岛城阳区"를 기본으로 넣어줘
5. 결과만 출력, 다른 말 하지마

예시:
"맛집 추천해줘" → "青岛城阳区 美食"
"병원 알려줘" → "青岛城阳区 韩语医院"
"한국슈퍼" → "青岛城阳区 韩国超市"
"청양 맛집 추천해줘" → "青岛城阳区 美食"
"한국슈퍼 알려줘" → "青岛 韩国超市"
"출입경관리국 어디야" → "青岛 出入境管理局"
"비자 연장 어떻게 해" → "青岛 签证延期 流程"
"병원 추천해줘" → "青岛 韩语医院"
"깡통집 알려줘" → "青岛 缸桶屋"
"칭다오에서 폭행당했어" → "在青岛被打 怎么办 报警"
"집 구하고 싶어" → "青岛 租房"`;

type SearchStrategyRow = {
  baidu: string[];
  useAmap: boolean;
  amapType?: string;
};

const searchStrategy: Record<string, SearchStrategyRow> = {
  맛집: {
    baidu: ["大众点评 评价", "小红书 推荐", "美团 评价", "知乎 推荐"],
    useAmap: true,
    amapType: "050000",
  },
  쇼핑: {
    baidu: ["大众点评", "小红书", "百度地图"],
    useAmap: true,
    amapType: "060000",
  },
  의료: {
    baidu: ["医院 韩语", "知乎 推荐", "百度 评价"],
    useAmap: true,
    amapType: "090000",
  },
  행정: {
    baidu: ["流程 材料", "知乎", "百度知道", "最新政策"],
    useAmap: true,
    amapType: "130000",
  },
  부동산: {
    baidu: ["租房", "58同城", "知乎", "小红书"],
    useAmap: false,
  },
  교육: {
    baidu: ["学校", "知乎", "小红书"],
    useAmap: true,
    amapType: "141200",
  },
  교통: {
    baidu: ["交通", "百度地图", "知乎"],
    useAmap: false,
  },
  생활: {
    baidu: ["办理 流程", "知乎", "百度知道"],
    useAmap: true,
  },
  긴급: {
    baidu: ["怎么办", "知乎", "百度知道", "法律"],
    useAmap: false,
  },
  일반: {
    baidu: ["知乎", "百度知道", "百度百科"],
    useAmap: false,
  },
};

function detectCategory(msg: string): string {
  const categories: Record<string, string[]> = {
    맛집: ["맛집", "식당", "먹", "음식", "고기", "치킨", "국밥", "카페", "양꼬치", "맥주", "술집", "맛있"],
    쇼핑: ["슈퍼", "마트", "쇼핑", "사다", "어디서 사", "물건"],
    의료: ["병원", "약국", "아프", "치과", "의원", "건강검진", "진료"],
    행정: ["비자", "출입경", "관리국", "여권", "체류", "등록", "신고", "경찰", "공안", "영사관"],
    부동산: ["집", "부동산", "임대", "월세", "아파트", "방", "이사"],
    교육: ["학교", "학원", "유치원", "교육", "입학", "과외"],
    교통: ["택시", "버스", "지하철", "공항", "기차", "교통"],
    생활: ["은행", "계좌", "전화", "유심", "택배", "물", "가스", "전기"],
    긴급: ["폭행", "사기", "도둑", "분실", "사고", "긴급", "응급", "신고"],
    일반: [],
  };

  for (const [cat, keywords] of Object.entries(categories)) {
    if (cat === "일반") continue;
    if (keywords.some((k) => msg.includes(k))) return cat;
  }
  return "일반";
}

async function searchBaiduMulti(
  keyword: string,
  suffixes: string[],
  apiKey: string
): Promise<{ lines: string[]; urls: Array<{ url: string; title: string }> }> {
  if (!apiKey) return { lines: [], urls: [] };

  const queries: string[] = [keyword];
  for (const suffix of suffixes) {
    queries.push(keyword + " " + suffix);
  }

  const allTexts: string[] = [];
  const seenUrl = new Set<string>();
  const urls: Array<{ url: string; title: string }> = [];

  await Promise.all(
    queries.slice(0, 4).map(async (q) => {
      try {
        console.log("=== SerpAPI 요청 쿼리: " + q + " ===");
        console.log(
          "=== SerpAPI API키 앞 10자: " + (apiKey.length >= 10 ? apiKey.slice(0, 10) : apiKey) + "... ==="
        );
        const serpUrl =
          "https://serpapi.com/search.json?engine=baidu&q=" +
          encodeURIComponent(q) +
          "&api_key=" +
          apiKey;
        console.log("=== SerpAPI URL: " + serpUrl.slice(0, 100) + "... ===");

        const res = await fetch(serpUrl, { signal: AbortSignal.timeout(8000) });
        console.log("=== SerpAPI 응답 상태: " + res.status + " ===");

        const data = (await res.json()) as {
          organic_results?: Array<{ title?: string; snippet?: string; link?: string }>;
          error?: unknown;
        };

        console.log("=== SerpAPI 응답 키: " + Object.keys(data as object).join(",") + " ===");

        if (data.organic_results && Array.isArray(data.organic_results)) {
          console.log("=== SerpAPI organic_results: " + data.organic_results.length + "개 ===");
          for (const item of data.organic_results.slice(0, 5)) {
            const snippet = (item.snippet || "").slice(0, 300);
            const title = item.title || "";
            if (snippet.length > 20) {
              allTexts.push(title + ": " + snippet);
            }
            const link = item.link?.trim();
            if (link && !seenUrl.has(link)) {
              seenUrl.add(link);
              urls.push({ url: link, title });
            }
          }
        } else {
          console.log(
            "=== SerpAPI organic_results 없음! error: " +
              JSON.stringify(data.error || "없음").slice(0, 200) +
              " ==="
          );
        }
      } catch {
        /* ignore */
      }
    })
  );

  console.log(
    "=== 百度 " +
      Math.min(queries.length, 4) +
      "개 검색 → 결과 " +
      allTexts.length +
      "개, URL " +
      urls.length +
      "개 ==="
  );
  return { lines: allTexts, urls };
}

// ═══ SerpAPI 네이버 검색 ═══
async function searchNaver(
  query: string
): Promise<Array<{ title: string; desc: string; source: string; link: string }>> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  try {
    const url = `https://serpapi.com/search.json?engine=naver&query=${encodeURIComponent(query)}&api_key=${apiKey}`;
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

async function perplexitySearch(
  searchQueryZh: string,
  userMessage: string,
  processedMessage: string,
  strategy: SearchStrategyRow,
  shopDictData: ShopEntry[],
  sendStatus: (text: string) => void,
  userLocation: { lat: number; lng: number } | null
): Promise<{ searchContext: string; totalSources: number; amapResults: AmapPoi[] }> {
  let searchContext = "";
  let totalSources = 0;
  const savedReviewIds: number[] = [];
  const savedShopIds: number[] = [];

  sendStatus("🔍 관련 정보 검색중...");

  let amapResults: AmapPoi[] = [];

  // 1) 高德
  if (strategy.useAmap) {
    sendStatus("🗺️ 가게 상세 정보 검색중...");
    console.log("=== 高德 검색 시작 ===");
    const amapOptions: AmapSearchOptions = { sortrule: 2, offset: 20 };
    if (strategy.amapType) amapOptions.types = strategy.amapType;
    if (userLocation) {
      amapOptions.location = `${userLocation.lng},${userLocation.lat}`;
      amapOptions.sortrule = 1;
    }

    amapResults = await amapSearch(searchQueryZh, "青岛", amapOptions);
    const amapN = amapResults?.length ?? 0;
    console.log("=== 高德 검색 완료: " + amapN + "개 ===");
    if (amapResults && amapResults.length > 0) {
      searchContext += "\n=== 가게 상세 정보 (高德地图) ===\n";
      for (const poi of amapResults.slice(0, 20)) {
        const shortName = (poi.name || "").split("(")[0].split("（")[0].trim();
        const dictMatch = shopDictData.find((s) => {
          const dZh = (s.zh || "").split("(")[0].split("（")[0].trim();
          return dZh === shortName || shortName.includes(dZh) || dZh.includes(shortName);
        });
        const korName = dictMatch ? dictMatch.koreanNames[0] : "";
        const displayName = korName ? korName + "(" + poi.name + ")" : poi.name;
        searchContext +=
          displayName +
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
      totalSources += amapResults.length;

      for (const poi of amapResults.slice(0, 20)) {
        const sid = await cacheShop(
          {
            name_zh: poi.name,
            address: poi.address,
            tel: poi.tel,
            rating: poi.rating,
            cost: poi.cost,
            openTime: poi.openTime ? String(poi.openTime) : "",
            lat: poi.location ? poi.location.split(",")[1] : "",
            lng: poi.location ? poi.location.split(",")[0] : "",
          },
          "amap",
          processedMessage
        );
        if (sid) savedShopIds.push(sid);
      }
    }
  } else {
    console.log("=== 高德 검색 스킵 (useAmap false) ===");
  }

  // 2) SerpAPI 百度
  console.log("=== SerpAPI 百度 검색 시작 ===");
  const baiduPack = await searchBaiduMulti(
    searchQueryZh,
    strategy.baidu,
    process.env.SERPAPI_KEY || ""
  );
  const baiduResult = { texts: baiduPack.lines, urls: baiduPack.urls };
  console.log(
    "=== SerpAPI 百度 검색 완료: 스니펫 " +
      baiduResult.texts.length +
      "개, URL " +
      baiduResult.urls.length +
      "개 ==="
  );

  if (baiduResult.texts.length > 0) {
    searchContext += "=== 검색 결과 요약 ===\n";
    searchContext += baiduResult.texts.join("\n") + "\n\n";
    totalSources += baiduResult.texts.length;
  }

  // 3) DB review_cache
  try {
    const searchTerms = searchQueryZh
      .replace(/区/g, "")
      .replace(/市/g, "")
      .split(/\s+/)
      .filter((t) => t.length >= 2);
    const userTerms = userMessage
      .replace(/[을를이가에서으로해줘알려줘추천]/g, "")
      .split(/\s+/)
      .filter((t) => t.length >= 2);
    const allTerms = Array.from(new Set([...searchTerms, ...userTerms]));
    console.log("=== DB 리뷰 검색 키워드: " + allTerms.join(", ") + " ===");

    let whereClause = allTerms
      .map(() => "(review_text LIKE ? OR shop_name LIKE ?)")
      .join(" OR ");
    let params: string[] = allTerms.flatMap((t) => ["%" + t + "%", "%" + t + "%"]);

    if (allTerms.length === 0) {
      whereClause = "1=1";
      params = [];
    }

    const [dbReviewsRows] = await pool.query(
      "SELECT shop_name, review_text, source FROM review_cache WHERE " +
        whereClause +
        " ORDER BY cached_at DESC LIMIT 200",
      params
    );
    const dbReviews = dbReviewsRows as RowDataPacket[];
    console.log("=== DB 리뷰 " + (Array.isArray(dbReviews) ? dbReviews.length : 0) + "개 검색됨 ===");
    if (Array.isArray(dbReviews) && dbReviews.length > 0) {
      searchContext += "\n=== BabaBang 축적 데이터 (小红书/네이버 등) ===\n";
      for (const r of dbReviews) {
        const row = r as { shop_name?: string; review_text?: string; source?: string };
        searchContext +=
          "[" +
          String(row.source ?? "") +
          "] " +
          (row.shop_name || "") +
          ": " +
          String(row.review_text ?? "").slice(0, 300) +
          "\n";
      }
      totalSources += dbReviews.length;
    }
  } catch (e) {
    console.log("=== DB 리뷰 검색 실패 ===", e);
  }

  // 4) 네이버
  let naverKeyword1 = userMessage;
  if (/[\u4e00-\u9fff]/.test(naverKeyword1)) {
    naverKeyword1 = naverKeyword1
      .replace(/城阳/g, "청양")
      .replace(/青岛/g, "칭다오")
      .replace(/市南/g, "시난")
      .replace(/市北/g, "시베이")
      .replace(/黄岛/g, "황다오")
      .replace(/崂山/g, "라오산")
      .replace(/李沧/g, "리창")
      .replace(/即墨/g, "즉묵");
  }

  const removeWords = [
    "에서",
    "으로",
    "해줘",
    "알려줘",
    "추천",
    "좀",
    "요",
    "부탁",
    "디테일하게",
    "디테일",
    "상세하게",
    "상세히",
    "자세하게",
    "자세히",
    "많이",
    "전부",
    "다",
    "좀더",
    "제발",
    "빨리",
    "급해",
    "급합니다",
    "합니다",
    "합니다만",
    "인데",
    "인데요",
    "거든",
    "거든요",
    "는데",
    "는데요",
    "어디",
    "뭐",
    "뭘",
    "어떤",
    "어떻게",
    "싶어",
    "싶은데",
    "하고싶어",
    "갈만한",
    "괜찮은",
    "좋은",
    "맛있는",
    "유명한",
  ];
  for (const w of removeWords) {
    naverKeyword1 = naverKeyword1.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), " ");
  }
  naverKeyword1 = naverKeyword1.replace(/\s+/g, " ").trim();

  if (!naverKeyword1.includes("중국")) {
    naverKeyword1 = "중국 " + naverKeyword1;
  }

  if (!naverKeyword1.includes("칭다오") && !naverKeyword1.includes("청도")) {
    naverKeyword1 = naverKeyword1.replace("중국 ", "중국 칭다오 ");
  }

  const naverKeyword2 = naverKeyword1
    .replace(/칭다오/g, "청도")
    .replace(/청양/g, "성양")
    .replace(/시난/g, "시남")
    .replace(/시베이/g, "시북")
    .replace(/황다오/g, "황도")
    .replace(/라오산/g, "노산")
    .replace(/리창/g, "이창")
    .replace(/즉묵/g, "지묵");

  console.log("=== 네이버 검색1: " + naverKeyword1 + " ===");
  console.log("=== 네이버 검색2: " + naverKeyword2 + " ===");

  console.log("=== 네이버 검색 시작 ===");
  sendStatus("🇰🇷 네이버 블로그 검색중...");
  const naver1 = await searchNaver(naverKeyword1);
  const naver2 = await searchNaver(naverKeyword2);
  const allNaverResults = [...naver1, ...naver2];

  const seenUrls = new Set<string>();
  const mergedNaver = allNaverResults.filter((item) => {
    if (seenUrls.has(item.link)) return false;
    seenUrls.add(item.link);
    return true;
  });

  const naverResults = mergedNaver.map((item) => ({
    title: stripHtml(item.title),
    desc: stripHtml(item.desc),
    source: item.source,
    link: item.link,
  }));
  console.log(
    "=== 네이버 검색 완료: " +
      naverResults.length +
      "개 (검색1: " +
      naver1.length +
      "개, 검색2: " +
      naver2.length +
      "개) ==="
  );
  if (naverResults.length > 0) {
    searchContext += "\n=== 한국인 후기 ===\n";
    for (const item of naverResults.slice(0, 10)) {
      searchContext += "[" + item.source + "] " + item.title + ": " + item.desc.slice(0, 300) + "\n";
    }
    searchContext += "\n";
    totalSources += naverResults.length;
  }

  // 5) Crawl4AI (firecrawlScrape)
  const blockedDomains = [
    "dianping.com",
    "xiaohongshu.com",
    "meituan.com",
    "douyin.com",
    "baidu.com/sf",
  ];

  const crawlableUrls = baiduResult.urls
    .filter((item) => item.url && item.url.startsWith("http"))
    .filter((item) => !blockedDomains.some((d) => item.url.includes(d)))
    .slice(0, 5);

  if (crawlableUrls.length > 0) {
    console.log("=== Crawl4AI 크롤링 시작 ===");
    console.log("=== Crawl4AI 대상 URL " + crawlableUrls.length + "개 ===");
    sendStatus("📄 " + crawlableUrls.length + "개 페이지 전문 크롤링중...");

    const crawled = await Promise.all(
      crawlableUrls.map(async (item, i) => {
        sendStatus("📄 [" + (i + 1) + "/" + crawlableUrls.length + "] 크롤링중...");
        const content = await firecrawlScrape(item.url);
        return { content, url: item.url, title: item.title };
      })
    );

    const fullTexts = crawled.filter((c) => c.content.length > 200);
    console.log(
      "=== Crawl4AI 크롤링 완료: 원문 " +
        crawled.length +
        "개 중 전문(200자+) " +
        fullTexts.length +
        "개 ==="
    );
    if (fullTexts.length > 0) {
      searchContext += "\n=== 상세 전문 정보 (출처 포함) ===\n";
      fullTexts.forEach((item, i) => {
        searchContext +=
          "[출처 " +
          (i + 1) +
          "] " +
          item.title +
          "\nURL: " +
          item.url +
          "\n" +
          item.content.slice(0, 3000) +
          "\n\n";
      });
      totalSources += fullTexts.length;

      for (const item of fullTexts) {
        const rid = await cacheReview(
          {
            text: item.content.slice(0, 5000),
            url: item.url,
            language: "zh",
          },
          searchQueryZh,
          "firecrawl",
          processedMessage
        );
        if (rid) savedReviewIds.push(rid);
      }
    }
  } else {
    console.log("=== Crawl4AI 크롤링 스킵 (크롤 가능 URL 0개) ===");
  }

  // 6) shopDict
  console.log("=== shopDict 매칭 시작 ===");
  const matchedShops = shopDictData.filter((s) => {
    return (
      s.koreanNames.some((name) => name.length >= 2 && userMessage.includes(name)) ||
      Boolean(
        s.zh && searchQueryZh.includes(s.zh.split("(")[0].split("（")[0].trim())
      )
    );
  });
  if (matchedShops.length > 0) {
    searchContext += "\n=== BabaBang 등록 업체 ===\n";
    for (const s of matchedShops) {
      searchContext += s.zh + " (한국어: " + s.koreanNames.join(",") + ")\n";
    }
  }
  console.log("=== shopDict 매칭 완료: " + matchedShops.length + "개 ===");

  // 7) knowledge_base
  console.log("=== knowledge_base 검색 시작 ===");
  try {
    const slice = userMessage.slice(0, 20);
    const like = "%" + slice + "%";
    const [kbRows] = await pool.query(
      "SELECT title, content FROM knowledge_base WHERE is_active = TRUE AND (content LIKE ? OR title LIKE ?) LIMIT 3",
      [like, like]
    );
    const kbList = kbRows as RowDataPacket[];
    console.log("=== knowledge_base 검색 완료: " + kbList.length + "개 ===");
    if (kbList.length > 0) {
      searchContext += "\n=== BabaBang 지식 베이스 ===\n";
      for (const kb of kbList) {
        searchContext +=
          "[" + String(kb.title) + "]\n" + String(kb.content ?? "").slice(0, 1500) + "\n\n";
      }
    }
  } catch (e) {
    console.log("=== knowledge_base 검색 실패 ===", e);
  }

  sendStatus("📊 총 " + totalSources + "개 소스에서 답변 생성중...");

  await cacheSearchResult(
    processedMessage,
    searchContext.slice(0, 3000),
    savedShopIds,
    savedReviewIds,
    totalSources
  );

  return {
    searchContext,
    totalSources,
    amapResults: amapResults || [],
  };
}

export async function POST(request: Request) {
  let body: {
    messages?: unknown;
    localShops?: unknown;
    userId?: unknown;
    userLocation?: unknown;
    cacheMaxAgeDays?: unknown;
    uiLang?: unknown;
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
        if (Math.random() < 0.01) {
          try {
            await pool.query(
              "DELETE FROM search_cache WHERE cached_at < DATE_SUB(NOW(), INTERVAL 7 DAY)"
            );
            await pool.query(
              "DELETE FROM review_cache WHERE cached_at < DATE_SUB(NOW(), INTERVAL 30 DAY)"
            );
            console.log("=== 오래된 캐시 정리 완료 ===");
          } catch {
            /* ignore */
          }
        }

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

        const shopListText = shopDictData
          .filter((s) => Boolean(s.zh?.trim()))
          .map((s) => `${s.zh} = ${s.koreanNames.join(",")}`)
          .join("\n");

        let searchQueryZh = processedMessage;
        let bababangDbLines: string[] = [];
        let uniquePois: AmapPoi[] = [];
        let shopAmapResults: AmapPoi[] = [];
        let newsResults: string[] = [];
        let needsNews = false;
        let totalSources = 0;
        let searchContext = "";
        let usedCache = false;
        let amapOpts: AmapSearchOptions = userLocation
          ? { sortrule: 1, offset: 20, location: `${userLocation.lng},${userLocation.lat}` }
          : { sortrule: 2, offset: 20 };

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
          const matchedShopsForQuery = findAllShops(processedMessage, shopDictData);
          if (matchedShopsForQuery.length > 0 && matchedShopsForQuery[0].zh) {
            searchQueryZh = matchedShopsForQuery[0].zh;
            console.log("=== shopDict 매칭: " + searchQueryZh + " ===");
          } else {
            const hasKorean = /[가-힣]/.test(processedMessage);
            if (hasKorean) {
              sendStatus("🔍 검색 키워드 추출중...");
              try {
                const transRes = await fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
                  signal: AbortSignal.timeout(8000),
                  body: JSON.stringify({
                    model: "gpt-4o-mini",
                    temperature: 0,
                    max_tokens: 200,
                    messages: [
                      {
                        role: "user",
                        content: keywordExtractPrompt + "\n\n" + processedMessage,
                      },
                    ],
                  }),
                });
                const transData = (await transRes.json()) as {
                  choices?: Array<{ message?: { content?: string } }>;
                };
                const extracted = transData.choices?.[0]?.message?.content?.trim();
                if (extracted && extracted.length > 0) {
                  searchQueryZh = extracted;
                  console.log("=== 키워드 추출: " + processedMessage + " → " + searchQueryZh + " ===");
                }
              } catch {
                console.log("=== 키워드 추출 실패, 원문 사용 ===");
              }
            }
          }

          const queryCategory = detectCategory(userMessage);
          console.log("=== 질문 카테고리: " + queryCategory + " ===");
          const strategy = searchStrategy[queryCategory] || searchStrategy["일반"];

          console.log("=== 검색 키워드: 高德/百度=" + searchQueryZh + ", 네이버=" + processedMessage + " ===");

          amapOpts = (() => {
            const base: AmapSearchOptions = { sortrule: 2, offset: 20 };
            if (strategy.amapType) base.types = strategy.amapType;
            if (userLocation) {
              base.sortrule = 1;
              base.location = `${userLocation.lng},${userLocation.lat}`;
            }
            return base;
          })();

          const px = await perplexitySearch(
            searchQueryZh,
            userMessage,
            processedMessage,
            strategy,
            shopDictData,
            sendStatus,
            userLocation
          );

          searchContext = px.searchContext;
          totalSources = px.totalSources;

          const naverEmpty = new Map<string, number>();
          const shopDictNamesForScore = new Set(
            shopDictData
              .map((s) => s.zh?.split("(")[0]?.split("（")[0]?.trim())
              .filter((x): x is string => Boolean(x))
          );
          uniquePois = px.amapResults.map((p) => {
            const nameBase = p.name?.split("(")[0]?.split("（")[0]?.trim() || "";
            const isInDict = shopDictNamesForScore.has(nameBase);
            return {
              ...p,
              _score: calculateShopScore(p, naverEmpty, isInDict),
            };
          });
          uniquePois.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));

          shopAmapResults = [];
          newsResults = [];
          needsNews = false;

          bababangDbLines = await fetchBababangDbContext(processedMessage);
          if (bababangDbLines.length > 0) {
            searchContext += "\n\n=== BabaBang 유저 등록 정보 (가장 신뢰도 높음) ===\n";
            searchContext += bababangDbLines.join("\n");
            totalSources += bababangDbLines.length;
          }

          searchContext +=
            "\n\n=== BabaBang 등록 업체 목록 (355개, 중국어이름=한국어이름) ===\n" + shopListText;

          console.log("=== 분석 보고서 길이: " + searchContext.length + "자 ===");
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

=== 절대 규칙 ===
1. 검색 데이터에 없는 전화번호, 주소, 영업시간을 절대 만들어내지 마.
2. 모르면 '정확한 정보를 찾지 못했어요. 직접 확인이 필요해요' 라고 솔직하게 말해.
3. 검색 데이터에 있는 정보만 답변해. 추측하지 마.
4. 전화번호는 검색 결과에 명확히 있을 때만 알려줘.
5. 가게 추천시 검색 데이터에 있는 가게만 추천해. 데이터에 없는 가게를 추천하지 마.
6. 가게 정보 답변시 반드시 이 형식으로:
   가게명(中文名) ⭐평점
   📍 주소 (검색 데이터에 있을때만)
   📞 전화 (검색 데이터에 있을때만)
   💰 인당 XX위안 (검색 데이터에 있을때만)
   🕐 영업시간 (검색 데이터에 있을때만)
   정보 없는 항목은 표시하지 마.

=== 당신의 성격 ===
- 칭다오에 10년 이상 거주한 전문가
- 법률, 의료, 비자, 부동산, 사업, 교육 등 모든 분야에 정통
- 현실적이고 실전적인 조언을 줌
- 핵심을 먼저 말하고 구체적인 방법을 알려줌
- 한국인 교민의 입장에서 공감하면서 답변

=== 답변 스타일 ===
1. 핵심 먼저: 결론/해결책을 맨 처음에
2. 구체적 행동: "이렇게 해" 라고 단계별로
3. 현실적 조언: 중국에서의 실제 경험 기반
4. 중국어 병기: 중요한 용어는 한국어(中文) 형태로
5. 비용/시간 포함: 대략적인 비용, 소요시간 알려줘
6. 주의사항: 교민이 자주 실수하는 점 경고
7. 연락처: 관련 기관/병원/업체 번호, 주소

=== 답변 형식 규칙 ===
1. 출처 표시 하지마. 📚 참고 출처 같은 거 절대 쓰지마.
2. 말풍선이나 인용 형식 쓰지마. 깔끔한 텍스트로 정리해.
3. 가게/장소/기관 이름은 반드시 한국어(中文) 형태로 병기해.
   예: 깡통집(缸桶屋), 출입경관리국(出入境管理局), 한향복(韩香福)
4. 한국어 이름을 모르면 AI가 자연스럽게 번역해서 병기해.
   예: 中文만 있으면 → 번역한국어(中文原名) 형태로
   张氏烤肉 → 장씨바베큐(张氏烤肉)
   老北京涮肉 → 노베이징샤브샤브(老北京涮肉)
5. 자연스러운 텍스트로 정리. 번호 매기는 건 OK.
6. 이모지는 항목 앞에만 적절히 사용.

가게 이름 형식:
- shopDict에 한국어명이 있으면: 한국어명(中文名)
- 없으면: AI가 자연스럽게 한국어로 번역(中文原名)
- 절대 중국어만 쓰지 마. 반드시 한국어를 같이 써.

=== 답변 내용 규칙 ===
1. 검색 데이터가 부족해도 최대한 유용한 정보를 제공해.
2. 高德 데이터에 있는 모든 가게를 활용해. 3개만 추천하지 마. 데이터에 있는 만큼 다 추천해. 최소 5개.
3. 각 가게마다 다른 포인트를 강조해:
   - 평점이 높으면 평점 강조
   - 가격이 저렴하면 가성비 강조
   - 영업시간이 늦으면 야간 영업 강조
4. 검색 데이터의 리뷰/후기가 있으면 핵심 내용을 언급해:
   '네이버 블로그에서 양꼬치가 맛있다는 후기가 많아요'
5. 마지막에 실용적인 팁 한 줄 추가:
   '💡 팁: 청양구는 저녁시간에 줄이 길 수 있어서 예약 추천!'
6. 검색 데이터에서 전문 크롤링된 내용이 있으면 그 내용을 우선적으로 활용해. 스니펫보다 전문이 더 정확해.

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

=== 체크리스트 규칙 ===
유저가 다음 키워드를 사용하면 반드시 □ 체크리스트 형태로 답변해:
- '준비물', '어떻게 해', '방법', '절차', '과정', '필요한 것', '뭐 필요', '연장', '개설', '등록', '신청', '만들기'

체크리스트 형식:
□ 항목1 (구체적 설명)
□ 항목2 (구체적 설명)
□ 항목3 (구체적 설명)

마지막에 관련 기관:
📍 기관명: 주소
🕐 업무시간
📞 전화번호
💡 팁: 현실적인 조언

=== 답변 길이/상세도 규칙 ===
1. 최대한 길고 상세하게 답변해. 짧게 요약하지 마.
2. 아는 정보는 전부 다 말해. 생략하지 마.
3. 최소 800자 이상 답변해. 1500자 이상이면 더 좋아.
4. 검색 데이터에 있는 내용은 전부 활용해서 답변에 포함시켜.
5. 맛집 추천이면 데이터에 있는 가게 전부 추천해. 5개로 제한하지 마.
6. 절차/방법 질문이면 단계별로 상세하게. 각 단계마다 구체적 설명 포함.
7. 관련된 추가 정보도 자발적으로 알려줘. 유저가 안 물어봐도.
8. 비용, 소요시간, 준비물, 주의사항 등 실용 정보 꼭 포함.
9. 실제 교민들의 경험담이 DB에 있으면 인용해서 알려줘: '실제 교민 후기에 따르면...'
10. 마지막에 관련 팁이나 주의사항 꼭 추가.${userInterestsLine}`;

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
10. 출처 표시·📚 참고 출처·플랫폼 나열 금지
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
            max_tokens: 3000,
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

        try {
          const { logText } = await import("@/lib/textLogger");
          const uiLang =
            typeof body.uiLang === "string" && (body.uiLang === "ko" || body.uiLang === "zh")
              ? body.uiLang
              : "ko";
          await logText({
            userId: chatUserId,
            type: "chat",
            inputText: userMessage,
            outputText: fullContentForUser,
            inputLang: uiLang,
            outputLang: uiLang,
          });
        } catch (logErr) {
          console.error("text_logs chat:", logErr);
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
