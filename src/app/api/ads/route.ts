import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const listAll = searchParams.get("list") === "1";
    if (listAll) {
      const [rows] = await pool.query(
        "SELECT * FROM ad_placements ORDER BY created_at DESC LIMIT 200"
      );
      return NextResponse.json({ ads: rows });
    }

    const category = searchParams.get("category") || "";
    let query =
      "SELECT * FROM ad_placements WHERE is_active = TRUE AND (end_date IS NULL OR end_date >= CURDATE())";
    const params: string[] = [];
    if (category) {
      query += " AND category = ?";
      params.push(category);
    }
    query += " ORDER BY RAND() LIMIT 2";
    const [rows] = await pool.query(query, params);
    return NextResponse.json({ ads: rows });
  } catch {
    return NextResponse.json({ ads: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const businessName = String(body.businessName ?? "");
    const businessNameZh = body.businessNameZh != null ? String(body.businessNameZh) : null;
    const category = String(body.category ?? "");
    const description = body.description != null ? String(body.description) : null;
    const address = body.address != null ? String(body.address) : null;
    const phone = body.phone != null ? String(body.phone) : null;
    const wechat = body.wechat != null ? String(body.wechat) : null;
    const images = body.images != null ? String(body.images) : null;
    const adType = String(body.adType ?? "card");
    const startDate = body.startDate != null ? String(body.startDate) : null;
    const endDate = body.endDate != null ? String(body.endDate) : null;

    const [result] = await pool.query(
      `INSERT INTO ad_placements (business_name, business_name_zh, category, description, address, phone, wechat, images, ad_type, start_date, end_date) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        businessName,
        businessNameZh,
        category,
        description,
        address,
        phone,
        wechat,
        images,
        adType,
        startDate || null,
        endDate || null,
      ]
    );
    return NextResponse.json({
      success: true,
      id: (result as { insertId: number }).insertId,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: number; is_active?: boolean };
    const id = typeof body.id === "number" ? body.id : Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json({ error: "is_active required" }, { status: 400 });
    }
    await pool.query("UPDATE ad_placements SET is_active = ? WHERE id = ?", [body.is_active, id]);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
