"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SLIDES = [
  {
    icon: "✨",
    title: "궁금한 건 AI에게 물어보세요",
    lines: [
      "칭다오 생활의 모든 것을 AI가 도와드려요",
      "맛집, 비자, 병원, 부동산 등 무엇이든 물어보세요",
    ],
  },
  {
    icon: "📸",
    title: "모르는 중국어? 사진 찍으면 번역!",
    lines: ["메뉴판, 계약서, 간판, 안내문", "사진 한 장이면 즉시 한국어로 번역해드려요"],
  },
  {
    icon: "🎙️",
    title: "중국인과 대화? 음성번역!",
    lines: [
      "한국어로 말하면 중국어로 번역",
      "중국어로 말하면 한국어로 번역",
      "음성으로 바로 들려드려요",
    ],
  },
];

type OnboardingModalProps = {
  open: boolean;
  onComplete: () => void;
};

export function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const goNext = useCallback(() => {
    setIndex((i) => (i < SLIDES.length - 1 ? i + 1 : i));
  }, []);

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const finish = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("bababang-onboarding", "done");
    }
    onComplete();
  }, [onComplete]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const dx = end - start;
    if (dx < -48) goNext();
    else if (dx > 48) goPrev();
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex flex-col"
          style={{
            background: "linear-gradient(165deg, #0a0a0f 0%, #1a1530 45%, #0a0a0f 100%)",
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex justify-end p-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={finish}
              className="text-sm text-white/50 hover:text-white/80 px-3 py-1"
            >
              건너뛰기
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-8 pb-8 min-h-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
                className="w-full max-w-sm text-center"
              >
                <div
                  className="mx-auto mb-8 w-24 h-24 rounded-3xl flex items-center justify-center text-5xl"
                  style={{
                    background: "rgba(108,92,231,0.2)",
                    border: "1px solid rgba(108,92,231,0.35)",
                  }}
                >
                  {SLIDES[index].icon}
                </div>
                <h2 className="font-outfit font-bold text-xl text-white mb-4 leading-snug">
                  {index === 0 && "1️⃣ "}
                  {index === 1 && "2️⃣ "}
                  {index === 2 && "3️⃣ "}
                  {SLIDES[index].title}
                </h2>
                <div className="space-y-2 text-white/75 text-sm leading-relaxed">
                  {SLIDES[index].lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex justify-center gap-2 pb-4">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === index ? 10 : 8,
                  height: i === index ? 10 : 8,
                  background: i === index ? "#6c5ce7" : "rgba(255,255,255,0.25)",
                }}
              />
            ))}
          </div>

          <div
            className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-3"
            style={{ maxWidth: 430, margin: "0 auto", width: "100%" }}
          >
            {index < SLIDES.length - 1 ? (
              <motion.button
                type="button"
                onClick={goNext}
                className="w-full py-3.5 rounded-2xl font-semibold text-white"
                style={{
                  background: "linear-gradient(135deg, #6c5ce7 0%, #a78bfa 100%)",
                }}
                whileTap={{ scale: 0.98 }}
              >
                다음
              </motion.button>
            ) : (
              <motion.button
                type="button"
                onClick={finish}
                className="w-full py-3.5 rounded-2xl font-semibold text-white"
                style={{
                  background: "linear-gradient(135deg, #6c5ce7 0%, #a78bfa 100%)",
                }}
                whileTap={{ scale: 0.98 }}
              >
                시작하기
              </motion.button>
            )}
            <p className="text-center text-[11px] text-white/35 pb-2">
              좌우로 스와이프해 넘길 수 있어요
            </p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
