"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/stores/useStore";

const bg: Record<"success" | "info" | "warning", string> = {
  success: "#22c55e",
  info: "#6b7280",
  warning: "#eab308",
};

export function Toast() {
  const toastMessage = useStore((s) => s.toastMessage);
  const clearToast = useStore((s) => s.clearToast);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => clearToast(), 2000);
    return () => window.clearTimeout(t);
  }, [toastMessage, clearToast]);

  return (
    <AnimatePresence>
      {toastMessage ? (
        <motion.div
          key={toastMessage.text}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          className="fixed z-[9999] text-white shadow-lg pointer-events-none"
          style={{
            top: 60,
            left: 16,
            right: 16,
            maxWidth: 430,
            marginLeft: "auto",
            marginRight: "auto",
            padding: "12px 20px",
            borderRadius: 12,
            fontSize: 14,
            background: bg[toastMessage.type],
          }}
        >
          {toastMessage.text}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
