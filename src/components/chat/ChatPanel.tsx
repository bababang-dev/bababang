"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
import { useStore } from "@/stores/useStore";
import { i18n } from "@/lib/i18n";
import type { ShopEntry } from "@/lib/shopDict";
import type { ChatMessage } from "@/types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function cleanResponse(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/```[^`]*```/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{5,}/g, "\n\n\n")
    .trim();
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
    setMembershipOpen,
    dailyQuestionCount,
    lastQuestionDate,
    addFeedback,
    incrementQuestionCount,
  } = useStore();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamReplyStarted, setStreamReplyStarted] = useState(false);
  const [toast, setToast] = useState("");
  const [feedbackMap, setFeedbackMap] = useState<Record<number, "good" | "bad">>(
    {}
  );
  const [reasonPickerFor, setReasonPickerFor] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = i18n[lang].chat;
  const tokens = user?.tokens ?? 0;
  const isFree = user?.plan === "free";
  const remainingFree =
    isFree
      ? (lastQuestionDate === todayStr()
          ? Math.max(0, 3 - dailyQuestionCount)
          : 3)
      : null;
  const atDailyLimit = isFree && !canAskQuestion();

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatMessages, isStreaming]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const faqPrompts = [t.faq1, t.faq2, t.faq3, t.faq4, t.faq5, t.faq6];

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (user && user.tokens <= 0) {
      addChatMessage({ role: "ai", text: t.noTokens });
      return;
    }
    if (!canAskQuestion()) {
      addChatMessage({ role: "ai", text: t.dailyLimitReached });
      return;
    }
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
            updateLastAiMessage(data.content);
          } else if (data.type === "content" && typeof data.content === "string") {
            if (!replyStarted) {
              replyStarted = true;
              setStreamReplyStarted(true);
            }
            fullText += data.content;
            updateLastAiMessage(fullText);
          } else if (data.type === "done") {
            completed = true;
            const finalText =
              typeof data.content === "string" ? cleanResponse(data.content) : cleanResponse(fullText);
            updateLastAiMessage(finalText, {
              recommendedShops: data.recommendedShops ?? [],
            });
            incrementQuestion();
            incrementQuestionCount();
            deductToken();
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
    }
  };

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
          {/* 오버레이: backdrop-blur(4px) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 max-w-mobile right-0 ml-auto bg-black/40 backdrop-blur-[4px]"
            style={{ width: "100%" }}
            onClick={() => setChatOpen(false)}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-[92%] max-w-mobile flex flex-col bg-baba-dark border-l border-white/10 shadow-glass-dark"
          >
            {/* 헤더: AI 아바타 + 토큰 + 닫기 */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-outfit font-semibold text-white">
                    {t.aiName}
                  </p>
                  <p className="text-xs text-white/60">
                    {t.tokensLabel} {tokens}
                    {remainingFree !== null && (
                      <span className="ml-2">
                        · {t.remainingQuota}: {remainingFree}/3
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <motion.button
                type="button"
                onClick={() => setChatOpen(false)}
                className="p-2 rounded-full hover:bg-white/10"
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* 메시지 영역: AI 왼쪽 하단 각짐, 유저 오른쪽 하단 각짐, 새 메시지 scale */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin"
            >
              <AnimatePresence>
                {chatMessages.map((msg, i) => {
                  const isLastAi =
                    msg.role === "ai" && i === chatMessages.length - 1;
                  const isStatusPhase =
                    isLastAi &&
                    isStreaming &&
                    !streamReplyStarted &&
                    (msg.text.length === 0 ||
                      msg.text.includes("정보를 수집") ||
                      msg.text.includes("분석 완료"));
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
                            isStatusPhase ? "italic text-white/50" : "text-white/95"
                          }`}
                          style={{ whiteSpace: "pre-line" }}
                        >
                          {msg.text}
                          {isLastAi && isStreaming && (
                            <span className="typing-cursor">▊</span>
                          )}
                        </div>
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
                                userId: 1,
                                userMessage: userMsg,
                                aiResponse: aiMsg,
                                feedback: "good",
                              });
                              setToast("감사합니다! 더 좋은 답변 드릴게요 😊");
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
                              setToast("죄송해요. 어떤 점이 아쉬웠나요?");
                            }}
                            className={`p-1 rounded ${
                              feedbackMap[i] === "bad" ? "text-accent" : ""
                            }`}
                          >
                            <ThumbsDown className="w-4 h-4" />
                          </button>
                        </div>
                        {reasonPickerFor === i && (
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
                                      userId: 1,
                                      userMessage: userMsg,
                                      aiResponse: aiMsg,
                                      feedback: "bad",
                                      feedbackReason: reason,
                                    });
                                    setReasonPickerFor(null);
                                    setToast("의견 반영할게요!");
                                  }}
                                  className="px-2 py-1 rounded-full text-[10px] bg-white/10 text-white/80"
                                >
                                  {reason}
                                </button>
                              )
                            )}
                          </div>
                        )}
                        {msg.recommendedShops && msg.recommendedShops.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-2 rounded-2xl bg-white/5 border border-white/10 p-2"
                          >
                            <p className="text-[11px] text-white/50 px-1 mb-2">📍 추천 업체</p>
                            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                              {msg.recommendedShops.map((shop) => (
                                <button
                                  key={shop.zh}
                                  type="button"
                                  onClick={() =>
                                    sendMessage(`${shop.koreanName} 자세히 알려줘`)
                                  }
                                  className="w-[220px] flex-shrink-0 text-left rounded-xl bg-white/10 px-3 py-2"
                                >
                                  <p className="text-sm font-semibold text-white">
                                    {shop.category.includes("맛집")
                                      ? "🍜"
                                      : shop.category.includes("카페")
                                        ? "☕"
                                        : shop.category.includes("병원")
                                          ? "🏥"
                                          : "🏬"}{" "}
                                    {shop.koreanName}
                                  </p>
                                  <p className="text-[11px] text-white/50 mt-0.5">{shop.zh}</p>
                                  <p className="text-xs text-white/80 mt-1">📍 {shop.district}</p>
                                  {shop.recommendMenu && (
                                    <p className="text-xs text-white/80 mt-1">
                                      🍜 {shop.recommendMenu}
                                    </p>
                                  )}
                                  {shop.priceRange && (
                                    <p className="text-xs text-white/80 mt-1">
                                      💰 {shop.priceRange}
                                    </p>
                                  )}
                                  {shop.tip && (
                                    <p className="text-[11px] text-[#c9b8ff] mt-1.5">{shop.tip}</p>
                                  )}
                                </button>
                              ))}
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
            <div className="px-4 py-2 overflow-x-auto flex gap-2 scrollbar-thin border-t border-white/5">
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
              <div className="px-4 py-2 border-t border-white/5 flex justify-center">
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

            {/* 입력창 + 전송 */}
            <div className="p-4 border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                placeholder={t.placeholder}
                className="flex-1 bg-white/10 rounded-xl px-4 py-3 text-white placeholder-white/50 text-sm outline-none focus:ring-2 focus:ring-accent/50"
              />
              <motion.button
                type="button"
                onClick={() => sendMessage(input)}
                className="p-3 rounded-xl bg-accent text-white flex-shrink-0"
                whileTap={{ scale: 0.95 }}
              >
                <Send className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.aside>
          {toast && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] bg-black/80 text-white text-xs px-3 py-2 rounded-full">
              {toast}
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
