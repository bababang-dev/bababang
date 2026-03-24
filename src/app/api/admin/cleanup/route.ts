import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { masterPhone } = (await request.json()) as { masterPhone?: unknown };
    if (masterPhone !== "18514747772") {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const [masterUser] = (await pool.query("SELECT id FROM users WHERE phone = ?", [
      masterPhone,
    ])) as unknown as [Array<{ id: number }>];
    const masterId = masterUser[0]?.id;

    if (!masterId) {
      return NextResponse.json({ error: "master user not found" }, { status: 404 });
    }

    await pool.query("UPDATE users SET role = 'master' WHERE id = ?", [masterId]);

    await pool.query("DELETE FROM posts WHERE user_id != ?", [masterId]);

    await pool.query("DELETE FROM token_transactions WHERE user_id != ?", [masterId]);

    await pool.query("DELETE FROM users WHERE id != ?", [masterId]);

    return NextResponse.json({
      success: true,
      masterId,
      message: "다른 유저 모두 삭제, 마스터 설정 완료",
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
