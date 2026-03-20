import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { userId, nickname, avatar } = await request.json();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const updates: string[] = [];
    const params: unknown[] = [];

    if (nickname) {
      updates.push("nickname = ?");
      params.push(nickname);
    }
    if (avatar) {
      updates.push("avatar = ?");
      params.push(avatar);
    }

    if (updates.length > 0) {
      params.push(userId);
      await pool.query("UPDATE users SET " + updates.join(", ") + " WHERE id = ?", params);
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
