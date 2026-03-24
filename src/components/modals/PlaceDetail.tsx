"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Star, MapPin, X } from "lucide-react";
import { useStore } from "@/stores/useStore";
import { i18n } from "@/lib/i18n";
import { mockPlaces } from "@/lib/mockData";

const placeEmoji: Record<string, string> = {
  관광: "🍺",
  자연: "⛰️",
  "쇼핑·음식": "🛒",
  휴양: "♨️",
  쇼핑: "🛍️",
  의료: "🏥",
};

export function PlaceDetail() {
  const { detailView, setDetailView, lang, currentUserId, user, setUser, requireLogin } =
    useStore();
  const [reviewText, setReviewText] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewToast, setReviewToast] = useState<string | null>(null);
  const placeId = detailView && detailView.startsWith("pl") ? detailView : null;
  const place = placeId ? mockPlaces.find((p) => p.id === placeId) : null;
  const t = i18n[lang].common;

  if (!place) return null;

  const name = lang === "zh" ? place.nameZh : place.name;
  const address = lang === "zh" ? place.addressZh : place.address;
  const description = lang === "zh" ? place.descriptionZh : place.description;
  const tags = lang === "zh" ? place.tagsZh : place.tags;
  const emoji = placeEmoji[place.category] ?? "📍";

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[60] max-w-mobile mx-auto"
        onClick={() => setDetailView(null)}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[61] max-w-mobile mx-auto rounded-t-3xl bg-baba-light text-black max-h-[85vh] flex flex-col"
      >
        <div className="p-4 border-b border-black/5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center text-2xl">
              {emoji}
            </div>
            <div>
              <h2 className="font-outfit text-lg font-semibold">{name}</h2>
              <p className="text-sm text-black/60 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
                {address}
              </p>
            </div>
          </div>
          <motion.button
            type="button"
            onClick={() => setDetailView(null)}
            className="p-2 rounded-full hover:bg-black/5"
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>
        <div className="overflow-y-auto p-4 scrollbar-thin">
          <div className="flex items-center gap-2 text-gold">
            <Star className="w-5 h-5 fill-gold" />
            <span className="font-semibold">{place.rating}</span>
            <span className="text-black/60 text-sm">
              {t.reviewCount} {place.reviews}
            </span>
          </div>
          <p className="mt-4 text-black/90 leading-relaxed">{description}</p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 rounded-lg bg-accent/10 text-accent text-xs"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-black/10">
            <p className="text-sm font-medium text-black/80 mb-2">
              {lang === "zh" ? "写评价" : "리뷰 남기기"}
            </p>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder={lang === "zh" ? "分享您的体验…" : "다녀온 경험을 남겨주세요…"}
              className="w-full min-h-[88px] rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30"
            />
            <button
              type="button"
              disabled={reviewBusy || !reviewText.trim()}
              onClick={() => {
                if (!requireLogin()) return;
                setReviewBusy(true);
                setReviewToast(null);
                const content = `${name}\n${reviewText.trim()}`;
                void fetch("/api/tokens", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: currentUserId ?? 1,
                    amount: 3,
                    type: "earn",
                    reason: "리뷰",
                    content: content.slice(0, 500),
                  }),
                })
                  .then((r) => r.json())
                  .then(
                    (td: {
                      success?: boolean;
                      message?: string;
                      qualityFailed?: boolean;
                      tokens?: number;
                      error?: string;
                      limited?: boolean;
                    }) => {
                      if (td.qualityFailed && td.message) {
                        setReviewToast(td.message);
                      } else if (td.limited && td.error) {
                        setReviewToast(td.error);
                      } else if (td.success && td.message) {
                        setReviewToast(td.message);
                        setReviewText("");
                        if (typeof td.tokens === "number" && user) {
                          setUser({ ...user, tokens: td.tokens });
                        }
                      }
                    }
                  )
                  .finally(() => setReviewBusy(false));
              }}
              className="mt-2 w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {reviewBusy
                ? lang === "zh"
                  ? "提交中…"
                  : "전송 중…"
                : lang === "zh"
                  ? "提交评价"
                  : "리뷰 등록"}
            </button>
            {reviewToast ? (
              <p className="mt-2 text-xs text-black/60">{reviewToast}</p>
            ) : null}
          </div>
        </div>
      </motion.div>
    </>
  );
}
