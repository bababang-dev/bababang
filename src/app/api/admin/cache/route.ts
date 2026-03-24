import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { hashQuery } from "@/lib/searchCache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "shops";

    if (type === "shops") {
      const [rows] = await pool.query(
        "SELECT id, name_zh, name_ko, address, rating, source, cached_at, trust_score FROM shop_cache ORDER BY cached_at DESC LIMIT 100"
      );
      return NextResponse.json({ items: rows });
    }

    if (type === "reviews") {
      const [rows] = await pool.query(
        "SELECT id, shop_name, review_text, source, language, is_verified, is_reported, cached_at, trust_score, search_keyword FROM review_cache ORDER BY cached_at DESC LIMIT 100"
      );
      return NextResponse.json({ items: rows });
    }

    if (type === "searches") {
      const [rows] = await pool.query(
        "SELECT id, query_text, total_sources, cached_at FROM search_cache ORDER BY cached_at DESC LIMIT 100"
      );
      return NextResponse.json({ items: rows });
    }

    return NextResponse.json({ items: [] });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { type?: unknown; id?: unknown };
    const type = typeof body.type === "string" ? body.type : "";
    const id = typeof body.id === "number" ? body.id : Number(body.id);
    if (!id || id < 1) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const table =
      type === "shops" ? "shop_cache" : type === "reviews" ? "review_cache" : type === "searches" ? "search_cache" : "";
    if (!table) {
      return NextResponse.json({ error: "invalid type" }, { status: 400 });
    }
    await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      type?: unknown;
      id?: unknown;
      action?: unknown;
      searchKeyword?: unknown;
    };
    const type = typeof body.type === "string" ? body.type : "";
    const action = typeof body.action === "string" ? body.action : "";
    const id = typeof body.id === "number" ? body.id : Number(body.id);

    if (action === "report") {
      const searchKeyword =
        typeof body.searchKeyword === "string" ? body.searchKeyword.trim().slice(0, 200) : "";
      if (!searchKeyword) {
        return NextResponse.json({ error: "searchKeyword required" }, { status: 400 });
      }
      const hash = hashQuery(searchKeyword);
      await pool.query("DELETE FROM search_cache WHERE query_hash = ? OR query_text = ?", [
        hash,
        searchKeyword,
      ]);
      const kw = searchKeyword.slice(0, 200);
      await pool.query(
        "UPDATE review_cache SET trust_score = GREATEST(COALESCE(trust_score, 50) - 10, 0) WHERE search_keyword = ?",
        [kw]
      );
      await pool.query(
        "UPDATE review_cache SET is_reported = TRUE WHERE search_keyword = ? AND COALESCE(trust_score, 50) < 20",
        [kw]
      );
      return NextResponse.json({ success: true });
    }

    if (type !== "reviews" || !id || id < 1) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }

    if (action === "verify") {
      await pool.query(
        "UPDATE review_cache SET is_verified = TRUE, is_reported = FALSE WHERE id = ?",
        [id]
      );
      return NextResponse.json({ success: true });
    }
    if (action === "reject") {
      await pool.query("DELETE FROM review_cache WHERE id = ?", [id]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
