"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useStore } from "@/stores/useStore";

export function FloatingAIButton() {
  const { toggleChat } = useStore();
  const hideFab = useStore(
    (s) =>
      s.chatOpen ||
      s.writePostOpen ||
      s.promotionModalOpen ||
      s.loginModalOpen
  );

  if (hideFab) return null;

  return (
    <div className="fixed bottom-0 left-1/2 z-50 -translate-x-1/2 w-full max-w-[430px] h-0 pointer-events-none">
      <motion.button
        type="button"
        onClick={toggleChat}
        className="absolute rounded-full flex items-center justify-center animate-glow pointer-events-auto"
        style={{
          bottom: "calc(60px + env(safe-area-inset-bottom, 0px) + 12px)",
          right: 16,
          width: 56,
          height: 56,
          background: "linear-gradient(135deg, #6c5ce7 0%, #8b5cf6 100%)",
          boxShadow: "0 4px 24px rgba(108, 92, 231, 0.5)",
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
      >
        <Sparkles className="w-6 h-6 text-white" strokeWidth={2.5} />
      </motion.button>
    </div>
  );
}
