import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import pool from "@/lib/db";

type UserRow = RowDataPacket & {
  id: number;
  nickname: string;
  avatar: string;
  phone?: string | null;
  plan: "free" | "premium";
  tokens: number;
  language: "ko" | "zh";
  created_at: Date;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const [rows] = (await pool.query(
      "SELECT id, nickname, avatar, phone, plan, tokens, language, created_at FROM users WHERE id = ?",
      [userId]
    )) as [UserRow[], unknown];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "유저 없음" }, { status: 404 });
    }
    return NextResponse.json({ user: rows[0] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
