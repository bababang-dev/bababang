"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/stores/useStore";
import { Header } from "@/components/layout/Header";
import { PlaceCard } from "@/components/cards/PlaceCard";
import { mockPlaces } from "@/lib/mockData";
import { i18n } from "@/lib/i18n";
import { PromotionPage } from "@/components/pages/PromotionPage";
import { trackActivity } from "@/lib/trackActivity";

const categoryMap: Record<string, string[]> = {
  전체: [],
  관광: ["관광"],
  맛집: ["쇼핑·음식"],
  공원: ["자연"],
  휴식: ["휴양"],
  쇼핑: ["쇼핑"],
  의료: ["의료"],
};

const filterValues = [
  "전체",
  "관광",
  "맛집",
  "공원",
  "휴식",
  "쇼핑",
  "의료",
] as const;

export function RecommendPage() {
  const [subTab, setSubTab] = useState<"places" | "promo">("places");
  const [filter, setFilter] = useState<(typeof filterValues)[number]>("전체");
  const { lang, setRecommendSubTab } = useStore();

  useEffect(() => {
    setRecommendSubTab(subTab);
  }, [subTab, setRecommendSubTab]);
  const t = i18n[lang].recommend;
  const cats = categoryMap[filter];
  const list =
    filter === "전체"
      ? mockPlaces
      : mockPlaces.filter((p) => cats.includes(p.category));

  return (
    <div
      className="min-h-full min-h-screen bg-[#f5f6fa] text-black pb-24 scrollbar-thin"
      style={{ minHeight: "100%" }}
    >
      <Header titleKey="recommend" dark={false} />
      <div className="max-w-[430px] mx-auto px-4">
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => setSubTab("places")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${
              subTab === "places"
                ? "bg-accent text-white shadow-md"
                : "bg-white/80 text-black/60"
            }`}
          >
            추천 장소
          </button>
          <button
            type="button"
            onClick={() => setSubTab("promo")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${
              subTab === "promo"
                ? "bg-accent text-white shadow-md"
                : "bg-white/80 text-black/60"
            }`}
          >
            업체 홍보
          </button>
        </div>

        {subTab === "places" && (
          <>
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2"
            >
              <input
                type="search"
                placeholder={`${i18n[lang].common.search}...`}
                className="w-full glass-light px-4 py-3 rounded-xl text-black/80 placeholder-black/50 text-sm outline-none border-2 border-transparent focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors"
              />
            </motion.div>

            <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-thin">
              {filterValues.map((value, i) => (
                <motion.button
                  key={value}
                  type="button"
                  onClick={() => {
                    if (value !== "전체") void trackActivity("click_category", value);
                    setFilter(value);
                  }}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium active:scale-[0.98] ${
                    filter === value
                      ? "bg-accent text-white"
                      : "bg-white/80 text-black/70"
                  }`}
                  whileTap={{ scale: 0.96 }}
                >
                  {t.placeCategories[i]}
                </motion.button>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              <AnimatePresence mode="popLayout">
                {list.map((place, i) => (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    dark={false}
                    staggerDelay={i * 0.05}
                  />
                ))}
              </AnimatePresence>
            </div>
          </>
        )}

        {subTab === "promo" && (
          <div className="mt-4">
            <PromotionPage />
          </div>
        )}
      </div>
    </div>
  );
}
