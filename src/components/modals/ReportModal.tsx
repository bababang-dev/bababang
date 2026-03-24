"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/stores/useStore";

type ReportType = "closed" | "wrong_info" | "other";

type Props = {
  open: boolean;
  onClose: () => void;
  shopDisplayName: string;
  /** 토큰 지급/품질 안내 문구가 있으면 인자로 전달 */
  onSubmitted?: (tokenMessage?: string) => void;
};

export function ReportModal({ open, onClose, shopDisplayName, onSubmitted }: Props) {
  const currentUserId = useStore((s) => s.currentUserId);
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const [otherText, setOtherText] = useState("");
  const [step, setStep] = useState<"choose" | "other">("choose");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setOtherText("");
    setStep("choose");
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async (reportType: ReportType, detail?: string) => {
    if (reportType === "other" && !detail?.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId ?? 1,
          shopName: shopDisplayName,
          reportType,
          detail: detail?.trim() || null,
        }),
      });
      if (res.ok) {
        let tokenMsg: string | undefined;
        const content = [reportType, shopDisplayName, detail?.trim() || ""]
          .filter(Boolean)
          .join("\n");
        try {
          const tr = await fetch("/api/tokens", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: currentUserId ?? 1,
              amount: 3,
              type: "earn",
              reason: "정보제보",
              content: content.slice(0, 500),
            }),
          });
          const td = (await tr.json()) as {
            success?: boolean;
            message?: string;
            qualityFailed?: boolean;
            tokens?: number;
          };
          if (td.qualityFailed && td.message) tokenMsg = td.message;
          else if (td.success && td.message) tokenMsg = td.message;
          if (td.success && typeof td.tokens === "number" && user) {
            setUser({ ...user, tokens: td.tokens });
          }
        } catch {
          /* ignore */
        }
        onSubmitted?.(tokenMsg);
        handleClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[86] max-w-[430px] mx-auto rounded-t-3xl border border-white/10 bg-baba-dark/95 backdrop-blur-xl shadow-glass-dark p-5 pb-8 text-white"
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            <p className="text-sm font-semibold text-center mb-1">이 장소에 문제가 있나요?</p>
            <p className="text-xs text-white/50 text-center mb-4 line-clamp-2">{shopDisplayName}</p>

            {step === "choose" ? (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submit("closed")}
                  className="w-full rounded-xl bg-white/10 hover:bg-white/15 py-3 text-sm text-left px-4"
                >
                  🚫 없어졌어요 (폐업)
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submit("wrong_info")}
                  className="w-full rounded-xl bg-white/10 hover:bg-white/15 py-3 text-sm text-left px-4"
                >
                  ❌ 정보가 틀려요
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setStep("other")}
                  className="w-full rounded-xl bg-white/10 hover:bg-white/15 py-3 text-sm text-left px-4"
                >
                  📝 기타
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full mt-2 py-2 text-sm text-white/50"
                >
                  취소
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  placeholder="내용을 입력해주세요"
                  className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/40 min-h-[100px] outline-none"
                />
                <button
                  type="button"
                  disabled={submitting || !otherText.trim()}
                  onClick={() => void submit("other", otherText)}
                  className="w-full rounded-xl bg-accent py-3 text-sm font-medium disabled:opacity-40"
                >
                  제출
                </button>
                <button
                  type="button"
                  onClick={() => setStep("choose")}
                  className="w-full py-2 text-sm text-white/50"
                >
                  뒤로
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
