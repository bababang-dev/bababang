"use client";

import { motion } from "framer-motion";
import { useStore } from "@/stores/useStore";

/** AI 채팅 FAB 왼쪽 — 동시통역 패널 열기 */
export function FloatingInterpretButton() {
  const setInterpreterOpen = useStore((s) => s.setInterpreterOpen);
  const activeTab = useStore((s) => s.activeTab);
  const recommendSubTab = useStore((s) => s.recommendSubTab);
  const hideFab = useStore(
    (s) =>
      s.chatOpen ||
      s.interpreterOpen ||
      s.writePostOpen ||
      s.promotionModalOpen ||
      s.loginModalOpen
  );

  const secondaryVisible =
    activeTab === "community" || (activeTab === "recommend" && recommendSubTab === "promo");

  if (hideFab) return null;

  const rightPx = secondaryVisible ? 136 : 84;

  return (
    <div className="fixed bottom-0 left-1/2 z-50 -translate-x-1/2 w-full max-w-[430px] h-0 pointer-events-none">
      <motion.button
        type="button"
        onClick={() => setInterpreterOpen(true)}
        className="absolute rounded-full flex items-center justify-center pointer-events-auto text-xl"
        style={{
          bottom: "calc(60px + env(safe-area-inset-bottom, 0px) + 12px)",
          right: rightPx,
          width: 48,
          height: 48,
          background: "linear-gradient(135deg, rgba(239,68,68,0.35) 0%, #6c5ce7 100%)",
          boxShadow: "0 4px 20px rgba(108, 92, 231, 0.35)",
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        whileTap={{ scale: 0.95 }}
        aria-label="동시통역"
        title="동시통역"
      >
        🎙️
      </motion.button>
    </div>
  );
}
