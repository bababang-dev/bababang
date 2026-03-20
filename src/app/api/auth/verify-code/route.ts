import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import pool from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { phone, code } = (await request.json()) as { phone?: string; code?: string };

    if (code !== "123456") {
      return NextResponse.json({ error: "인증코드가 틀려요" }, { status: 400 });
    }

    const [existingUser] = (await pool.query("SELECT * FROM users WHERE phone = ?", [phone])) as [
      RowDataPacket[],
      unknown,
    ];

    if (Array.isArray(existingUser) && existingUser.length > 0) {
      return NextResponse.json({ success: true, isNewUser: false, user: existingUser[0] });
    }

    return NextResponse.json({ success: true, isNewUser: true, phone });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
