import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { userId, userMessage, aiResponse, feedback, feedbackReason } = await request.json();

    await pool.query(
      "INSERT INTO chat_history (user_id, user_message, ai_response, feedback, feedback_reason) VALUES (?, ?, ?, ?, ?)",
      [userId || 1, userMessage, aiResponse, feedback, feedbackReason || null]
    );

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
