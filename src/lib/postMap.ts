import type { Post } from "@/types";

const categoryZhMap: Record<string, string> = {
  생활정보: "生活信息",
  맛집: "美食",
  비자: "签证",
  육아: "育儿",
  비즈니스: "商务",
  자유: "自由",
};

function formatTime(created: Date): { time: string; timeZh: string } {
  const now = Date.now();
  const diff = now - created.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (hours < 1) return { time: "방금 전", timeZh: "刚刚" };
  if (hours < 24) return { time: `${hours}시간 전`, timeZh: `${hours}小时前` };
  if (days < 7) return { time: `${days}일 전`, timeZh: `${days}天前` };
  return {
    time: created.toLocaleDateString("ko-KR"),
    timeZh: created.toLocaleDateString("zh-CN"),
  };
}

/** DB row from GET /api/posts (JOIN users) */
export function mapDbRowToPost(row: Record<string, unknown>): Post {
  const id = String(row.id);
  const category = String(row.category ?? "");
  const title = String(row.title ?? "");
  const content = String(row.content ?? "");
  const author = String(row.author ?? row.nickname ?? "익명");
  const tagsStr = row.tags != null ? String(row.tags) : "";
  const tagsArr = tagsStr
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const created = row.created_at
    ? new Date(String(row.created_at))
    : new Date();
  const { time, timeZh } = formatTime(created);

  return {
    id,
    category,
    categoryZh: categoryZhMap[category] ?? category,
    title,
    titleZh: title,
    author,
    avatar: "/avatars/me.jpg",
    time,
    timeZh,
    views: Number(row.views ?? 0),
    comments: Number(row.comments_count ?? 0),
    likes: Number(row.likes ?? 0),
    content,
    contentZh: content,
    tags: tagsArr,
    tagsZh: tagsArr,
  };
}

export function mapDbRowsToPosts(rows: unknown[]): Post[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => mapDbRowToPost(r as Record<string, unknown>));
}
