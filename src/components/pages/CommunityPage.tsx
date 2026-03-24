"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/stores/useStore";
import { Header } from "@/components/layout/Header";
import { PostCard } from "@/components/cards/PostCard";
import { i18n } from "@/lib/i18n";
import { mockPosts } from "@/lib/mockData";
import { trackActivity } from "@/lib/trackActivity";
import type { Post, PostExtraData } from "@/types";

const categoryKeys = [
  "전체",
  "자유",
  "익명",
  "중고거래",
  "구인구직",
  "맛집",
  "생활정보",
  "비자",
  "육아",
  "비즈니스",
] as const;

const categoryZhMap: Record<string, string> = {
  자유: "自由",
  익명: "匿名",
  중고거래: "二手",
  구인구직: "招聘",
  맛집: "美食",
  생활정보: "生活信息",
  비자: "签证",
  육아: "育儿",
  비즈니스: "商务",
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return Math.floor(diff / 60) + "분 전";
  if (diff < 86400) return Math.floor(diff / 3600) + "시간 전";
  return Math.floor(diff / 86400) + "일 전";
}

function parseExtraData(raw: unknown): PostExtraData | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const o = JSON.parse(raw) as PostExtraData;
      return typeof o === "object" && o != null ? o : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as PostExtraData;
  return null;
}

function mapApiRowToPost(p: Record<string, unknown>): Post {
  const category = String(p.category ?? "");
  const tagsStr = p.tags != null ? String(p.tags) : "";
  const tagsArr = tagsStr
    .split(",")
    .map((t: string) => t.trim())
    .filter(Boolean);
  const createdRaw = p.created_at != null ? String(p.created_at) : new Date().toISOString();
  const rel = formatTime(createdRaw);
  const extraData = parseExtraData(p.extra_data);
  return {
    id: String(p.id),
    category,
    categoryZh: categoryZhMap[category] ?? category,
    title: String(p.title ?? ""),
    titleZh: String(p.title ?? ""),
    content: String(p.content ?? ""),
    contentZh: String(p.content ?? ""),
    author: String((p as { nickname?: string; author?: string }).nickname || p.author || "익명"),
    avatar: String(p.avatar || "👤"),
    time: rel,
    timeZh: rel,
    views: Number(p.views ?? 0),
    comments: Number(p.comments_count ?? 0),
    likes: Number(p.likes ?? 0),
    tags: tagsArr,
    tagsZh: tagsArr,
    images:
      p.images != null && String(p.images).trim() !== ""
        ? String(p.images)
        : undefined,
    extraData,
  };
}

export function CommunityPage() {
  const [category, setCategory] = useState<(typeof categoryKeys)[number]>("전체");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang, postsRefreshTrigger, setPosts: setStorePosts } = useStore();
  const t = i18n[lang];

  useEffect(() => {
    let cancelled = false;
    async function loadPosts() {
      setLoading(true);
      try {
        const q =
          category !== "전체" ? "?category=" + encodeURIComponent(category) : "";
        const res = await fetch("/api/posts" + q);
        const data = await res.json();
        if (cancelled) return;
        if (data.posts && data.posts.length > 0) {
          const mapped = (data.posts as Record<string, unknown>[]).map((p) =>
            mapApiRowToPost(p)
          );
          setPosts(mapped);
          setStorePosts(mapped);
        } else {
          setPosts(mockPosts);
          setStorePosts(mockPosts);
        }
      } catch {
        if (!cancelled) {
          setPosts(mockPosts);
          setStorePosts(mockPosts);
        }
      }
      if (!cancelled) setLoading(false);
    }
    loadPosts();
    return () => {
      cancelled = true;
    };
  }, [category, postsRefreshTrigger]);

  const list =
    category === "전체"
      ? posts
      : posts.filter((p) => p.category === category);

  return (
    <div
      className="min-h-full min-h-screen bg-[#f5f6fa] text-black pb-24 scrollbar-thin"
      style={{ minHeight: "100%" }}
    >
      <Header titleKey="community" dark={false} />
      <div className="max-w-[430px] mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2"
        >
          <input
            type="search"
            placeholder={`${t.common.search}...`}
            className="w-full glass-light px-4 py-3 rounded-xl text-black/80 placeholder-black/50 text-sm outline-none border-2 border-transparent focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
          />
        </motion.div>

        <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-thin">
          {categoryKeys.map((key, i) => (
            <motion.button
              key={key}
              type="button"
              onClick={() => {
                if (key !== "전체") void trackActivity("click_category", key);
                setCategory(key);
              }}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium active:scale-[0.98] ${
                category === key ? "bg-accent text-white" : "bg-white/80 text-black/70"
              }`}
              whileTap={{ scale: 0.96 }}
            >
              {t.community.categories[i]}
            </motion.button>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <p className="text-center text-sm text-black/50 py-8">불러오는 중...</p>
          ) : (
            <AnimatePresence mode="popLayout">
              {list.map((post, i) => (
                <PostCard
                  key={post.id}
                  post={post}
                  dark={false}
                  staggerDelay={i * 0.05}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
