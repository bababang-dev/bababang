import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import pool from "@/lib/db";

type UserRow = RowDataPacket & {
  id: number;
  nickname: string;
  avatar: string;
  plan: "free" | "premium";
  tokens: number;
  language: "ko" | "zh";
};

export async function POST(request: Request) {
  try {
    const { phone, nickname, avatar, language } = (await request.json()) as {
      phone?: string | null;
      nickname?: string;
      avatar?: string;
      language?: string;
    };
    if (!nickname || nickname.trim().length < 1) {
      return NextResponse.json({ error: "닉네임을 입력해주세요" }, { status: 400 });
    }

    const phoneVal = phone?.trim() || null;
    const av = avatar || "👤";
    const lang = language || "ko";

    if (phoneVal) {
      const [existing] = (await pool.query("SELECT id FROM users WHERE phone = ?", [phoneVal])) as [
        RowDataPacket[],
        unknown,
      ];
      if (Array.isArray(existing) && existing.length > 0) {
        const id = (existing[0] as { id: number }).id;
        await pool.query(
          "UPDATE users SET nickname = ?, avatar = ?, language = ? WHERE id = ?",
          [nickname.trim(), av, lang, id]
        );
        const [rows] = (await pool.query(
          "SELECT id, nickname, avatar, plan, tokens, language FROM users WHERE id = ?",
          [id]
        )) as [UserRow[], unknown];
        const u = rows[0];
        return NextResponse.json({
          success: true,
          user: {
            id: u.id,
            nickname: u.nickname,
            avatar: u.avatar,
            plan: u.plan,
            tokens: u.tokens,
            language: u.language,
          },
        });
      }
    }

    const [result] = (await pool.query(
      "INSERT INTO users (nickname, avatar, language, phone, plan, tokens) VALUES (?, ?, ?, ?, 'free', 10)",
      [nickname.trim(), av, lang, phoneVal]
    )) as [ResultSetHeader, unknown];

    const insertId = result.insertId;

    return NextResponse.json({
      success: true,
      user: {
        id: insertId,
        nickname: nickname.trim(),
        avatar: av,
        plan: "free" as const,
        tokens: 10,
        language: lang,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
