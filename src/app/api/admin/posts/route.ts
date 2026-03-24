import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [rows] = (await pool.query(
      `SELECT p.id, p.title, p.category, p.created_at, p.user_id,
        COALESCE(p.report_count, 0) as report_count,
        u.nickname as author_nickname
       FROM posts p
       LEFT JOIN users u ON p.user_id = u.id
       ORDER BY p.created_at DESC
       LIMIT 200`
    )) as unknown as [
      Array<{
        id: number;
        title: string;
        category: string;
        created_at: Date;
        user_id: number | null;
        report_count: number;
        author_nickname: string | null;
      }>,
    ];
    return NextResponse.json({ posts: rows });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: unknown };
    const id = typeof body.id === "number" ? body.id : Number(body.id);
    if (!id || id < 1) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await pool.query("DELETE FROM posts WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
