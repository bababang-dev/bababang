"use client";

import { motion } from "framer-motion";
import { MessageCircle, Eye, Heart, Bookmark } from "lucide-react";
import { useStore } from "@/stores/useStore";
import type { Post } from "@/types";

interface PostCardProps {
  post: Post;
  dark?: boolean;
  staggerDelay?: number;
}

export function PostCard({
  post,
  dark = false,
  staggerDelay,
}: PostCardProps) {
  const { lang, togglePostBookmark, setDetailView } = useStore();
  const isBookmarked = useStore((s) => s.bookmarkedPosts.has(post.id));

  const category = lang === "zh" ? post.categoryZh : post.category;
  const title = lang === "zh" ? post.titleZh : post.title;
  const time = lang === "zh" ? post.timeZh : post.time;
  const content = lang === "zh" ? post.contentZh : post.content;

  const cardClass = dark
    ? "glass-card-dark rounded-2xl border border-white/10 overflow-hidden"
    : "glass-light rounded-2xl overflow-hidden";

  return (
    <motion.article
      layout
      initial={
        staggerDelay != null
          ? { opacity: 0, y: 12 }
          : { opacity: 1, y: 0 }
      }
      animate={{ opacity: 1, y: 0 }}
      transition={
        staggerDelay != null ? { delay: staggerDelay, duration: 0.25 } : {}
      }
      className={`${cardClass} p-4 cursor-pointer active:scale-[0.98] transition-transform`}
      onClick={() => setDetailView(post.id)}
      whileTap={{ scale: 0.98 }}
    >
      {/* 상단: 좌측 아바타+작성자+시간 / 우측 카테고리 배지 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-outfit font-semibold text-lg ${
              dark ? "bg-white/10 text-white" : "bg-accent/20 text-accent"
            }`}
          >
            {post.author.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p
              className={`font-medium truncate text-sm ${
                dark ? "text-white" : "text-black"
              }`}
            >
              {post.author}
            </p>
            <p className="text-xs opacity-60">{time}</p>
          </div>
        </div>
        <span
          className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
            dark
              ? "bg-accent/30 text-accent"
              : "bg-accent/20 text-accent"
          }`}
        >
          {category}
        </span>
      </div>
      <h3
        className={`font-outfit font-bold mt-2 line-clamp-1 text-base ${
          dark ? "text-white" : "text-black"
        }`}
      >
        {title}
      </h3>
      <p
        className={`text-sm mt-1 line-clamp-2 ${
          dark ? "text-white/60" : "text-black/70"
        }`}
      >
        {content}
      </p>
      <div
        className={`flex items-center gap-4 mt-3 text-xs ${
          dark ? "text-white/50" : "text-black/50"
        }`}
      >
        <span className="flex items-center gap-1">
          <Eye className="w-3.5 h-3.5" />
          {post.views}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="w-3.5 h-3.5" />
          {post.comments}
        </span>
        <span className="flex items-center gap-1">
          <Heart className="w-3.5 h-3.5" />
          {post.likes}
        </span>
        <motion.button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePostBookmark(post.id);
          }}
          className="ml-auto p-1 rounded-lg hover:bg-black/5"
          whileTap={{ scale: 0.9 }}
        >
          <motion.span
            key={isBookmarked ? "on" : "off"}
            initial={isBookmarked ? { scale: 1.35 } : { scale: 1 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 18,
            }}
            className="inline-block"
          >
            <Bookmark
              className="w-4 h-4"
              fill={isBookmarked ? "currentColor" : "none"}
            />
          </motion.span>
        </motion.button>
      </div>
    </motion.article>
  );
}
