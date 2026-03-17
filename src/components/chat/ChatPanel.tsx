"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles } from "lucide-react";
import { useStore } from "@/stores/useStore";
import { i18n } from "@/lib/i18n";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const quickPrompts = [
  "quickFood",
  "quickVisa",
  "quickHospital",
  "quickRealty",
] as const;

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex gap-1 py-2"
    >
      <motion.span
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 0.8, repeat: Infinity }}
        className="w-2 h-2 rounded-full bg-white/70"
      />
      <motion.span
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
        className="w-2 h-2 rounded-full bg-white/70"
      />
      <motion.span
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
        className="w-2 h-2 rounded-full bg-white/70"
      />
    </motion.div>
  );
}

export function ChatPanel() {
  const {
    chatOpen,
    setChatOpen,
    chatMessages,
    addChatMessage,
    lang,
    user,
    canAskQuestion,
    incrementQuestion,
    deductToken,
    setMembershipOpen,
    dailyQuestionCount,
    lastQuestionDate,
  } = useStore();
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
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
  }, [chatMessages, isTyping]);

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
    setInput("");
    setIsTyping(true);
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
        body: JSON.stringify({ messages: messagesForApi }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addChatMessage({ role: "ai", text: t.errorTryAgain });
        setIsTyping(false);
        return;
      }
      const content = data.content ?? t.errorTryAgain;
      addChatMessage({ role: "ai", text: content });
      incrementQuestion();
      deductToken();
    } catch {
      addChatMessage({ role: "ai", text: t.errorTryAgain });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <AnimatePresence>
      {chatOpen && (
        <>
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
                {chatMessages.map((msg, i) => (
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
                      <div className="max-w-[85%] rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-[4px] bg-white/10 backdrop-blur-card px-4 py-3 text-sm text-white/95">
                        {msg.text}
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
                ))}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex justify-start"
                  >
                    <div className="rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-[4px] bg-white/10 backdrop-blur-card px-4 py-2">
                      <TypingIndicator />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
        </>
      )}
    </AnimatePresence>
  );
}
