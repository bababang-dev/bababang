"use client";

import { motion } from "framer-motion";
import { MessageCircle, Eye, Heart, Bookmark } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { useStore } from "@/stores/useStore";
import { trackActivity } from "@/lib/trackActivity";
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
  const { lang, togglePostBookmark, setDetailView, requireLogin } = useStore();
  const isBookmarked = useStore((s) => s.bookmarkedPosts.has(post.id));
  const [translated, setTranslated] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const category = lang === "zh" ? post.categoryZh : post.category;
  const title = lang === "zh" ? post.titleZh : post.title;
  const time = lang === "zh" ? post.timeZh : post.time;
  const content = lang === "zh" ? post.contentZh : post.content;
  const isAnonCategory = post.category === "익명";
  const displayAuthor = isAnonCategory ? "익명" : post.author;
  const isChineseText = /[\u4e00-\u9fff]/.test(content);
  const imageUrls = post.images
    ? post.images.split(",").map((u) => u.trim()).filter(Boolean)
    : [];
  const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

  const onTranslate = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (translated || isTranslating) return;
    setIsTranslating(true);
    try {
      const targetLang = isChineseText ? "ko" : "zh";
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content, targetLang }),
      });
      const data = await res.json().catch(() => ({}));
      setTranslated(data.translated ?? "");
    } finally {
      setIsTranslating(false);
    }
  };

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
      onClick={() => {
        if (!requireLogin()) return;
        const tid =
          typeof post.id === "string" && /^\d+$/.test(post.id)
            ? parseInt(post.id, 10)
            : parseInt(String(post.id).replace(/\D/g, ""), 10) || undefined;
        void trackActivity("view_post", post.category, post.title, tid);
        setDetailView(post.id);
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* 상단: 좌측 아바타+작성자+시간 / 우측 카테고리 배지 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-outfit font-semibold text-lg overflow-hidden ${
              dark ? "bg-white/10 text-white" : "bg-accent/20 text-accent"
            }`}
          >
            {isAnonCategory ? (
              <span className="text-xl leading-none" aria-hidden>
                🎭
              </span>
            ) : /^https?:\/\//i.test(post.avatar) ? (
              <img src={post.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              (post.avatar || displayAuthor).slice(0, 1)
            )}
          </div>
          <div className="min-w-0">
            <p
              className={`font-medium truncate text-sm ${
                dark ? "text-white" : "text-black"
              }`}
            >
              {displayAuthor}
            </p>
            <p className="text-xs opacity-60">{time}</p>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              dark ? "bg-accent/30 text-accent" : "bg-accent/20 text-accent"
            }`}
          >
            {category}
          </span>
          {post.category === "중고거래" && post.extraData?.price ? (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gold/25 text-gold">
              ¥{post.extraData.price}
            </span>
          ) : null}
          {post.category === "구인구직" && post.extraData?.jobType ? (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-black/10 text-black/80 dark:bg-white/15 dark:text-white/90">
              {post.extraData.jobType}
            </span>
          ) : null}
        </div>
      </div>
      {imageUrls.length > 0 && (
        <div
          className={`mt-2 ${imageUrls.length === 1 ? "" : "flex gap-2 overflow-x-auto pb-1 scrollbar-thin"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {imageUrls.length === 1 ? (
            <div className="relative w-full rounded-lg overflow-hidden max-h-48 bg-black/5">
              {isVideoUrl(imageUrls[0]) ? (
                <video src={imageUrls[0]} className="w-full max-h-48 object-cover" muted playsInline />
              ) : (
                <img src={imageUrls[0]} alt="" className="w-full max-h-48 object-cover" />
              )}
              {isVideoUrl(imageUrls[0]) && (
                <span className="absolute inset-0 flex items-center justify-center text-3xl pointer-events-none">
                  ▶️
                </span>
              )}
            </div>
          ) : (
            imageUrls.map((url) => (
              <div
                key={url}
                className="relative w-[150px] h-[100px] flex-shrink-0 rounded-lg overflow-hidden bg-black/5"
              >
                {isVideoUrl(url) ? (
                  <video src={url} className="w-full h-full object-cover" muted playsInline />
                ) : (
                  <img src={url} alt="" className="w-full h-full object-cover" />
                )}
                {isVideoUrl(url) && (
                  <span className="absolute inset-0 flex items-center justify-center text-2xl pointer-events-none">
                    ▶️
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
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
      {(translated || isTranslating) && (
        <div
          className={`mt-2 rounded-xl px-3 py-2 text-xs ${
            dark ? "bg-white/10 text-white/80" : "bg-black/5 text-black/70"
          }`}
        >
          {isTranslating ? "번역중..." : translated}
        </div>
      )}
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
          onClick={onTranslate}
          className="p-1 rounded-lg hover:bg-black/5"
          whileTap={{ scale: 0.9 }}
        >
          🔄 번역
        </motion.button>
        <motion.button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!requireLogin()) return;
            if (!isBookmarked) {
              const tid =
                typeof post.id === "string" && /^\d+$/.test(post.id)
                  ? parseInt(post.id, 10)
                  : parseInt(String(post.id).replace(/\D/g, ""), 10) || undefined;
              void trackActivity("bookmark", "post", post.title, tid);
            }
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
