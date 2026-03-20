import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import pool from "@/lib/db";

type ChatRow = RowDataPacket & {
  user_message: string;
  created_at: Date;
};

type PostRow = RowDataPacket & {
  title: string;
  created_at: Date;
};

/** 토큰 모달: 보유 토큰 + 최근 사용 내역(채팅 질문·글쓰기 합쳐 최대 10건) */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const [userRows] = (await pool.query("SELECT tokens FROM users WHERE id = ?", [
      userId,
    ])) as [RowDataPacket[], unknown];
    const tokens =
      Array.isArray(userRows) && userRows.length > 0
        ? Number((userRows[0] as { tokens: number }).tokens) || 0
        : 0;

    const [chatRows] = (await pool.query(
      "SELECT user_message, created_at FROM chat_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
      [userId]
    )) as [ChatRow[], unknown];

    const [postRows] = (await pool.query(
      "SELECT title, created_at FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
      [userId]
    )) as [PostRow[], unknown];

    type Item = { kind: "ai" | "post"; label: string; at: string };
    const items: Item[] = [];

    if (Array.isArray(chatRows)) {
      for (const row of chatRows) {
        const msg = (row.user_message || "").trim().split("\n")[0].slice(0, 80);
        items.push({
          kind: "ai",
          label: msg || "(질문)",
          at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        });
      }
    }
    if (Array.isArray(postRows)) {
      for (const row of postRows) {
        items.push({
          kind: "post",
          label: (row.title || "").trim().slice(0, 80) || "글쓰기",
          at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        });
      }
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const recent = items.slice(0, 10);

    return NextResponse.json({ tokens, items: recent });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: message, tokens: 0, items: [] }, { status: 500 });
  }
}
