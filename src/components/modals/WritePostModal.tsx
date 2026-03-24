"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Sparkles, Undo2 } from "lucide-react";
import { useStore } from "@/stores/useStore";
import type { Post } from "@/types";
import { MediaUploadArea, type MediaItem } from "@/components/common/MediaUploadArea";
import { useModalBodyLock } from "@/lib/useModalBodyLock";
import type { PostExtraData } from "@/types";

const categories = [
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

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs text-black/50 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`px-3 py-1.5 rounded-full text-xs ${
              value === o ? "bg-accent text-white" : "bg-white text-black/70 border border-black/10"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

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
    setUser,
  } = useStore();
  useModalBodyLock(writePostOpen);
  const [category, setCategory] = useState<(typeof categories)[number]>("자유");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [tradeType, setTradeType] = useState("");
  const [tradeRegion, setTradeRegion] = useState("");
  const [tradeCondition, setTradeCondition] = useState("");
  const [jobType, setJobType] = useState("");
  const [jobIndustry, setJobIndustry] = useState("");
  const [jobSalary, setJobSalary] = useState("");
  const [jobWorkRegion, setJobWorkRegion] = useState("");
  const [jobVisaReq, setJobVisaReq] = useState("");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [aiPolishing, setAiPolishing] = useState(false);
  const [aiOriginalContent, setAiOriginalContent] = useState("");
  const [aiState, setAiState] = useState<"idle" | "ai" | "restored">("idle");
  const [postSubmitToast, setPostSubmitToast] = useState<string | null>(null);
  const [tokenEarnedMark, setTokenEarnedMark] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryZh = useMemo(() => {
    const map: Record<string, string> = {
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
    return map[category] ?? "自由";
  }, [category]);

  useEffect(() => {
    if (!writePostOpen) {
      setPostSubmitToast(null);
      setTokenEarnedMark(false);
      setAiState("idle");
      setAiOriginalContent("");
      setTradePrice("");
      setTradeType("");
      setTradeRegion("");
      setTradeCondition("");
      setJobType("");
      setJobIndustry("");
      setJobSalary("");
      setJobWorkRegion("");
      setJobVisaReq("");
    }
  }, [writePostOpen]);

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

    let extraData: PostExtraData | null = null;
    if (category === "중고거래") {
      extraData = {
        price: tradePrice.trim(),
        tradeType: tradeType.trim(),
        region: tradeRegion.trim(),
        condition: tradeCondition.trim(),
      };
    } else if (category === "구인구직") {
      extraData = {
        jobType: jobType.trim(),
        industry: jobIndustry.trim(),
        salary: jobSalary.trim(),
        workRegion: jobWorkRegion.trim(),
        visaReq: jobVisaReq.trim(),
      };
    }

    const post: Post = {
      id: `p-${Date.now()}`,
      category,
      categoryZh,
      title: title.trim(),
      titleZh: title.trim(),
      author:
        category === "익명"
          ? "익명"
          : user
            ? lang === "zh"
              ? user.nameZh
              : user.name
            : "익명",
      avatar: category === "익명" ? "🎭" : user?.avatar ?? "/avatars/me.jpg",
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
      extraData: extraData && Object.values(extraData).some((v) => v) ? extraData : undefined,
    };

    const finishClose = () => {
      mediaItems.forEach((m) => URL.revokeObjectURL(m.preview));
      setMediaItems([]);
      closeWritePost();
      setActiveTab("community");
      setCategory("자유");
      setTitle("");
      setContent("");
      setTagsText("");
      setAiState("idle");
      setAiOriginalContent("");
      setPostSubmitToast(null);
      setTokenEarnedMark(false);
    };

    let tokenToast: string | null = null;
    let tokenEarned = false;

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
          extraData:
            extraData && Object.values(extraData).some((v) => v) ? extraData : undefined,
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
        const postContentForQuality = `${title.trim()}\n${content.trim()}`;
        try {
          const tr = await fetch("/api/tokens", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: currentUserId ?? 1,
              amount: 2,
              type: "earn",
              reason: "글쓰기",
              content: postContentForQuality,
            }),
          });
          const td = (await tr.json()) as {
            success?: boolean;
            message?: string;
            qualityFailed?: boolean;
            limited?: boolean;
            error?: string;
            tokens?: number;
          };
          if (td.qualityFailed && td.message) {
            tokenToast = td.message;
          } else if (td.limited && td.error) {
            tokenToast = td.error;
          } else if (td.success && td.message) {
            tokenToast = td.message;
            tokenEarned = true;
            if (typeof td.tokens === "number" && user) {
              setUser({ ...user, tokens: td.tokens });
            }
          }
        } catch {
          /* ignore token errors */
        }
      } else {
        addPost(post);
      }
    } catch {
      addPost(post);
    }

    if (tokenToast) {
      setPostSubmitToast(tokenToast);
      setTokenEarnedMark(tokenEarned);
      await new Promise((r) => setTimeout(r, 2200));
    }
    finishClose();
  };

  const isBusy = !!uploadProgress || uploadingIndex !== null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex flex-col bg-[#f5f6fa] text-black max-w-[430px] mx-auto"
    >
      <div className="h-14 shrink-0 px-4 flex items-center justify-between border-b border-black/10">
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
      <div className="shrink-0 px-4 py-1.5 border-b border-black/5 flex items-center justify-between gap-2">
        <p className="text-[11px] text-[#a29bfe] flex-1 leading-snug">
          {lang === "zh"
            ? "若帖子通过质量审核，可获得 2 枚代币"
            : "이 글이 품질 기준을 통과하면 토큰 2개를 받아요"}
        </p>
        {tokenEarnedMark ? (
          <span className="text-[11px] font-medium text-accent whitespace-nowrap shrink-0">
            {lang === "zh" ? "已获得 ✓" : "토큰 받기 ✓"}
          </span>
        ) : null}
      </div>
      {postSubmitToast ? (
        <div className="shrink-0 mx-4 mt-2 mb-1 rounded-lg bg-black/80 text-white text-sm px-3 py-2 text-center">
          {postSubmitToast}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin -mx-1 px-1">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm ${
                category === c ? "bg-accent text-white" : "bg-white text-black/70"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {category === "중고거래" && (
          <div className="space-y-3 rounded-xl bg-white p-3 border border-black/10">
            <input
              value={tradePrice}
              onChange={(e) => setTradePrice(e.target.value)}
              placeholder="가격 (위안)"
              className="w-full rounded-xl bg-black/[0.03] px-3 py-2.5 text-sm outline-none border border-black/10"
            />
            <ChipRow
              label="거래방식"
              options={["직거래", "택배", "둘다"]}
              value={tradeType}
              onChange={setTradeType}
            />
            <input
              value={tradeRegion}
              onChange={(e) => setTradeRegion(e.target.value)}
              placeholder="거래 지역"
              className="w-full rounded-xl bg-black/[0.03] px-3 py-2.5 text-sm outline-none border border-black/10"
            />
            <ChipRow
              label="상태"
              options={["새상품", "거의새것", "사용감있음"]}
              value={tradeCondition}
              onChange={setTradeCondition}
            />
          </div>
        )}

        {category === "구인구직" && (
          <div className="space-y-3 rounded-xl bg-white p-3 border border-black/10">
            <ChipRow label="유형" options={["구인", "구직"]} value={jobType} onChange={setJobType} />
            <input
              value={jobIndustry}
              onChange={(e) => setJobIndustry(e.target.value)}
              placeholder="업종 (예: 무역, 식당, 교육)"
              className="w-full rounded-xl bg-black/[0.03] px-3 py-2.5 text-sm outline-none border border-black/10"
            />
            <input
              value={jobSalary}
              onChange={(e) => setJobSalary(e.target.value)}
              placeholder="급여 (예: 월 8000위안)"
              className="w-full rounded-xl bg-black/[0.03] px-3 py-2.5 text-sm outline-none border border-black/10"
            />
            <input
              value={jobWorkRegion}
              onChange={(e) => setJobWorkRegion(e.target.value)}
              placeholder="근무 지역"
              className="w-full rounded-xl bg-black/[0.03] px-3 py-2.5 text-sm outline-none border border-black/10"
            />
            <ChipRow
              label="비자조건"
              options={["무관", "취업비자", "학생비자가능"]}
              value={jobVisaReq}
              onChange={setJobVisaReq}
            />
          </div>
        )}

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
