"use client";

import { motion } from "framer-motion";
import { Eye, MessageCircle, Heart, X } from "lucide-react";
import { useStore } from "@/stores/useStore";
import { mockPosts } from "@/lib/mockData";

export function PostDetail() {
  const { detailView, setDetailView, lang } = useStore();
  const postId = detailView && detailView.startsWith("p") ? detailView : null;
  const post = postId ? mockPosts.find((p) => p.id === postId) : null;

  if (!post) return null;

  const category = lang === "zh" ? post.categoryZh : post.category;
  const title = lang === "zh" ? post.titleZh : post.title;
  const time = lang === "zh" ? post.timeZh : post.time;
  const content = lang === "zh" ? post.contentZh : post.content;
  const tags = lang === "zh" ? post.tagsZh : post.tags;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[60] max-w-mobile mx-auto"
        onClick={() => setDetailView(null)}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[61] max-w-mobile mx-auto rounded-t-3xl bg-baba-light text-black max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-black/5">
          <span className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent">
            {category}
          </span>
          <motion.button
            type="button"
            onClick={() => setDetailView(null)}
            className="p-2 rounded-full hover:bg-black/5"
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>
        <div className="overflow-y-auto p-4 scrollbar-thin">
          <h2 className="font-outfit text-lg font-semibold">{title}</h2>
          <div className="flex items-center gap-2 mt-2 text-sm text-black/60">
            <span>{post.author}</span>
            <span>·</span>
            <span>{time}</span>
          </div>
          <div className="flex items-center gap-4 mt-3 text-sm text-black/60">
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {post.views}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-4 h-4" />
              {post.comments}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              {post.likes}
            </span>
          </div>
          <p className="mt-4 text-black/90 leading-relaxed">{content}</p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 rounded-lg bg-black/5 text-xs"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
