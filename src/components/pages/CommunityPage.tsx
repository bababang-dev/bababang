"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PencilLine } from "lucide-react";
import { useStore } from "@/stores/useStore";
import { Header } from "@/components/layout/Header";
import { PostCard } from "@/components/cards/PostCard";
import { i18n } from "@/lib/i18n";
import { mockPosts } from "@/lib/mockData";
import { mapDbRowsToPosts } from "@/lib/postMap";

// 필터 값(한국어 키) - mockData category와 매칭
const categoryKeys = [
  "전체",
  "생활정보",
  "맛집",
  "비자",
  "육아",
  "비즈니스",
] as const;

export function CommunityPage() {
  const [filter, setFilter] = useState<(typeof categoryKeys)[number]>("전체");
  const { lang, posts, openWritePost, setPosts } = useStore();
  const t = i18n[lang];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const q =
          filter === "전체"
            ? ""
            : `?category=${encodeURIComponent(filter)}`;
        const res = await fetch(`/api/posts${q}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && Array.isArray(data.posts) && data.posts.length > 0) {
          setPosts(mapDbRowsToPosts(data.posts));
        } else {
          setPosts(mockPosts);
        }
      } catch {
        if (!cancelled) setPosts(mockPosts);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [filter, setPosts]);
  const list =
    filter === "전체"
      ? posts
      : posts.filter((p) => p.category === filter);

  return (
    <div
      className="min-h-full min-h-screen bg-[#f5f6fa] text-black pb-24 scrollbar-thin"
      style={{ minHeight: "100%" }}
    >
      <Header titleKey="community" dark={false} />
      <div className="max-w-[430px] mx-auto px-4">
        {/* 검색바 */}
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

        {/* 카테고리 칩: lang에 따라 라벨 표시 */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-thin">
          {categoryKeys.map((key, i) => (
            <motion.button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium active:scale-[0.98] ${
                filter === key
                  ? "bg-accent text-white"
                  : "bg-white/80 text-black/70"
              }`}
              whileTap={{ scale: 0.96 }}
            >
              {t.community.categories[i]}
            </motion.button>
          ))}
        </div>

        {/* 게시글 리스트 */}
        <div className="mt-6 space-y-3">
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
        </div>
      </div>
      <div className="fixed bottom-0 left-1/2 z-50 -translate-x-1/2 w-full max-w-[430px] h-0 pointer-events-none">
        <motion.button
          type="button"
          onClick={openWritePost}
          className="absolute right-[76px] rounded-full pointer-events-auto flex items-center justify-center"
          style={{
            bottom: 88,
            width: 56,
            height: 56,
            background: "linear-gradient(135deg, #8b7cf7 0%, #6c5ce7 100%)",
            boxShadow: "0 4px 24px rgba(108, 92, 231, 0.35)",
          }}
          whileTap={{ scale: 0.95 }}
        >
          <PencilLine className="w-6 h-6 text-white" />
        </motion.button>
      </div>
    </div>
  );
}
