import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [rows] = (await pool.query(
      `SELECT u.id, u.nickname, u.phone, u.avatar, u.tokens, u.role, u.created_at,
        (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count
       FROM users u ORDER BY u.created_at DESC`
    )) as unknown as [
      Array<{
        id: number;
        nickname: string;
        phone: string | null;
        avatar: string | null;
        tokens: number;
        role: string | null;
        created_at: Date;
        post_count: number;
      }>,
    ];

    const users = rows.map((u) => ({
      ...u,
      phone: u.phone ? u.phone.slice(0, 3) + "****" + u.phone.slice(-4) : "",
      role: u.role ?? "user",
    }));

    return NextResponse.json({ users });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { userId?: unknown; role?: unknown };
    const userId = typeof body.userId === "number" ? body.userId : Number(body.userId);
    const role = typeof body.role === "string" ? body.role : "";
    const allowed = new Set(["user", "admin", "master", "banned"]);
    if (!userId || userId < 1 || !allowed.has(role)) {
      return NextResponse.json({ error: "userId and valid role required" }, { status: 400 });
    }
    await pool.query("UPDATE users SET role = ? WHERE id = ?", [role, userId]);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
