"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Sparkles, Undo2 } from "lucide-react";
import { useStore } from "@/stores/useStore";
import type { Post } from "@/types";
import { MediaUploadArea, type MediaItem } from "@/components/common/MediaUploadArea";

const categories = ["생활정보", "맛집", "비자", "육아", "비즈니스", "자유"] as const;

export function WritePostModal() {
  const {
    writePostOpen,
    closeWritePost,
    addPost,
    setActiveTab,
    user,
    lang,
    triggerPostsRefresh,
    currentUserId,
  } = useStore();
  const [category, setCategory] = useState<(typeof categories)[number]>("생활정보");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [aiPolishing, setAiPolishing] = useState(false);
  const [aiOriginalContent, setAiOriginalContent] = useState("");
  const [aiState, setAiState] = useState<"idle" | "ai" | "restored">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!writePostOpen) {
      setAiState("idle");
      setAiOriginalContent("");
    }
  }, [writePostOpen]);

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

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const next: MediaItem[] = [...mediaItems];
    for (let i = 0; i < files.length && next.length < 5; i++) {
      const f = files[i];
      next.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setMediaItems(next.slice(0, 5));
    e.target.value = "";
  };

  const removeMedia = (idx: number) => {
    setMediaItems((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      if (removed) URL.revokeObjectURL(removed.preview);
      return copy;
    });
  };

  const handleAiHelperClick = async () => {
    if (aiState === "ai") {
      setContent(aiOriginalContent);
      setAiState("restored");
      return;
    }
    if (!content.trim() && !title.trim()) return;
    setAiOriginalContent(content);
    setAiPolishing(true);
    try {
      const res = await fetch("/api/ai-write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "post",
          data: { title: title.trim(), content: content.trim() },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { content?: string };
      if (res.ok && typeof data.content === "string" && data.content.trim()) {
        setContent(data.content.trim());
        setAiState("ai");
      }
    } finally {
      setAiPolishing(false);
    }
  };

  if (!writePostOpen) return null;

  const uploadMediaToOss = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < mediaItems.length; i++) {
      setUploadingIndex(i);
      setUploadProgress(`업로드 중... (${i + 1}/${mediaItems.length})`);
      const fd = new FormData();
      fd.append("file", mediaItems[i].file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "업로드 실패");
      urls.push(data.url as string);
    }
    setUploadingIndex(null);
    setUploadProgress(null);
    return urls;
  };

  const onSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    let imagesCsv = "";
    try {
      if (mediaItems.length > 0) {
        const urls = await uploadMediaToOss();
        imagesCsv = urls.join(",");
      }
    } catch {
      setUploadingIndex(null);
      setUploadProgress(null);
      return;
    }

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
      images: imagesCsv || undefined,
    };
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId ?? 1,
          category,
          title: title.trim(),
          content: content.trim(),
          tags: tagsText.trim(),
          images: imagesCsv || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { tags?: string; success?: boolean };
      if (res.ok) {
        triggerPostsRefresh();
        const hadManualTags = tagsText.trim().length > 0;
        const aiTags =
          data.tags != null && String(data.tags).trim() !== "" ? String(data.tags).trim() : "";
        if (!hadManualTags && aiTags) {
          setTagsText(aiTags);
          await new Promise((r) => setTimeout(r, 500));
        }
      } else {
        addPost(post);
      }
    } catch {
      addPost(post);
    }
    mediaItems.forEach((m) => URL.revokeObjectURL(m.preview));
    setMediaItems([]);
    closeWritePost();
    setActiveTab("community");
    setCategory("생활정보");
    setTitle("");
    setContent("");
    setTagsText("");
    setAiState("idle");
    setAiOriginalContent("");
  };

  const isBusy = !!uploadProgress || uploadingIndex !== null;

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
          disabled={isBusy || aiPolishing}
          className="px-3 py-1.5 rounded-lg bg-accent text-white text-sm disabled:opacity-50"
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

        <button
          type="button"
          onClick={() => void handleAiHelperClick()}
          disabled={aiPolishing || isBusy}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-[#6c5ce7] text-sm font-medium text-[#6c5ce7] disabled:opacity-50 ${
            aiState === "ai" ? "bg-[rgba(108,92,231,0.05)]" : "bg-white"
          }`}
        >
          {aiPolishing ? (
            <Sparkles className="w-4 h-4 text-[#6c5ce7]" />
          ) : aiState === "ai" ? (
            <Undo2 className="w-4 h-4 text-[#6c5ce7]" />
          ) : (
            <Sparkles className="w-4 h-4 text-[#6c5ce7]" />
          )}
          {aiPolishing
            ? "AI 작성 중..."
            : aiState === "ai"
              ? "원본으로 되돌리기"
              : aiState === "restored"
                ? "AI 다시 작성하기"
                : "AI 작성 도우미"}
        </button>

        <MediaUploadArea
          mediaItems={mediaItems}
          onPick={onPickFiles}
          onRemove={removeMedia}
          fileInputRef={fileInputRef}
          accept="image/*,video/*"
          uploadProgress={uploadProgress}
          uploadingIndex={uploadingIndex}
          allowVideoPreview
        />

        <input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="태그를 입력하세요 (쉼표로 구분)"
          className="w-full rounded-xl bg-white px-4 py-3 text-sm outline-none border border-black/10"
        />
        <p className="text-[12px] text-black/40 -mt-2">
          태그를 안 쓰면 AI가 자동으로 생성해요 ✨
        </p>
      </div>
    </motion.div>
  );
}
