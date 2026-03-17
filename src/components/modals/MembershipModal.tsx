"use client";

import { motion } from "framer-motion";
import { ChevronLeft, Check, Crown } from "lucide-react";
import { useStore } from "@/stores/useStore";
import { i18n } from "@/lib/i18n";

export function MembershipModal() {
  const { membershipOpen, setMembershipOpen, lang, user } = useStore();
  const t = i18n[lang].membership;
  const currentPlan = (user?.plan ?? "free") as "free" | "premium" | "pro";

  if (!membershipOpen) return null;

  const plans = [
    {
      id: "free" as const,
      nameKey: "free" as const,
      price: "¥0",
      featuresKey: "freeFeatures" as const,
    },
    {
      id: "premium" as const,
      nameKey: "premium" as const,
      price: "¥99",
      featuresKey: "premiumFeatures" as const,
    },
    {
      id: "pro" as const,
      nameKey: "pro" as const,
      price: "¥199",
      featuresKey: "proFeatures" as const,
    },
  ];

  return (
    <>
      {/* 반투명 검은 배경 오버레이 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[200] bg-black/60"
        onClick={() => setMembershipOpen(false)}
        aria-hidden
      />

      {/* 전체 화면 모달: 다크 배경 + 아래에서 위 슬라이드 업 */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed inset-0 z-[200] flex flex-col bg-[#0a0a0f] text-white overflow-hidden"
      >
        {/* 상단: 뒤로가기 + 타이틀 */}
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

        {/* 플랜 카드 리스트 (세로 풀 너비) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin max-w-mobile mx-auto w-full">
          {plans.map((plan, i) => {
            const isCurrent =
              (plan.id === "free" && currentPlan === "free") ||
              (plan.id === "premium" && currentPlan === "premium") ||
              (plan.id === "pro" && currentPlan === "pro");
            const features = [...t[plan.featuresKey]];

            return (
              <motion.article
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`w-full rounded-2xl p-5 border-2 bg-white/5 ${
                  plan.id === "free"
                    ? "border-white/20"
                    : plan.id === "premium"
                      ? "border-accent"
                      : "border-gold"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {plan.id !== "free" && (
                      <Crown
                        className={`w-5 h-5 ${
                          plan.id === "pro" ? "text-gold" : "text-accent"
                        }`}
                      />
                    )}
                    <span className="font-outfit font-semibold text-lg">
                      {t[plan.nameKey]}
                    </span>
                  </div>
                  <span className="font-outfit font-bold text-xl">
                    {plan.price}
                  </span>
                </div>

                <ul className="space-y-2 mb-4">
                  {features.map((text, j) => (
                    <li
                      key={j}
                      className="flex items-center gap-2 text-sm text-white/85"
                    >
                      <Check className="w-4 h-4 text-accent flex-shrink-0" />
                      <span>{text}</span>
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
                          ? "bg-accent text-white hover:opacity-90"
                          : "bg-gold text-black hover:opacity-90"
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
