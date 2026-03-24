import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [rows] = (await pool.query(
      "SELECT id, title, file_type, category, is_active, created_at, LENGTH(content) as content_length FROM knowledge_base ORDER BY created_at DESC"
    )) as unknown as [
      Array<{
        id: number;
        title: string;
        file_type: string;
        category: string | null;
        is_active: number | boolean;
        created_at: Date;
        content_length: number;
      }>,
    ];
    return NextResponse.json({ items: rows });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: unknown;
      content?: unknown;
      fileType?: unknown;
      category?: unknown;
    };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content : "";
    if (!title || !content) {
      return NextResponse.json({ error: "title and content required" }, { status: 400 });
    }
    const fileType =
      body.fileType === "pdf" || body.fileType === "text" || body.fileType === "manual"
        ? body.fileType
        : "manual";
    const category =
      typeof body.category === "string" && body.category.trim() ? body.category.trim() : "일반";

    const [result] = (await pool.query(
      "INSERT INTO knowledge_base (title, content, file_type, category) VALUES (?, ?, ?, ?)",
      [title, content.slice(0, 500000), fileType, category]
    )) as unknown as [{ insertId?: number }];
    return NextResponse.json({ success: true, id: result.insertId });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: unknown; is_active?: unknown };
    const id = typeof body.id === "number" ? body.id : Number(body.id);
    if (!id || id < 1) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const isActive = Boolean(body.is_active);
    await pool.query("UPDATE knowledge_base SET is_active = ? WHERE id = ?", [isActive, id]);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: unknown };
    const id = typeof body.id === "number" ? body.id : Number(body.id);
    if (!id || id < 1) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await pool.query("DELETE FROM knowledge_base WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
