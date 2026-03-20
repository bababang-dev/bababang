import { NextResponse } from "next/server";
import pool from "@/lib/db";
import type { ResultSetHeader } from "mysql2";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    let query = "SELECT * FROM promotions WHERE status = 'active'";
    const params: string[] = [];
    if (category) {
      query += " AND category = ?";
      params.push(category);
    }
    query += " ORDER BY created_at DESC LIMIT 50";
    const [rows] = await pool.query(query, params);
    return NextResponse.json({ promotions: rows });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      userId,
      category,
      businessName,
      businessNameZh,
      address,
      phone,
      wechat,
      description,
      images,
      templateData,
      tags,
    } = body as {
      userId?: number;
      category?: string;
      businessName?: string;
      businessNameZh?: string;
      address?: string;
      phone?: string;
      wechat?: string;
      description?: string;
      images?: string | null;
      templateData?: Record<string, unknown>;
      tags?: string;
    };

    // AI 자동 태그 (태그가 없으면 DeepSeek으로 생성) — posts API와 동일 패턴
    let finalTags = tags;
    if (!finalTags || String(finalTags).trim() === "") {
      try {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (apiKey && businessName && category) {
          const tagRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
            body: JSON.stringify({
              model: "deepseek-chat",
              temperature: 0,
              max_tokens: 50,
              messages: [
                {
                  role: "user",
                  content:
                    "아래 업체 홍보의 태그를 3~5개 생성해. 쉼표로 구분해서 태그만 답해. 다른 말 하지마.\n\n업체명: " +
                    String(businessName) +
                    "\n카테고리: " +
                    String(category) +
                    "\n소개: " +
                    String(description ?? "").slice(0, 200),
                },
              ],
            }),
          });
          const tagData = (await tagRes.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          finalTags = tagData.choices?.[0]?.message?.content?.trim() ?? "";
        }
      } catch {
        /* 태그 생성 실패해도 등록은 진행 */
      }
    }

    const [result] = await pool.query(
      `INSERT INTO promotions (user_id, category, business_name, business_name_zh, address, phone, wechat, description, images, template_data, tags) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        userId || 1,
        category,
        businessName,
        businessNameZh || null,
        address || null,
        phone || null,
        wechat || null,
        description || null,
        images || null,
        JSON.stringify(templateData || {}),
        finalTags ?? "",
      ]
    );
    const header = result as ResultSetHeader;
    return NextResponse.json({ success: true, id: header.insertId, tags: finalTags });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
