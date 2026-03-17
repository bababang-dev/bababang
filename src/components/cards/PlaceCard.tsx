"use client";

import { motion } from "framer-motion";
import { Star, MapPin, Bookmark } from "lucide-react";
import { useStore } from "@/stores/useStore";
import { i18n } from "@/lib/i18n";
import type { Place } from "@/types";

const placeEmoji: Record<string, string> = {
  관광: "🍺",
  자연: "⛰️",
  "쇼핑·음식": "🛒",
  휴양: "♨️",
  쇼핑: "🛍️",
  의료: "🏥",
};

interface PlaceCardProps {
  place: Place;
  dark?: boolean;
  staggerDelay?: number;
}

export function PlaceCard({
  place,
  dark = false,
  staggerDelay,
}: PlaceCardProps) {
  const { lang, togglePlaceBookmark, setDetailView } = useStore();
  const isBookmarked = useStore((s) => s.bookmarkedPlaces.has(place.id));
  const t = i18n[lang].common;

  const name = lang === "zh" ? place.nameZh : place.name;
  const address = lang === "zh" ? place.addressZh : place.address;
  const emoji = placeEmoji[place.category] ?? "📍";

  return (
    <motion.article
      layout
      initial={
        staggerDelay != null ? { opacity: 0, y: 12 } : { opacity: 1, y: 0 }
      }
      animate={{ opacity: 1, y: 0 }}
      transition={
        staggerDelay != null ? { delay: staggerDelay, duration: 0.25 } : {}
      }
      className={`rounded-2xl overflow-hidden border active:scale-[0.98] transition-transform ${
        dark ? "glass-card-dark" : "glass-light"
      } p-4 cursor-pointer`}
      onClick={() => setDetailView(place.id)}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex gap-3">
        <div className="w-14 h-14 rounded-xl bg-accent/10 flex-shrink-0 flex items-center justify-center text-2xl">
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-outfit font-semibold line-clamp-1">{name}</h3>
          <p className="text-xs opacity-70 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="line-clamp-1">{address}</span>
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="flex items-center gap-1 text-gold">
              <Star className="w-4 h-4 fill-gold" />
              {place.rating}
            </span>
            <span className="text-xs opacity-60">
              {t.reviewCount} {place.reviews}
            </span>
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlaceBookmark(place.id);
              }}
              className="ml-auto p-1 rounded-lg hover:bg-black/5"
              whileTap={{ scale: 0.9 }}
            >
              <motion.span
                key={isBookmarked ? "on" : "off"}
                initial={isBookmarked ? { scale: 1.35 } : { scale: 1 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 18,
                }}
                className="inline-block"
              >
                <Bookmark
                  className="w-4 h-4"
                  fill={isBookmarked ? "currentColor" : "none"}
                />
              </motion.span>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
