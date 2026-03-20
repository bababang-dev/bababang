import { NextResponse } from "next/server";
import pool from "@/lib/db";
import type { ResultSetHeader } from "mysql2";

export const dynamic = "force-dynamic";

// 게시글 목록
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    let query = `
      SELECT p.*, u.nickname as author, u.avatar 
      FROM posts p 
      LEFT JOIN users u ON p.user_id = u.id 
    `;
    const params: string[] = [];

    if (category && category !== "전체" && category !== "全部") {
      query += " WHERE p.category = ?";
      params.push(category);
    }

    query += " ORDER BY p.created_at DESC LIMIT 50";

    const [rows] = await pool.query(query, params);
    return NextResponse.json({ posts: rows });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}

// 게시글 작성
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, category, title, content, tags, images } = body as {
      userId?: number;
      category?: string;
      title?: string;
      content?: string;
      tags?: string;
      images?: string;
    };

    // AI 자동 태그 (태그가 없으면 DeepSeek으로 생성)
    let finalTags = tags;
    if (!finalTags || String(finalTags).trim() === "") {
      try {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (apiKey && title && content) {
          const tagRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
            body: JSON.stringify({
              model: "deepseek-chat",
              temperature: 0,
              max_tokens: 50,
              messages: [{
                role: "user",
                content:
                  "아래 글의 태그를 3~5개 생성해. 쉼표로 구분해서 태그만 답해. 다른 말 하지마.\n\n제목: " +
                  title +
                  "\n내용: " +
                  String(content).slice(0, 200),
              }],
            }),
          });
          const tagData = (await tagRes.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          finalTags = tagData.choices?.[0]?.message?.content?.trim() ?? "";
        }
      } catch {
        /* 태그 생성 실패해도 글은 저장 */
      }
    }

    const [result] = await pool.query(
      "INSERT INTO posts (user_id, category, title, content, tags, images) VALUES (?, ?, ?, ?, ?, ?)",
      [userId || 1, category, title, content, finalTags ?? "", images ?? null]
    );

    const header = result as ResultSetHeader;
    return NextResponse.json({ success: true, postId: header.insertId, tags: finalTags });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
