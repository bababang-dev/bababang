import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { userId, shopName, reportType, detail } = await request.json();
    await pool.query(
      "INSERT INTO shop_reports (user_id, shop_name, report_type, detail) VALUES (?, ?, ?, ?)",
      [userId || 1, shopName, reportType, detail || null]
    );
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const [rows] = await pool.query("SELECT * FROM shop_reports ORDER BY created_at DESC");
    return NextResponse.json({ reports: rows });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
