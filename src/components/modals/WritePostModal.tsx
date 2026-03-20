"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useStore } from "@/stores/useStore";
import type { Post } from "@/types";
import { mapDbRowsToPosts } from "@/lib/postMap";

const categories = ["생활정보", "맛집", "비자", "육아", "비즈니스", "자유"] as const;

export function WritePostModal() {
  const {
    writePostOpen,
    closeWritePost,
    addPost,
    setPosts,
    setActiveTab,
    user,
    lang,
  } = useStore();
  const [category, setCategory] = useState<(typeof categories)[number]>("생활정보");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsText, setTagsText] = useState("");

  const categoryZh = useMemo(() => {
    const map: Record<string, string> = {
      생활정보: "生活信息",
      맛집: "美食",
      비자: "签证",
      육아: "育儿",
      비즈니스: "商务",
      자유: "自由",
    };
    return map[category] ?? "生活信息";
  }, [category]);

  if (!writePostOpen) return null;

  const onSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const post: Post = {
      id: `p-${Date.now()}`,
      category,
      categoryZh,
      title: title.trim(),
      titleZh: title.trim(),
      author: user ? (lang === "zh" ? user.nameZh : user.name) : "익명",
      avatar: user?.avatar ?? "/avatars/me.jpg",
      time: "방금 전",
      timeZh: "刚刚",
      views: 0,
      comments: 0,
      likes: 0,
      content: content.trim(),
      contentZh: content.trim(),
      tags,
      tagsZh: tags,
    };
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: 1,
          category,
          title: title.trim(),
          content: content.trim(),
          tags: tagsText.trim(),
        }),
      });
      if (res.ok) {
        const listRes = await fetch("/api/posts");
        const listData = await listRes.json().catch(() => ({}));
        if (listRes.ok && Array.isArray(listData.posts) && listData.posts.length > 0) {
          setPosts(mapDbRowsToPosts(listData.posts));
        } else {
          addPost(post);
        }
      } else {
        addPost(post);
      }
    } catch {
      addPost(post);
    }
    closeWritePost();
    setActiveTab("community");
    setCategory("생활정보");
    setTitle("");
    setContent("");
    setTagsText("");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-[#f5f6fa] text-black max-w-[430px] mx-auto"
    >
      <div className="h-14 px-4 flex items-center justify-between border-b border-black/10">
        <button
          type="button"
          onClick={closeWritePost}
          className="p-2 rounded-full hover:bg-black/5"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="font-outfit font-semibold">글쓰기</h2>
        <button
          type="button"
          onClick={onSubmit}
          className="px-3 py-1.5 rounded-lg bg-accent text-white text-sm"
        >
          등록
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-56px)]">
        <div className="flex gap-2 overflow-x-auto">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-sm ${
                category === c ? "bg-accent text-white" : "bg-white text-black/70"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          className="w-full rounded-xl bg-white px-4 py-3 text-sm outline-none border border-black/10"
        />

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용을 입력하세요"
          className="w-full rounded-xl bg-white px-4 py-3 text-sm outline-none border border-black/10 min-h-[200px]"
        />

        <input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="태그를 입력하세요 (쉼표로 구분)"
          className="w-full rounded-xl bg-white px-4 py-3 text-sm outline-none border border-black/10"
        />
        <p className="text-xs text-black/40 -mt-2">
          태그를 안 쓰면 AI가 자동으로 생성해요
        </p>
      </div>
    </motion.div>
  );
}
