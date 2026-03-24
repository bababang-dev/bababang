"use client";

import { motion } from "framer-motion";
import { ChevronLeft, Check, Crown } from "lucide-react";
import { useStore } from "@/stores/useStore";
import { i18n } from "@/lib/i18n";

type PlanLine = { text: string; soon?: boolean };

export function MembershipModal() {
  const { membershipOpen, setMembershipOpen, lang, user } = useStore();
  const t = i18n[lang].membership;
  const currentPlan = (user?.plan ?? "free") as "free" | "premium" | "pro";

  if (!membershipOpen) return null;

  const plans = [
    {
      id: "free" as const,
      nameKey: "free" as const,
      priceKey: "freePrice" as const,
      border: "gray" as const,
    },
    {
      id: "premium" as const,
      nameKey: "premium" as const,
      priceKey: "premiumPrice" as const,
      border: "premium" as const,
      badgeRecommended: true,
    },
    {
      id: "pro" as const,
      nameKey: "pro" as const,
      priceKey: "proPrice" as const,
      border: "gold" as const,
    },
  ];

  const linesFor = (id: "free" | "premium" | "pro"): PlanLine[] => {
    if (id === "free") {
      return t.freeLines.map((text) => ({ text }));
    }
    if (id === "premium") return [...t.premiumLines];
    return [...t.proLines];
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/60"
        style={{ zIndex: 1100 }}
        onClick={() => setMembershipOpen(false)}
        aria-hidden
      />

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed inset-0 flex flex-col bg-[#0a0a0f] text-white overflow-hidden"
        style={{ zIndex: 1100 }}
      >
        <div className="flex items-center gap-3 h-14 px-4 flex-shrink-0 border-b border-white/10">
          <motion.button
            type="button"
            onClick={() => setMembershipOpen(false)}
            className="p-2 -ml-2 rounded-full hover:bg-white/10"
            whileTap={{ scale: 0.92 }}
            aria-label="닫기"
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>
          <h2 className="font-outfit text-lg font-semibold">{t.title}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin max-w-mobile mx-auto w-full">
          {plans.map((plan, i) => {
            const isCurrent =
              (plan.id === "free" && currentPlan === "free") ||
              (plan.id === "premium" && currentPlan === "premium") ||
              (plan.id === "pro" && currentPlan === "pro");
            const features = linesFor(plan.id);
            const borderClass =
              plan.border === "gray"
                ? "border-white/25"
                : plan.border === "premium"
                  ? "border-[#6c5ce7]"
                  : "border-[#ffd32a]";

            return (
              <motion.article
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`relative w-full rounded-2xl p-5 border-2 bg-white/5 ${borderClass}`}
              >
                {plan.badgeRecommended && (
                  <span
                    className="absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
                    style={{ background: "#6c5ce7" }}
                  >
                    {t.recommended}
                  </span>
                )}

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {plan.id !== "free" && (
                      <Crown
                        className={`w-5 h-5 ${
                          plan.id === "pro" ? "text-[#ffd32a]" : "text-[#6c5ce7]"
                        }`}
                      />
                    )}
                    <span className="font-outfit font-semibold text-lg">
                      {t[plan.nameKey]}
                    </span>
                  </div>
                  <span className="font-outfit font-bold text-xl">
                    {t[plan.priceKey]}
                  </span>
                </div>

                <ul className="space-y-2 mb-4">
                  {features.map((line, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-2 text-sm text-white/85"
                    >
                      <Check className="w-4 h-4 text-[#6c5ce7] flex-shrink-0 mt-0.5" />
                      <span>
                        {line.text}
                        {line.soon ? (
                          <span className="text-white/45 text-xs ml-1.5">{t.soon}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>

                <motion.button
                  type="button"
                  disabled={isCurrent}
                  className={`w-full py-3 rounded-xl text-sm font-medium ${
                    isCurrent
                      ? "bg-white/10 text-white/60 cursor-default"
                      : plan.id === "free"
                        ? "bg-white/15 text-white hover:bg-white/20"
                        : plan.id === "premium"
                          ? "bg-[#6c5ce7] text-white hover:opacity-90"
                          : "bg-[#ffd32a] text-black hover:opacity-90"
                  }`}
                  whileTap={isCurrent ? undefined : { scale: 0.98 }}
                >
                  {isCurrent ? t.currentPlan : t.upgrade}
                </motion.button>
              </motion.article>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}
