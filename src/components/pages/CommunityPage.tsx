"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/stores/useStore";
import { Header } from "@/components/layout/Header";
import { PostCard } from "@/components/cards/PostCard";
import { mockPosts } from "@/lib/mockData";
import { i18n } from "@/lib/i18n";

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
  const { lang } = useStore();
  const t = i18n[lang];
  const list =
    filter === "전체"
      ? mockPosts
      : mockPosts.filter((p) => p.category === filter);

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
    </div>
  );
}
