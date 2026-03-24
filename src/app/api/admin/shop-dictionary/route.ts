import { NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [rows] = (await pool.query(
      "SELECT * FROM shop_dictionary ORDER BY updated_at DESC"
    )) as unknown as [unknown[]];
    return NextResponse.json({ items: rows });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(request: Request) {
  try {
    const { nameZh, nameKo, category, district, address, phone, notes } = await request.json();
    if (!nameZh || !nameKo) {
      return NextResponse.json({ error: "중국어 이름과 한국어 이름 필수" }, { status: 400 });
    }

    const koreanNames = String(nameKo)
      .split(",")
      .map((n: string) => n.trim())
      .filter(Boolean);

    const [result] = await pool.query(
      "INSERT INTO shop_dictionary (name_zh, name_ko, category, district, address, phone, notes) VALUES (?,?,?,?,?,?,?)",
      [
        String(nameZh).trim(),
        JSON.stringify(koreanNames),
        category || "기타",
        district || "",
        address || "",
        phone || "",
        notes || "",
      ]
    );
    const header = result as ResultSetHeader;
    return NextResponse.json({ success: true, id: header.insertId });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: unknown;
      nameZh?: string;
      nameKo?: string;
      category?: string;
      district?: string;
      address?: string;
      phone?: string;
      notes?: string;
      isActive?: boolean;
    };

    const id = typeof body.id === "number" ? body.id : Number(body.id);
    if (!id || id < 1) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const koreanNames =
      body.nameKo !== undefined && body.nameKo !== null
        ? String(body.nameKo)
            .split(",")
            .map((n) => n.trim())
            .filter(Boolean)
        : undefined;

    const updates: string[] = [];
    const params: unknown[] = [];

    if (body.nameZh) {
      updates.push("name_zh = ?");
      params.push(body.nameZh.trim());
    }
    if (koreanNames !== undefined) {
      updates.push("name_ko = ?");
      params.push(JSON.stringify(koreanNames));
    }
    if (body.category !== undefined) {
      updates.push("category = ?");
      params.push(body.category);
    }
    if (body.district !== undefined) {
      updates.push("district = ?");
      params.push(body.district);
    }
    if (body.address !== undefined) {
      updates.push("address = ?");
      params.push(body.address);
    }
    if (body.phone !== undefined) {
      updates.push("phone = ?");
      params.push(body.phone);
    }
    if (body.notes !== undefined) {
      updates.push("notes = ?");
      params.push(body.notes);
    }
    if (body.isActive !== undefined) {
      updates.push("is_active = ?");
      params.push(body.isActive);
    }

    if (updates.length > 0) {
      params.push(id);
      await pool.query(`UPDATE shop_dictionary SET ${updates.join(", ")} WHERE id = ?`, params);
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    const nid = typeof id === "number" ? id : Number(id);
    if (!nid || nid < 1) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await pool.query("DELETE FROM shop_dictionary WHERE id = ?", [nid]);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "error" }, { status: 500 });
  }
}
