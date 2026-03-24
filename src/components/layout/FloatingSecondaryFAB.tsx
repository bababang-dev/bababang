"use client";

import { motion } from "framer-motion";
import { Pencil, Plus } from "lucide-react";
import { useStore } from "@/stores/useStore";

/** 커뮤니티 글쓰기 / 추천·업체홍보 등록 — AI 버튼(우측 16px) 왼쪽에만 표시, 동시에 하나만 */
export function FloatingSecondaryFAB() {
  const activeTab = useStore((s) => s.activeTab);
  const recommendSubTab = useStore((s) => s.recommendSubTab);
  const openWritePost = useStore((s) => s.openWritePost);
  const openPromotionModal = useStore((s) => s.openPromotionModal);
  const requireLogin = useStore((s) => s.requireLogin);
  const chatOpen = useStore((s) => s.chatOpen);
  const isKeyboardOpen = useStore((s) => s.isKeyboardOpen);

  const showCommunity = activeTab === "community";
  const showPromotion = activeTab === "recommend" && recommendSubTab === "promo";

  if (chatOpen || isKeyboardOpen) return null;
  if (!showCommunity && !showPromotion) return null;

  return (
    <div className="fixed bottom-0 left-1/2 z-50 -translate-x-1/2 w-full max-w-[430px] h-0 pointer-events-none">
      {showCommunity && (
        <motion.button
          type="button"
          onClick={() => {
            if (!requireLogin()) return;
            openWritePost();
          }}
          className="absolute rounded-full flex items-center justify-center pointer-events-auto"
          style={{
            bottom: "calc(60px + env(safe-area-inset-bottom, 0px) + 12px)",
            right: 80,
            width: 48,
            height: 48,
            background: "linear-gradient(135deg, #8b7cf7 0%, #6c5ce7 100%)",
            boxShadow: "0 4px 24px rgba(108, 92, 231, 0.35)",
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          whileTap={{ scale: 0.95 }}
          aria-label="글쓰기"
        >
          <Pencil className="w-5 h-5 text-white" strokeWidth={2.2} />
        </motion.button>
      )}
      {showPromotion && (
        <motion.button
          type="button"
          onClick={() => {
            if (!requireLogin()) return;
            openPromotionModal();
          }}
          className="absolute rounded-full flex items-center justify-center pointer-events-auto"
          style={{
            bottom: "calc(60px + env(safe-area-inset-bottom, 0px) + 12px)",
            right: 80,
            width: 48,
            height: 48,
            background: "linear-gradient(135deg, #8b7cf7 0%, #6c5ce7 100%)",
            boxShadow: "0 4px 24px rgba(108, 92, 231, 0.35)",
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          whileTap={{ scale: 0.95 }}
          aria-label="업체 등록"
        >
          <Plus className="w-5 h-5 text-white" strokeWidth={2.2} />
        </motion.button>
      )}
    </div>
  );
}
