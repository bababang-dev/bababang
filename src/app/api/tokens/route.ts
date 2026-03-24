import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import pool from "@/lib/db";

type EarnRow = RowDataPacket & { total: number | string | null };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: number;
      amount?: number;
      type?: string;
      reason?: string;
      content?: string;
    };
    const userId = typeof body.userId === "number" ? body.userId : Number(body.userId);
    if (!userId || !Number.isFinite(userId)) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
    if (!amount || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount required" }, { status: 400 });
    }
    const type = body.type === "earn" || body.type === "spend" ? body.type : null;
    if (!type) {
      return NextResponse.json({ error: "type must be earn or spend" }, { status: 400 });
    }
    const reason = String(body.reason ?? "").trim() || "기타";
    const content = typeof body.content === "string" ? body.content : "";

    if (type === "earn") {
      const [todayEarned] = await pool.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM token_transactions WHERE user_id = ? AND type = 'earn' AND DATE(created_at) = CURDATE()",
        [userId]
      );
      const rows = todayEarned as EarnRow[];
      const totalRaw = rows[0]?.total ?? 0;
      const totalEarnedToday = Number(totalRaw) || 0;
      if (totalEarnedToday >= 20) {
        return NextResponse.json({
          error: "오늘 토큰 획득 상한(20)에 도달했어요!",
          limited: true,
        });
      }
    }

    let qualityPassed: boolean | null = type === "spend" ? null : true;
    if (
      type === "earn" &&
      content &&
      (reason === "글쓰기" || reason === "리뷰" || reason === "정보제보")
    ) {
      try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
          const checkRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
            signal: AbortSignal.timeout(5000),
            body: JSON.stringify({
              model: "gpt-4o-mini",
              temperature: 0,
              max_tokens: 10,
              messages: [
                {
                  role: "user",
                  content:
                    "이 글이 의미 있는 내용인지 판단해. 50자 이상이고 실제 정보가 있으면 'YES', 무의미하거나 스팸이면 'NO'만 답해.\n\n" +
                    content.slice(0, 300),
                },
              ],
            }),
          });
          const checkData = (await checkRes.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const verdict = checkData.choices?.[0]?.message?.content?.trim() || "";
          qualityPassed = verdict.toUpperCase().includes("YES");
        }
      } catch {
        qualityPassed = true;
      }

      if (!qualityPassed) {
        return NextResponse.json({
          success: false,
          qualityFailed: true,
          message: "글의 품질이 토큰 지급 기준에 미달해요. 더 자세한 내용을 작성해보세요!",
        });
      }
    }

    await pool.query(
      "INSERT INTO token_transactions (user_id, amount, type, reason, quality_passed) VALUES (?, ?, ?, ?, ?)",
      [userId, amount, type, reason, qualityPassed]
    );

    if (type === "earn") {
      await pool.query("UPDATE users SET tokens = tokens + ? WHERE id = ?", [amount, userId]);
    } else {
      await pool.query("UPDATE users SET tokens = GREATEST(tokens - ?, 0) WHERE id = ?", [
        amount,
        userId,
      ]);
    }

    const [userRows] = await pool.query("SELECT tokens FROM users WHERE id = ?", [userId]);
    const u = (userRows as RowDataPacket[])[0] as { tokens?: number } | undefined;
    const tokens = u?.tokens ?? 0;

    return NextResponse.json({
      success: true,
      tokens,
      qualityPassed: qualityPassed ?? true,
      message: type === "earn" && qualityPassed ? `토큰 ${amount}개를 받았어요! 🎉` : "",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
