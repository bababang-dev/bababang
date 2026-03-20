import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "1";

    const [posts] = (await pool.query("SELECT COUNT(*) as cnt FROM posts WHERE user_id = ?", [
      userId,
    ])) as [{ cnt: number }[], unknown];
    const [bookmarks] = (await pool.query("SELECT COUNT(*) as cnt FROM bookmarks WHERE user_id = ?", [
      userId,
    ])) as [{ cnt: number }[], unknown];
    const [comments] = (await pool.query("SELECT COUNT(*) as cnt FROM comments WHERE user_id = ?", [
      userId,
    ])) as [{ cnt: number }[], unknown];
    const [likes] = (await pool.query(
      "SELECT COUNT(*) as cnt FROM chat_history WHERE user_id = ? AND feedback = 'good'",
      [userId]
    )) as [{ cnt: number }[], unknown];

    return NextResponse.json({
      posts: posts[0]?.cnt ?? 0,
      bookmarks: bookmarks[0]?.cnt ?? 0,
      comments: comments[0]?.cnt ?? 0,
      likes: likes[0]?.cnt ?? 0,
    });
  } catch {
    return NextResponse.json({ posts: 0, bookmarks: 0, comments: 0, likes: 0 });
  }
}
