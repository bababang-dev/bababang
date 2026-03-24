import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [users] = (await pool.query("SELECT COUNT(*) as cnt FROM users")) as unknown as [
      Array<{ cnt: number }>,
    ];
    const [posts] = (await pool.query("SELECT COUNT(*) as cnt FROM posts")) as unknown as [
      Array<{ cnt: number }>,
    ];
    const [todayPosts] = (await pool.query(
      "SELECT COUNT(*) as cnt FROM posts WHERE DATE(created_at) = CURDATE()"
    )) as unknown as [Array<{ cnt: number }>];
    const [shops] = (await pool.query("SELECT COUNT(*) as cnt FROM shop_cache")) as unknown as [
      Array<{ cnt: number }>,
    ];
    const [reviews] = (await pool.query("SELECT COUNT(*) as cnt FROM review_cache")) as unknown as [
      Array<{ cnt: number }>,
    ];
    const [searches] = (await pool.query("SELECT COUNT(*) as cnt FROM search_cache")) as unknown as [
      Array<{ cnt: number }>,
    ];
    const [ads] = (await pool.query(
      "SELECT COUNT(*) as cnt FROM ad_placements WHERE is_active = TRUE"
    )) as unknown as [Array<{ cnt: number }>];
    const [tokens] = (await pool.query(
      "SELECT COALESCE(SUM(amount),0) as total FROM token_transactions WHERE type='earn' AND DATE(created_at) = CURDATE()"
    )) as unknown as [Array<{ total: number }>];

    return NextResponse.json({
      totalUsers: users[0]?.cnt ?? 0,
      totalPosts: posts[0]?.cnt ?? 0,
      todayPosts: todayPosts[0]?.cnt ?? 0,
      cachedShops: shops[0]?.cnt ?? 0,
      cachedReviews: reviews[0]?.cnt ?? 0,
      cachedSearches: searches[0]?.cnt ?? 0,
      activeAds: ads[0]?.cnt ?? 0,
      todayTokens: Number(tokens[0]?.total ?? 0),
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
