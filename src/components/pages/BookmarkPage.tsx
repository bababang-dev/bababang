"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark as BookmarkIcon } from "lucide-react";
import { useStore } from "@/stores/useStore";
import { Header } from "@/components/layout/Header";
import { PostCard } from "@/components/cards/PostCard";
import { PlaceCard } from "@/components/cards/PlaceCard";
import { mockPosts, mockPlaces } from "@/lib/mockData";
import { i18n } from "@/lib/i18n";

type Tab = "posts" | "places";

export function BookmarkPage() {
  const [tab, setTab] = useState<Tab>("posts");
  const { lang, bookmarkedPosts, bookmarkedPlaces } = useStore();
  const t = i18n[lang].bookmark;

  const bookmarkedPostsList = mockPosts.filter((p) => bookmarkedPosts.has(p.id));
  const bookmarkedPlacesList = mockPlaces.filter((p) =>
    bookmarkedPlaces.has(p.id)
  );
  const isEmpty =
    (tab === "posts" && bookmarkedPostsList.length === 0) ||
    (tab === "places" && bookmarkedPlacesList.length === 0);

  return (
    <div
      className="min-h-full min-h-screen text-black pb-24 scrollbar-thin"
      style={{ background: "#f5f6fa", minHeight: "100%" }}
    >
      <Header titleKey="bookmark" dark={false} />
      <div className="max-w-[430px] mx-auto px-4">
        {/* 탭 전환 */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2 mt-4 p-1 rounded-xl bg-white/80"
        >
          {(["posts", "places"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === key ? "bg-accent text-white" : "text-black/60"
              }`}
            >
              {key === "posts" ? t.posts : t.places}
            </button>
          ))}
        </motion.div>

        {/* 리스트 또는 빈 상태 */}
        <div className="mt-6">
          <AnimatePresence mode="wait">
            {isEmpty ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 px-4"
              >
                <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4">
                  <BookmarkIcon className="w-8 h-8 text-black/30" />
                </div>
                <p className="text-black/70 font-medium">{t.empty}</p>
                <p className="text-sm text-black/50 mt-1">{t.emptySub}</p>
              </motion.div>
            ) : tab === "posts" ? (
              <motion.div
                key="posts"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-3"
              >
                {bookmarkedPostsList.map((post, i) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    dark={false}
                    staggerDelay={i * 0.05}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="places"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-3"
              >
                {bookmarkedPlacesList.map((place, i) => (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    dark={false}
                    staggerDelay={i * 0.05}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
