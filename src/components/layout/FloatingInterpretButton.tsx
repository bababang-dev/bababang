"use client";

import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import { useStore } from "@/stores/useStore";

const FAB_SIZE = 56;
const GAP = 12;
const INTERPRET_BOTTOM = `calc(60px + env(safe-area-inset-bottom, 0px) + 12px + ${56 + GAP}px)`;
const FAB_GRADIENT = "linear-gradient(135deg, #6c5ce7, #a78bfa)";

export function FloatingInterpretButton() {
  const setInterpreterOpen = useStore((s) => s.setInterpreterOpen);
  const hideFab = useStore(
    (s) =>
      s.chatOpen ||
      s.interpreterOpen ||
      s.writePostOpen ||
      s.promotionModalOpen ||
      s.loginModalOpen
  );

  if (hideFab) return null;

  return (
    <div className="fixed bottom-0 left-1/2 z-50 -translate-x-1/2 w-full max-w-[430px] h-0 pointer-events-none">
      <motion.button
        type="button"
        onClick={() => setInterpreterOpen(true)}
        className="absolute rounded-full flex items-center justify-center pointer-events-auto"
        style={{
          bottom: INTERPRET_BOTTOM,
          right: 16,
          width: FAB_SIZE,
          height: FAB_SIZE,
          background: FAB_GRADIENT,
          boxShadow: "0 4px 24px rgba(108, 92, 231, 0.45)",
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        aria-label="실시간 번역"
        title="실시간 번역"
      >
        <Mic className="w-6 h-6 text-white" strokeWidth={2.2} />
      </motion.button>
    </div>
  );
}
