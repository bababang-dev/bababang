import crypto from "crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "@/lib/db";

type SearchCacheRow = RowDataPacket & {
  query_hash: string;
  query_text: string;
  result_summary: string | null;
  shop_ids: string | null;
  review_ids: string | null;
  total_sources: number | null;
  cached_at: Date;
};

// 쿼리 해시 생성
export function hashQuery(query: string): string {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  return crypto.createHash("md5").update(normalized).digest("hex");
}

// 캐시에서 검색 결과 가져오기 (7일 이내)
export async function getCachedSearch(
  query: string
): Promise<{ cache: SearchCacheRow; shops: RowDataPacket[]; reviews: RowDataPacket[] } | null> {
  try {
    const hash = hashQuery(query);
    const [rows] = await pool.query(
      "SELECT * FROM search_cache WHERE query_hash = ? AND cached_at > DATE_SUB(NOW(), INTERVAL 7 DAY)",
      [hash]
    );
    const list = rows as SearchCacheRow[];
    if (!Array.isArray(list) || list.length === 0) return null;

    const cache = list[0];

    const shopIds = cache.shop_ids
      ? cache.shop_ids
          .split(",")
          .map((id) => Number(String(id).trim()))
          .filter((id) => Number.isFinite(id) && id > 0)
      : [];
    let shops: RowDataPacket[] = [];
    if (shopIds.length > 0) {
      const placeholders = shopIds.map(() => "?").join(",");
      const [shopRows] = await pool.query(`SELECT * FROM shop_cache WHERE id IN (${placeholders})`, shopIds);
      shops = shopRows as RowDataPacket[];
    }

    const reviewIds = cache.review_ids
      ? cache.review_ids
          .split(",")
          .map((id) => Number(String(id).trim()))
          .filter((id) => Number.isFinite(id) && id > 0)
      : [];
    let reviews: RowDataPacket[] = [];
    if (reviewIds.length > 0) {
      const placeholders = reviewIds.map(() => "?").join(",");
      const [reviewRows] = await pool.query(
        `SELECT * FROM review_cache WHERE id IN (${placeholders})`,
        reviewIds
      );
      reviews = reviewRows as RowDataPacket[];
    }

    console.log("=== 캐시 히트! 가게 " + shops.length + "개, 리뷰 " + reviews.length + "개 ===");
    return { cache, shops, reviews };
  } catch (e) {
    console.log("=== 캐시 조회 실패 ===", e);
    return null;
  }
}

// 가게 정보 캐시에 저장
export async function cacheShop(
  shop: Record<string, unknown>,
  source: "amap" | "baidu" | "naver" | "serpapi" | "user",
  keyword: string
): Promise<number> {
  try {
    const nameZh = String(shop.name_zh ?? shop.name ?? "").trim();
    if (!nameZh) return 0;

    const ratingRaw = shop.rating;
    const ratingNum =
      ratingRaw !== undefined && ratingRaw !== null && String(ratingRaw).trim() !== ""
        ? Number.parseFloat(String(ratingRaw))
        : null;
    const ratingVal = ratingNum !== null && Number.isFinite(ratingNum) ? ratingNum : null;

    const [existing] = await pool.query(
      "SELECT id FROM shop_cache WHERE name_zh = ? AND source = ?",
      [nameZh, source]
    );
    const ex = existing as RowDataPacket[];
    if (Array.isArray(ex) && ex.length > 0) {
      await pool.query(
        "UPDATE shop_cache SET address=?, phone=?, rating=?, cost=?, open_time=?, lat=?, lng=?, cached_at=NOW() WHERE id=?",
        [
          shop.address ?? null,
          shop.phone ?? shop.tel ?? null,
          ratingVal,
          shop.cost ?? null,
          shop.open_time ?? shop.openTime ?? null,
          shop.lat ?? null,
          shop.lng ?? null,
          ex[0].id,
        ]
      );
      return Number(ex[0].id);
    }

    let photoUrls: string | null = null;
    if (Array.isArray(shop.photos)) {
      try {
        photoUrls = JSON.stringify(shop.photos);
      } catch {
        photoUrls = null;
      }
    }

    const [result] = await pool.query(
      `INSERT INTO shop_cache (name_zh, name_ko, address, phone, rating, cost, open_time, category, district, lat, lng, photo_urls, source, search_keyword) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        nameZh,
        shop.name_ko ?? shop.koreanName ?? null,
        shop.address ?? null,
        shop.phone ?? shop.tel ?? null,
        ratingVal,
        shop.cost ?? null,
        shop.open_time ?? shop.openTime ?? null,
        shop.category ?? null,
        shop.district ?? null,
        shop.lat ?? null,
        shop.lng ?? null,
        photoUrls,
        source,
        keyword.slice(0, 200),
      ]
    );
    const header = result as ResultSetHeader;
    return header.insertId ?? 0;
  } catch (e) {
    console.log("=== 가게 캐시 저장 실패 ===", e);
    return 0;
  }
}

// 리뷰 캐시에 저장
export async function cacheReview(
  review: Record<string, unknown>,
  shopName: string,
  source:
    | "dianping"
    | "xiaohongshu"
    | "naver_blog"
    | "naver_cafe"
    | "zhihu"
    | "weibo"
    | "meituan"
    | "user",
  keyword: string
): Promise<number> {
  try {
    const text = String(review.text ?? review.desc ?? review.snippet ?? "").trim();
    if (!text) return 0;

    const ratingRaw = review.rating;
    const ratingNum =
      ratingRaw !== undefined && ratingRaw !== null && String(ratingRaw).trim() !== ""
        ? Number.parseFloat(String(ratingRaw))
        : null;
    const ratingVal = ratingNum !== null && Number.isFinite(ratingNum) ? ratingNum : null;

    const lang = review.language === "ko" || review.language === "en" ? review.language : "zh";

    const [result] = await pool.query(
      `INSERT INTO review_cache (shop_name, review_text, reviewer, rating, review_date, source, source_url, language, search_keyword) VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        shopName.slice(0, 200),
        text,
        review.reviewer ?? review.author ?? null,
        ratingVal,
        review.date ?? null,
        source,
        review.url ?? review.link ?? null,
        lang,
        keyword.slice(0, 200),
      ]
    );
    const header = result as ResultSetHeader;
    return header.insertId ?? 0;
  } catch {
    return 0;
  }
}

// 검색 결과 캐시에 저장
export async function cacheSearchResult(
  query: string,
  summary: string,
  shopIds: number[],
  reviewIds: number[],
  totalSources: number
): Promise<void> {
  try {
    const hash = hashQuery(query);
    await pool.query(
      `INSERT INTO search_cache (query_hash, query_text, result_summary, shop_ids, review_ids, total_sources) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE result_summary=VALUES(result_summary), shop_ids=VALUES(shop_ids), review_ids=VALUES(review_ids), total_sources=VALUES(total_sources), cached_at=NOW()`,
      [
        hash,
        query.slice(0, 500),
        summary,
        shopIds.join(","),
        reviewIds.join(","),
        totalSources,
      ]
    );
    console.log("=== 검색 결과 캐시 저장 완료 ===");
  } catch (e) {
    console.log("=== 검색 캐시 저장 실패 ===", e);
  }
}

// 가게명으로 리뷰 검색
export async function getCachedReviews(shopName: string): Promise<RowDataPacket[]> {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM review_cache WHERE shop_name LIKE ? ORDER BY cached_at DESC LIMIT 20",
      ["%" + shopName + "%"]
    );
    return rows as RowDataPacket[];
  } catch {
    return [];
  }
}
