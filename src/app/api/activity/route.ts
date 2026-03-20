import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

// 행동 기록
export async function POST(request: Request) {
  try {
    const { userId, activityType, category, keyword, targetId } = (await request.json()) as {
      userId?: number;
      activityType?: string;
      category?: string | null;
      keyword?: string | null;
      targetId?: number | null;
    };
    await pool.query(
      "INSERT INTO user_activity (user_id, activity_type, category, keyword, target_id) VALUES (?,?,?,?,?)",
      [userId || 1, activityType, category ?? null, keyword ?? null, targetId ?? null]
    );
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}

// 개인화 추천 가져오기
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "1";

    const [activities] = await pool.query(
      `
      SELECT category, keyword, activity_type, COUNT(*) as cnt
      FROM user_activity
      WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY category, keyword, activity_type
      ORDER BY cnt DESC
      LIMIT 20
    `,
      [userId]
    );

    const [topCategories] = await pool.query(
      `
      SELECT category, COUNT(*) as cnt
      FROM user_activity
      WHERE user_id = ? AND category IS NOT NULL AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY category
      ORDER BY cnt DESC
      LIMIT 5
    `,
      [userId]
    );

    const [topKeywords] = await pool.query(
      `
      SELECT keyword, COUNT(*) as cnt
      FROM user_activity
      WHERE user_id = ? AND keyword IS NOT NULL AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY keyword
      ORDER BY cnt DESC
      LIMIT 10
    `,
      [userId]
    );

    const [aiQuestions] = await pool.query(
      `
      SELECT user_message, created_at
      FROM chat_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `,
      [userId]
    );

    type Row = { category?: string; cnt?: number; keyword?: string; user_message?: string };
    const tc = topCategories as Row[];
    const tk = topKeywords as Row[];
    const aq = aiQuestions as Row[];

    return NextResponse.json({
      topCategories: tc.map((r) => ({ name: r.category ?? "", count: Number(r.cnt ?? 0) })),
      topKeywords: tk.map((r) => ({ name: r.keyword ?? "", count: Number(r.cnt ?? 0) })),
      recentQuestions: aq.map((r) => String(r.user_message ?? "")),
      totalActivities: (activities as Row[]).length,
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
