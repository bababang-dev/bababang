"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, ThumbsUp, ThumbsDown } from "lucide-react";
import { useStore } from "@/stores/useStore";
import { i18n } from "@/lib/i18n";
import type { ShopEntry } from "@/lib/shopDict";
import type { ChatMessage } from "@/types";
import { ReportModal } from "@/components/modals/ReportModal";
import { openDidi } from "@/lib/deeplinks";
import { trackActivity } from "@/lib/trackActivity";
import { useModalBodyLock } from "@/lib/useModalBodyLock";


const FREE_QUOTA_MSG_PREFIX = "BB_UPGRADE_CTA\n";

const FREE_QUOTA_EXCEEDED_KO = `무료 질문 5회를 모두 사용하셨어요!

마지막 질문으로부터 24시간 후에 다시 5회 질문이 가능해요.

✨ 프리미엄으로 업그레이드하면:
- AI 질문 무제한
- AI 통역 (사진 번역)
- 음성 질문
- 상권 분석 (예정)
- 입시 상담 (예정)`;

const FREE_QUOTA_EXCEEDED_ZH = `您已用完 5 次免费提问。

自上次提问起满 24 小时后，可再次获得 5 次提问。

✨ 升级高级版可享：
- AI 提问无限
- AI 翻译（拍照翻译）
- 语音提问
- 商圈分析（即将上线）
- 升学咨询（即将上线）`;

/** localStorage 무료 AI 질문 5회 — 마지막 주기 첫 질문 시각 기준 24시간 후 리셋 */
function syncDailyAiDateAndCount(): number {
  if (typeof window === "undefined") return 0;
  const now = Date.now();
  let firstTime = parseInt(localStorage.getItem("bababang-ai-first-time") || "0", 10);
  const count = parseInt(localStorage.getItem("bababang-ai-count") || "0", 10);
  if (count > 0 && firstTime === 0) {
    firstTime = now;
    localStorage.setItem("bababang-ai-first-time", String(firstTime));
  }
  if (firstTime > 0 && now - firstTime > 24 * 60 * 60 * 1000) {
    localStorage.setItem("bababang-ai-count", "0");
    localStorage.setItem("bababang-ai-first-time", "0");
    return 0;
  }
  return count;
}

function bumpDailyAiCount() {
  if (typeof window === "undefined") return;
  const c = syncDailyAiDateAndCount();
  if (c === 0) {
    localStorage.setItem("bababang-ai-first-time", String(Date.now()));
  }
  localStorage.setItem("bababang-ai-count", String(c + 1));
}

function cleanResponse(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/```[^`]*```/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n?\[RECOMMEND:[^\]]+\]\s*/g, "")
    .replace(/\n{5,}/g, "\n\n\n")
    .trim();
}

const AD_CATEGORY_KEYWORDS: Record<string, string[]> = {
  맛집: ["맛집", "식당", "먹", "음식", "고기", "치킨", "국밥", "카페"],
  병원: ["병원", "의원", "치과", "아플", "진료"],
  부동산: ["집", "부동산", "임대", "아파트", "방"],
  교육: ["학교", "학원", "과외", "교육"],
  미용: ["미용", "헤어", "네일"],
};

function detectAdCategory(userMessage: string): string {
  for (const [cat, keywords] of Object.entries(AD_CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => userMessage.includes(k))) return cat;
  }
  return "";
}

type AdApiRow = {
  business_name?: string;
  business_name_zh?: string;
  address?: string;
  phone?: string;
  wechat?: string;
  images?: string;
};

function adRowToRecommendedShop(
  ad: AdApiRow
): NonNullable<ChatMessage["recommendedShops"]>[number] {
  const imgs =
    typeof ad.images === "string" && ad.images
      ? ad.images.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const wechat = ad.wechat?.trim();
  return {
    name: String(ad.business_name_zh || ad.business_name || "").trim() || "AD",
    koreanName: String(ad.business_name || "").trim(),
    address: String(ad.address || ""),
    tel: String(ad.phone || ""),
    rating: "",
    cost: "",
    openTime: wechat ? `WeChat: ${wechat}` : "",
    photos: imgs,
    lat: "",
    lng: "",
    isAd: true,
  };
}

function lineStartsWithEmoji(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  const firstChar = t.codePointAt(0) || 0;
  return firstChar > 0x1f000 || (firstChar >= 0x2600 && firstChar <= 0x27bf);
}

type AiSegment =
  | { type: "blank" }
  | { type: "text"; lines: string[] }
  | { type: "chips"; lines: string[] };

function segmentAiMessage(text: string): AiSegment[] {
  const rawLines = text.split(/\r?\n/);
  const segments: AiSegment[] = [];
  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    if (line.trim() === "") {
      segments.push({ type: "blank" });
      i++;
      continue;
    }
    if (lineStartsWithEmoji(line)) {
      const chipLines: string[] = [];
      while (i < rawLines.length) {
        const L = rawLines[i];
        if (L.trim() === "") break;
        if (!lineStartsWithEmoji(L)) break;
        chipLines.push(L.trim());
        i++;
      }
      segments.push({ type: "chips", lines: chipLines });
    } else {
      const textLines: string[] = [];
      while (i < rawLines.length) {
        const L = rawLines[i];
        if (L.trim() === "") break;
        if (lineStartsWithEmoji(L)) break;
        textLines.push(L);
        i++;
      }
      segments.push({ type: "text", lines: textLines });
    }
  }
  return segments;
}

function AiMessageContent({
  text,
  isStatusPhase,
  onChipTap,
}: {
  text: string;
  isStatusPhase: boolean;
  onChipTap: (line: string) => void;
}) {
  if (isStatusPhase) {
    return <>{text}</>;
  }
  const segs = segmentAiMessage(text);
  return (
    <>
      {segs.map((seg, segIdx) => {
        if (seg.type === "blank") {
          return <div key={segIdx} className="h-2 w-full shrink-0" />;
        }
        if (seg.type === "text") {
          return (
            <div key={segIdx} className="whitespace-pre-wrap break-words">
              {seg.lines.join("\n")}
            </div>
          );
        }
        return (
          <div key={segIdx} className="flex flex-wrap items-start">
            {seg.lines.map((line, li) => (
              <button
                key={li}
                type="button"
                onClick={() => onChipTap(line)}
                className="inline-flex items-center glass-dark cursor-pointer transition-all duration-200 m-[3px] rounded-[20px] px-[14px] py-2 text-[13px] text-white bg-[rgba(108,92,231,0.1)] hover:bg-[rgba(108,92,231,0.25)] border border-[rgba(108,92,231,0.3)]"
              >
                {line}
              </button>
            ))}
          </div>
        );
      })}
    </>
  );
}

const feedbackReasonsKo = ["정보가 틀림", "내용이 부족함", "엉뚱한 답변", "기타"] as const;
const feedbackReasonsZh = ["信息不准确", "内容不足", "答非所问", "其他"] as const;

const quickPrompts = [
  "quickFood",
  "quickVisa",
  "quickHospital",
  "quickRealty",
] as const;

async function persistFeedbackToDb(payload: {
  userId: number;
  userMessage: string;
  aiResponse: string;
  feedback: "good" | "bad";
  feedbackReason?: string;
}) {
  try {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* ignore */
  }
}

export function ChatPanel() {
  const {
    chatOpen,
    setChatOpen,
    chatMessages,
    addChatMessage,
    updateLastAiMessage,
    lang,
    user,
    canAskQuestion,
    incrementQuestion,
    deductToken,
    setUser,
    setMembershipOpen,
    addFeedback,
    incrementQuestionCount,
    openMapActionSheet,
    currentUserId,
    requireLogin,
    touchChatActivity,
  } = useStore();
  useModalBodyLock(chatOpen);
  const [quotaVersion, setQuotaVersion] = useState(0);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamReplyStarted, setStreamReplyStarted] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const chatPendingPrompt = useStore((s) => s.chatPendingPrompt);
  const setChatPendingPrompt = useStore((s) => s.setChatPendingPrompt);
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {});
  const [toast, setToast] = useState("");
  const [feedbackMap, setFeedbackMap] = useState<Record<number, "good" | "bad">>(
    {}
  );
  const [reasonPickerFor, setReasonPickerFor] = useState<number | null>(null);
  const [reportShop, setReportShop] = useState<
    NonNullable<ChatMessage["recommendedShops"]>[number] | null
  >(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAiUserMessageRef = useRef("");
  const t = i18n[lang].chat;
  const tokens = user?.tokens ?? 0;
  const isFree = user?.plan === "free";
  const atDailyLimit = isFree && !canAskQuestion();

  const toastThanksGood =
    lang === "zh" ? "谢谢！我们会努力回答得更好 🙂" : "감사합니다! 더 좋은 답변 드릴게요 😊";
  const toastBadPrompt =
    lang === "zh" ? "抱歉。哪一点不太满意？" : "죄송해요. 어떤 점이 아쉬웠나요?";
  const toastFeedbackOk =
    lang === "zh" ? "我们会参考您的意见！" : "의견 반영할게요!";
  const toastReportThanks =
    lang === "zh" ? "感谢举报！我们会尽快处理。" : "신고해주셔서 감사합니다! 확인 후 반영할게요.";

  useEffect(() => {
    if (chatOpen) setQuotaVersion((v) => v + 1);
  }, [chatOpen]);

  useEffect(() => {
    if (!chatOpen) return;
    const last = useStore.getState().lastChatTime;
    if (last != null && Date.now() - last > 30 * 60 * 1000) {
      useStore.getState().clearChatMessages();
    }
  }, [chatOpen]);

  const freeAiRemaining = useMemo(() => {
    const used = syncDailyAiDateAndCount();
    return Math.max(0, 5 - used);
  }, [quotaVersion, chatOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatMessages, isStreaming]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const faqPrompts = [t.faq1, t.faq2, t.faq3, t.faq4, t.faq5, t.faq6];

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!requireLogin()) return;

    const todayCount = syncDailyAiDateAndCount();
    if (todayCount >= 5) {
      addChatMessage({
        role: "ai",
        text:
          FREE_QUOTA_MSG_PREFIX +
          (lang === "zh" ? FREE_QUOTA_EXCEEDED_ZH : FREE_QUOTA_EXCEEDED_KO),
      });
      return;
    }

    if (user && user.tokens <= 0) {
      addChatMessage({ role: "ai", text: t.noTokens });
      return;
    }
    if (!canAskQuestion()) {
      addChatMessage({ role: "ai", text: t.dailyLimitReached });
      return;
    }
    touchChatActivity();
    setStatusMessage("");
    lastAiUserMessageRef.current = trimmed;
    void trackActivity("ask_ai", undefined, trimmed);
    addChatMessage({ role: "user", text: trimmed });
    addChatMessage({ role: "ai", text: "" });
    setInput("");
    setIsStreaming(true);
    setStreamReplyStarted(false);

    const messagesForApi = [...chatMessages, { role: "user" as const, text: trimmed }]
      .slice(-10)
      .map((m) => ({
        role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
        content: m.text,
      }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesForApi,
          userId: currentUserId ?? 1,
          userLocation: useStore.getState().userLocation,
          localShops:
            typeof window !== "undefined"
              ? ((JSON.parse(
                  window.localStorage.getItem("bababang-admin-shops") ?? "[]"
                ) as ShopEntry[]) || [])
              : [],
        }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { content?: string };
        updateLastAiMessage(errData.content ?? t.errorTryAgain);
        return;
      }

      if (!res.body) {
        updateLastAiMessage("응답을 받지 못했어요. 다시 시도해주세요~");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let completed = false;
      let replyStarted = false;

      const parseSseLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) return;
        const dataStr = trimmed.slice(5).trim();
        try {
          const data = JSON.parse(dataStr) as {
            type?: string;
            content?: string;
            meta?: { totalSources?: number };
            recommendedShops?: ChatMessage["recommendedShops"];
          };
          if (data.type === "status" && typeof data.content === "string") {
            setStatusMessage(data.content);
          } else if (data.type === "content" && typeof data.content === "string") {
            if (!replyStarted) {
              replyStarted = true;
              setStreamReplyStarted(true);
              setStatusMessage("");
            }
            fullText += data.content;
            updateLastAiMessage(fullText);
          } else if (data.type === "done") {
            completed = true;
            const finalText =
              typeof data.content === "string" ? cleanResponse(data.content) : cleanResponse(fullText);
            const shopsFromServer = data.recommendedShops ?? [];
            updateLastAiMessage(finalText, { recommendedShops: shopsFromServer });
            const cat = detectAdCategory(lastAiUserMessageRef.current);
            if (cat) {
              void (async () => {
                try {
                  const res = await fetch(
                    "/api/ads?category=" + encodeURIComponent(cat)
                  );
                  const j = (await res.json()) as { ads?: AdApiRow[] };
                  const ads = Array.isArray(j.ads) ? j.ads : [];
                  const adCards = ads.map((ad) => adRowToRecommendedShop(ad));
                  updateLastAiMessage(finalText, {
                    recommendedShops: [...adCards, ...shopsFromServer],
                  });
                } catch {
                  /* keep server shops */
                }
              })();
            }
            bumpDailyAiCount();
            setQuotaVersion((v) => v + 1);
            incrementQuestion();
            incrementQuestionCount();
            void (async () => {
              try {
                const r = await fetch("/api/tokens", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: currentUserId ?? 1,
                    amount: 1,
                    type: "spend",
                    reason: "AI질문",
                  }),
                });
                const d = (await r.json()) as {
                  success?: boolean;
                  tokens?: number;
                };
                if (d.success && typeof d.tokens === "number") {
                  const u = useStore.getState().user;
                  if (u) setUser({ ...u, tokens: d.tokens });
                } else {
                  deductToken();
                }
              } catch {
                deductToken();
              }
            })();
          } else if (data.type === "error" && typeof data.content === "string") {
            updateLastAiMessage(data.content);
          }
        } catch {
          /* ignore */
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          parseSseLine(line);
        }
        if (done) break;
      }
      if (buffer.trim()) {
        parseSseLine(buffer);
      }

      if (!completed && fullText) {
        updateLastAiMessage(cleanResponse(fullText));
      }
    } catch {
      updateLastAiMessage("네트워크가 불안정해요. 다시 시도해주세요~");
    } finally {
      setIsStreaming(false);
      setStreamReplyStarted(false);
      setStatusMessage("");
    }
  };

  sendMessageRef.current = sendMessage;

  useEffect(() => {
    if (!chatOpen || !chatPendingPrompt) return;
    const t = chatPendingPrompt;
    setChatPendingPrompt(null);
    void sendMessageRef.current(t);
  }, [chatOpen, chatPendingPrompt, setChatPendingPrompt]);

  return (
    <AnimatePresence>
      {chatOpen && (
        <>
          <style>{`
            @keyframes blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
            .typing-cursor {
              display: inline;
              animation: blink 0.8s infinite;
              color: var(--accent-light, #a78bfa);
            }
          `}</style>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0"
            style={{
              zIndex: 998,
              background: "rgba(0,0,0,0.5)",
            }}
            onClick={() => setChatOpen(false)}
            aria-hidden
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="chat-container fixed top-0 right-0 bottom-0 flex min-h-0 flex-col border-l border-white/10 bg-[#0a0a0f] shadow-glass-dark"
            style={{
              width: "80%",
              maxWidth: "344px",
              zIndex: 999,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-2 px-3 py-3 border-b border-white/10 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
              <motion.button
                type="button"
                onClick={() => setChatOpen(false)}
                className="p-2 rounded-full hover:bg-white/10 shrink-0"
                whileTap={{ scale: 0.9 }}
                aria-label={lang === "zh" ? "关闭" : "닫기"}
              >
                <X className="w-6 h-6 text-white" strokeWidth={2} />
              </motion.button>
              <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                <p className="font-outfit font-semibold text-white text-sm sm:text-base truncate w-full text-center">
                  {t.aiName}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-white/90 min-w-[4.5rem]">
                <span className="text-white/50">{t.tokensLabel}</span>{" "}
                <span className="font-semibold text-white">{tokens}</span>
              </div>
            </div>

            {toast ? (
              <div className="shrink-0 px-3 pt-1">
                <div
                  className="w-full text-center text-white"
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    background: "var(--bg-dark-card)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  {toast}
                </div>
              </div>
            ) : null}

            {statusMessage && isStreaming && !streamReplyStarted ? (
              <div
                className="shrink-0 px-4 py-2 flex items-center gap-2 text-left border-b border-white/5"
                style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}
              >
                <span className="inline-block animate-spin mr-2 select-none" aria-hidden>
                  ⏳
                </span>
                <span className="min-w-0 flex-1 leading-snug">{statusMessage}</span>
              </div>
            ) : null}

            {/* 메시지 영역: AI 왼쪽 하단 각짐, 유저 오른쪽 하단 각짐, 새 메시지 scale */}
            <div
              ref={scrollRef}
              className="chat-messages min-h-0 flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin"
            >
              <AnimatePresence>
                {chatMessages.map((msg, i) => {
                  const isLastAi =
                    msg.role === "ai" && i === chatMessages.length - 1;
                  if (
                    isLastAi &&
                    isStreaming &&
                    !streamReplyStarted &&
                    msg.text.length === 0
                  ) {
                    return null;
                  }
                  const isFreeQuotaCta =
                    msg.role === "ai" &&
                    msg.text.startsWith(FREE_QUOTA_MSG_PREFIX);
                  const aiDisplayText = isFreeQuotaCta
                    ? msg.text.slice(FREE_QUOTA_MSG_PREFIX.length)
                    : msg.text;
                  const isStatusPhase = false;
                  return (
                  <motion.div
                    key={`msg-${i}`}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 28,
                    }}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "ai" ? (
                      <div className="max-w-[85%]">
                        <div
                          className={`rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-[4px] bg-white/10 backdrop-blur-card px-4 py-3 text-sm ${
                            isStatusPhase ? "italic text-white/50" : "text-white/95 flex flex-col gap-1.5"
                          }`}
                        >
                          <AiMessageContent
                            text={aiDisplayText}
                            isStatusPhase={isStatusPhase}
                            onChipTap={(line) => void sendMessage(line)}
                          />
                          {isFreeQuotaCta ? (
                            <motion.button
                              type="button"
                              onClick={() => setMembershipOpen(true)}
                              className="mt-3 w-full text-center font-medium text-white"
                              style={{
                                padding: 12,
                                borderRadius: 12,
                                background:
                                  "linear-gradient(135deg, #6c5ce7 0%, #8b5cf6 100%)",
                              }}
                              whileTap={{ scale: 0.98 }}
                            >
                              {lang === "zh" ? "升级高级版 →" : "프리미엄 업그레이드 →"}
                            </motion.button>
                          ) : null}
                          {isLastAi && isStreaming && (
                            <span className="typing-cursor">▊</span>
                          )}
                        </div>
                        {msg.recommendedShops &&
                          !isFreeQuotaCta &&
                          msg.recommendedShops.length > 0 &&
                          /맛집|장소|추천|가게|식당|카페|주소|업체|칭다오|청도|美食|餐厅|烧烤|火锅|咖啡|데려|안내|소개|찾아|위치|怎么走|怎么去/i.test(
                            msg.text
                          ) && (
                            <p className="mt-1.5 text-[11px] text-white/45 italic">
                              📍 위 장소로 길찾기나 택시가 필요하면 추천 카드를 탭해보세요
                            </p>
                          )}
                        {!isFreeQuotaCta ? (
                        <div className="mt-1.5 flex items-center gap-2 text-white/50">
                          <button
                            type="button"
                            onClick={() => {
                              setFeedbackMap((s) => ({ ...s, [i]: "good" }));
                              setReasonPickerFor(null);
                              addFeedback({
                                messageIndex: i,
                                feedback: "good",
                                timestamp: new Date(),
                              });
                              const userMsg =
                                i > 0 && chatMessages[i - 1]?.role === "user"
                                  ? chatMessages[i - 1].text
                                  : "";
                              const aiMsg = chatMessages[i]?.text ?? "";
                              void persistFeedbackToDb({
                                userId: currentUserId ?? 1,
                                userMessage: userMsg,
                                aiResponse: aiMsg,
                                feedback: "good",
                              });
                              setToast(toastThanksGood);
                            }}
                            className={`p-1 rounded ${
                              feedbackMap[i] === "good" ? "text-accent" : ""
                            }`}
                          >
                            <ThumbsUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFeedbackMap((s) => ({ ...s, [i]: "bad" }));
                              setReasonPickerFor(i);
                              setToast(toastBadPrompt);
                            }}
                            className={`p-1 rounded ${
                              feedbackMap[i] === "bad" ? "text-accent" : ""
                            }`}
                          >
                            <ThumbsDown className="w-4 h-4" />
                          </button>
                        </div>
                        ) : null}
                        {reasonPickerFor === i && !isFreeQuotaCta && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {(lang === "zh" ? feedbackReasonsZh : feedbackReasonsKo).map(
                              (reason) => (
                                <button
                                  key={reason}
                                  type="button"
                                  onClick={() => {
                                    addFeedback({
                                      messageIndex: i,
                                      feedback: "bad",
                                      reason,
                                      timestamp: new Date(),
                                    });
                                    const userMsg =
                                      i > 0 && chatMessages[i - 1]?.role === "user"
                                        ? chatMessages[i - 1].text
                                        : "";
                                    const aiMsg = chatMessages[i]?.text ?? "";
                                    void persistFeedbackToDb({
                                      userId: currentUserId ?? 1,
                                      userMessage: userMsg,
                                      aiResponse: aiMsg,
                                      feedback: "bad",
                                      feedbackReason: reason,
                                    });
                                    setReasonPickerFor(null);
                                    setToast(toastFeedbackOk);
                                  }}
                                  className="px-2 py-1 rounded-full text-[10px] bg-white/10 text-white/80"
                                >
                                  {reason}
                                </button>
                              )
                            )}
                          </div>
                        )}
                        {msg.recommendedShops &&
                          !isFreeQuotaCta &&
                          msg.recommendedShops.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-2 rounded-2xl bg-white/5 border border-white/10 p-2"
                          >
                            <p className="text-[11px] text-white/50 px-1 mb-2">📍 추천 업체</p>
                            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                              {msg.recommendedShops.map((shop, si) => {
                                const displayKo = shop.koreanName?.trim();
                                const displayZh = shop.name?.trim();
                                const mainTitle = displayKo || displayZh || "";
                                const showZhSub =
                                  Boolean(displayKo && displayZh && displayKo !== displayZh);
                                const mapLabel = displayKo || displayZh || "";
                                const hasRatingOrCost = Boolean(shop.rating || shop.cost);
                                const hasAddress = Boolean(shop.address?.trim());
                                const hasTime = Boolean(shop.openTime && String(shop.openTime).trim());
                                const hasAnyDetail = hasRatingOrCost || hasAddress || hasTime;
                                return (
                                <div
                                  key={`${shop.name}-${si}`}
                                  className={`group relative w-[240px] min-w-[240px] flex-shrink-0 glass-dark rounded-[14px] p-[14px] border ${
                                    shop.isAd
                                      ? "border-[rgba(108,92,231,0.3)]"
                                      : "border-white/10"
                                  }`}
                                  onContextMenu={(e) => {
                                    if (shop.isAd) return;
                                    e.preventDefault();
                                    setReportShop(shop);
                                  }}
                                >
                                  {shop.isAd ? (
                                    <span
                                      className="absolute top-[8px] right-[10px] z-20 font-semibold text-white leading-none"
                                      style={{
                                        fontSize: 8,
                                        padding: "2px 4px",
                                        borderRadius: 4,
                                        background: "#6c5ce7",
                                      }}
                                    >
                                      AD
                                    </span>
                                  ) : (
                                  <button
                                    type="button"
                                    className="absolute top-[10px] right-[10px] z-10 text-[8px] leading-none p-0.5 rounded opacity-[0.08] hover:opacity-100 hover:bg-white/5 active:opacity-100 focus:opacity-100 focus:outline-none transition-opacity"
                                    aria-label="장소 신고"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setReportShop(shop);
                                    }}
                                  >
                                    ⚠️
                                  </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      sendMessage(`${mapLabel} 자세히 알려줘`)
                                    }
                                    className="w-full text-left pr-5"
                                  >
                                    <p className="text-[15px] font-bold text-white leading-snug">
                                      {mainTitle}
                                    </p>
                                    {showZhSub ? (
                                      <p className="text-[12px] text-white/45 mt-0.5 line-clamp-2">
                                        {displayZh}
                                      </p>
                                    ) : null}
                                    {hasAnyDetail ? (
                                      <>
                                        {hasRatingOrCost ? (
                                          <p
                                            className="text-[12px] mt-2"
                                            style={{ color: "var(--gold)" }}
                                          >
                                            {shop.rating ? `⭐ ${shop.rating}` : ""}
                                            {shop.rating && shop.cost ? " · " : ""}
                                            {shop.cost ? `인당 ${shop.cost}위안` : ""}
                                          </p>
                                        ) : null}
                                        {hasAddress ? (
                                          <p className="text-[11px] text-white/45 mt-1.5 line-clamp-1">
                                            📍 {shop.address}
                                          </p>
                                        ) : null}
                                        {hasTime ? (
                                          <p className="text-[11px] text-white/45 mt-1">
                                            🕐 {shop.openTime}
                                          </p>
                                        ) : null}
                                      </>
                                    ) : (
                                      <p className="text-[11px] text-white/35 mt-2">
                                        상세 정보를 확인해보세요
                                      </p>
                                    )}
                                  </button>
                                  {(() => {
                                    const linkZhName =
                                      (displayZh && displayZh.trim()) ||
                                      String(shop.name || "").trim() ||
                                      mapLabel;
                                    if (!linkZhName) return null;
                                    const lat = shop.lat ? String(shop.lat) : "";
                                    const lng = shop.lng ? String(shop.lng) : "";
                                    return (
                                      <div className="mt-3 flex gap-2">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openMapActionSheet(
                                              lat,
                                              lng,
                                              linkZhName,
                                              shop.address || "",
                                              displayKo || ""
                                            );
                                          }}
                                          className="flex-1 rounded-full border border-white/15 bg-white/5 px-2 py-1.5 text-[10px] leading-tight text-white/90"
                                          style={{
                                            borderColor: "var(--accent)",
                                            color: "var(--accent)",
                                          }}
                                        >
                                          길찾기
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openDidi(lat, lng, linkZhName);
                                          }}
                                          className="flex-1 rounded-full border border-white/15 bg-white/5 px-2 py-1.5 text-[10px] leading-tight"
                                          style={{
                                            borderColor: "var(--gold)",
                                            color: "var(--gold)",
                                          }}
                                        >
                                          택시
                                        </button>
                                      </div>
                                    );
                                  })()}
                                </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    ) : (
                      <div
                        className="max-w-[85%] rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-[4px] px-4 py-3 text-sm text-white"
                        style={{
                          background:
                            "linear-gradient(135deg, #6c5ce7 0%, #8b7cf7 100%)",
                        }}
                      >
                        {msg.text}
                      </div>
                    )}
                  </motion.div>
                  );
                })}
              </AnimatePresence>

              {chatMessages.length === 0 && (
                <div className="mt-2">
                  <p className="text-xs text-white/60 mb-2">
                    {lang === "zh" ? "热门提问" : "인기 질문"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {faqPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => sendMessage(prompt)}
                        className="text-left rounded-xl bg-white/10 px-3 py-2 text-xs text-white/90"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 퀵액션 가로 스크롤 */}
            <div className="shrink-0 px-4 py-2 overflow-x-auto flex gap-2 scrollbar-thin border-t border-white/5">
              {quickPrompts.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => sendMessage(i18n[lang].chat[key])}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-xs hover:bg-white/20 active:scale-[0.98]"
                >
                  {t[key]}
                </button>
              ))}
            </div>

            {/* 일일 한도 도달 시 업그레이드 안내 */}
            {atDailyLimit && (
              <div className="shrink-0 px-4 py-2 border-t border-white/5 flex justify-center">
                <motion.button
                  type="button"
                  onClick={() => setMembershipOpen(true)}
                  className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium"
                  whileTap={{ scale: 0.98 }}
                >
                  {t.upgrade}
                </motion.button>
              </div>
            )}

            <p
              className={`shrink-0 px-4 pt-2 text-right text-[13px] ${
                freeAiRemaining <= 0
                  ? "text-red-400"
                  : freeAiRemaining <= 3
                    ? "text-[#feca57]"
                    : "text-white/45"
              }`}
            >
              {freeAiRemaining <= 0
                ? lang === "zh"
                  ? "免费提问次数已用完"
                  : "무료 질문을 모두 사용했어요"
                : lang === "zh"
                  ? `今日剩余免费提问: ${freeAiRemaining}/5`
                  : `오늘 남은 무료 질문: ${freeAiRemaining}/5`}
            </p>
            {/* 입력창 + 전송 (sticky 하단 + safe-area) */}
            <div
              className="chat-input-area border-t border-white/10 flex w-full min-w-0 overflow-hidden"
              style={{
                display: "flex",
                gap: 8,
                padding: "8px 12px",
                width: "100%",
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                placeholder={t.placeholder}
                className="min-w-0 flex-1 bg-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-accent/50"
                style={{ fontSize: "16px", flex: 1, minWidth: 0 }}
              />
              <motion.button
                type="button"
                onClick={() => sendMessage(input)}
                className="flex shrink-0 items-center justify-center rounded-xl bg-accent text-white"
                style={{ width: 40, height: 40, flexShrink: 0 }}
                whileTap={{ scale: 0.95 }}
              >
                <Send className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.aside>
          <ReportModal
            open={!!reportShop}
            onClose={() => setReportShop(null)}
            shopDisplayName={
              reportShop
                ? `${reportShop.koreanName || reportShop.name}${reportShop.address ? ` · ${reportShop.address}` : ""}`
                : ""
            }
            onSubmitted={(tokenMsg) =>
              setToast(
                tokenMsg ? `${toastReportThanks} ${tokenMsg}` : toastReportThanks
              )
            }
          />
        </>
      )}
    </AnimatePresence>
  );
}
