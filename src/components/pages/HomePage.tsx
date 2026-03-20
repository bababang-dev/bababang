"use client";

import { motion } from "framer-motion";
import { Star, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/stores/useStore";
import { i18n } from "@/lib/i18n";
import { mockPosts, mockPlaces } from "@/lib/mockData";
import { Header } from "@/components/layout/Header";
import { PostCard } from "@/components/cards/PostCard";
import type { Place } from "@/types";

const placeEmoji: Record<string, string> = {
  관광: "🍺",
  자연: "⛰️",
  "쇼핑·음식": "🛒",
  휴양: "♨️",
  쇼핑: "🛍️",
  의료: "🏥",
};

function weatherConditionKo(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return "";
  if (s === "sunny" || s === "clear") return "맑음";
  if (s.includes("partly")) return "구름조금";
  if (s.includes("cloudy") || s.includes("overcast")) return "흐림";
  if (s.includes("rain")) return "비";
  if (s.includes("snow")) return "눈";
  if (s.includes("fog")) return "안개";
  return raw.trim();
}

function weatherEmojiFor(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return "☀️";
  if (s === "sunny" || s === "clear") return "☀️";
  if (s.includes("partly")) return "⛅";
  if (s.includes("cloudy") || s.includes("overcast")) return "☁️";
  if (s.includes("rain")) return "🌧️";
  if (s.includes("snow")) return "❄️";
  if (s.includes("fog")) return "🌫️";
  return "☀️";
}

function HotPlaceCard({
  place,
  lang,
  reviewCountLabel,
}: {
  place: Place;
  lang: "ko" | "zh";
  reviewCountLabel: string;
}) {
  const setDetailView = useStore((s) => s.setDetailView);
  const name = lang === "zh" ? place.nameZh : place.name;
  const category = lang === "zh" ? place.categoryZh : place.category;
  const emoji = placeEmoji[place.category] ?? "📍";
  return (
    <motion.article
      layout
      onClick={() => setDetailView(place.id)}
      className="glass-dark flex-shrink-0 w-[200px] p-4 rounded-2xl cursor-pointer active:scale-[0.98] transition-transform"
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex flex-col gap-2">
        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-[40px] leading-none">
          {emoji}
        </div>
        <h3 className="font-outfit font-bold text-white line-clamp-1 text-sm">
          {name}
        </h3>
        <p className="text-xs text-white/50">{category}</p>
        <div className="flex items-center gap-1.5 text-gold">
          <Star className="w-4 h-4 fill-gold" />
          <span className="text-sm font-semibold">{place.rating}</span>
          <span className="text-[10px] text-white/50">
            {reviewCountLabel} {place.reviews}
          </span>
        </div>
      </div>
    </motion.article>
  );
}

export function HomePage() {
  const { lang, setChatOpen, setActiveTab } = useStore();
  const t = i18n[lang];
  const hotPlaces = mockPlaces.slice(0, 4);
  const popularPosts = mockPosts.slice(0, 3);
  const [weather, setWeather] = useState<{
    temp: string;
    feelsLike: string;
    condition: string;
  } | null>(null);
  const [exchange, setExchange] = useState<{
    cnyToKrw: number;
    usdToKrw: number;
  } | null>(null);

  const DEFAULT_CNY_KRW = 190;
  const DEFAULT_USD_KRW = 1386;

  useEffect(() => {
    const load = async () => {
      let w: {
        temp: string;
        feelsLike: string;
        condition: string;
      } | null = null;
      let e: { cnyToKrw: number; usdToKrw: number } = {
        cnyToKrw: DEFAULT_CNY_KRW,
        usdToKrw: DEFAULT_USD_KRW,
      };

      try {
        const wr = await fetch("/api/weather");
        w = await wr.json();
        if (!wr.ok) w = { temp: "", feelsLike: "", condition: "" };
      } catch {
        w = { temp: "", feelsLike: "", condition: "" };
      }

      try {
        const er = await fetch("/api/exchange");
        const data = await er.json();
        const krw = Number(data.cnyToKrw);
        const usdKrw = Number(data.usdToKrw);
        if (!Number.isFinite(krw) || krw <= 10) {
          e = { cnyToKrw: DEFAULT_CNY_KRW, usdToKrw: DEFAULT_USD_KRW };
        } else {
          e = {
            cnyToKrw: Math.round(krw),
            usdToKrw: Number.isFinite(usdKrw) ? Math.round(usdKrw) : DEFAULT_USD_KRW,
          };
        }
      } catch {
        e = { cnyToKrw: DEFAULT_CNY_KRW, usdToKrw: DEFAULT_USD_KRW };
      }

      setWeather(w);
      setExchange(e);
    };
    load();
  }, []);

  const quickActions = [
    { emoji: "🍜", key: "foodShort" as const },
    { emoji: "📋", key: "visaShort" as const },
    { emoji: "🏥", key: "hospitalShort" as const },
    { emoji: "🏠", key: "realtyShort" as const },
  ];

  return (
    <div className="min-h-full bg-[#0a0a0f] text-white pb-24 scrollbar-thin">
      <Header titleKey="home" showSearch={false} dark />
      <div className="max-w-[430px] mx-auto px-4">
        {/* 히어로: 보라 그라데이션 + 배지 + 제목 + 서브 */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden mt-4 py-8 px-6 min-h-[200px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(108,92,231,0.25) 0%, rgba(20,20,35,0.9) 70%)",
          }}
        >
          <div
            className="absolute inset-0 opacity-90"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(108,92,231,0.4), transparent 60%)",
            }}
          />
          <div className="relative">
            <span
              className="inline-block px-3 py-1.5 rounded-full text-xs font-medium text-white/95 mb-4"
              style={{
                background: "rgba(108,92,231,0.5)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {t.home.heroBadge}
            </span>
            <h2
              className="font-outfit font-bold text-white whitespace-pre-line leading-tight"
              style={{ fontSize: "32px" }}
            >
              {t.home.heroTitle}
            </h2>
            <p className="text-white/50 text-sm mt-2">{t.home.heroSub}</p>
          </div>
        </motion.section>

        <div className="-mt-2 mb-5 w-full">
          <section
            className="glass-dark flex w-full items-stretch gap-0 overflow-hidden border border-white/10"
            style={{
              margin: "-8px 0 20px",
              padding: "16px 20px",
              borderRadius: 16,
            }}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1 pr-3">
              {!weather?.temp ? (
                <>
                  <p
                    className="leading-tight"
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: "var(--text-muted)",
                    }}
                  >
                    칭다오 날씨
                  </p>
                  <p
                    className="font-outfit leading-tight text-white"
                    style={{ fontSize: 26, fontWeight: 800 }}
                  >
                    …
                  </p>
                  <p
                    className="leading-tight"
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                    }}
                  >
                    불러오는 중
                  </p>
                </>
              ) : (
                <>
                  <p
                    className="leading-tight"
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: "var(--text-muted)",
                    }}
                  >
                    칭다오 날씨
                  </p>
                  <p
                    className="font-outfit leading-tight text-white"
                    style={{ fontSize: 26, fontWeight: 800 }}
                  >
                    {weatherEmojiFor(weather.condition)} {weather.temp}°C
                  </p>
                  <p
                    className="leading-tight"
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                    }}
                  >
                    {weatherConditionKo(weather.condition) || "—"} · 체감{" "}
                    {weather.feelsLike}°C
                  </p>
                </>
              )}
            </div>
            <div
              className="w-0 flex-shrink-0 self-stretch border-l border-solid"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
              aria-hidden
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1 pl-3 text-right">
              {!exchange ? (
                <>
                  <p
                    className="leading-tight"
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: "var(--text-muted)",
                    }}
                  >
                    실시간 환율{" "}
                    <span aria-hidden>🇨🇳</span> → <span aria-hidden>🇰🇷</span>
                  </p>
                  <p
                    className="font-outfit leading-tight text-white"
                    style={{ fontSize: 26, fontWeight: 800 }}
                  >
                    …
                  </p>
                  <p
                    className="leading-tight"
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                    }}
                  >
                    불러오는 중
                  </p>
                </>
              ) : (
                <>
                  <p
                    className="leading-tight"
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: "var(--text-muted)",
                    }}
                  >
                    실시간 환율{" "}
                    <span aria-hidden>🇨🇳</span> → <span aria-hidden>🇰🇷</span>
                  </p>
                  <p
                    className="font-outfit leading-tight text-white"
                    style={{ fontSize: 26, fontWeight: 800 }}
                  >
                    <span aria-hidden>🇨🇳</span> ¥1 = ₩
                    {exchange.cnyToKrw.toLocaleString("ko-KR")}
                  </p>
                  <p
                    className="leading-tight"
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                    }}
                  >
                    <span aria-hidden>🇺🇸</span> $1 = ₩
                    {exchange.usdToKrw.toLocaleString("ko-KR")}
                  </p>
                </>
              )}
            </div>
          </section>
        </div>

        {/* AI 카드: 보라 반투명 배경 + 테두리 + sparkle + 제목 + 서브 + send + shimmer */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4"
        >
          <motion.button
            type="button"
            onClick={() => setChatOpen(true)}
            className="w-full relative overflow-hidden rounded-2xl flex items-center gap-4 text-left p-4 animate-shimmer active:scale-[0.98] transition-transform border"
            style={{
              background: "rgba(108,92,231,0.15)",
              borderColor: "rgba(108,92,231,0.5)",
            }}
            whileTap={{ scale: 0.98 }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(108,92,231,0.4)" }}
            >
              <span className="text-2xl">✨</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-outfit font-bold text-white text-base">
                {t.quickAction.ask}
              </h3>
              <p className="text-[#b8a9f5] text-sm mt-0.5">
                {t.home.aiCardSub}
              </p>
            </div>
            <Send className="w-5 h-5 text-white/80 flex-shrink-0" />
          </motion.button>
        </motion.section>

        {/* 퀵메뉴: 4열 그리드, 글래스 다크, 이모지 32px + 라벨 */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-6"
        >
          <h3 className="font-outfit font-semibold text-sm text-white/80 mb-3">
            {t.home.quickMenuTitle}
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map(({ emoji, key }) => (
              <motion.button
                key={key}
                type="button"
                onClick={() => setChatOpen(true)}
                className="glass-dark p-4 flex flex-col items-center gap-2 rounded-2xl border border-white/10 active:scale-[0.98]"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  borderColor: "rgba(255,255,255,0.1)",
                }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-[32px] leading-none">{emoji}</span>
                <span className="text-xs text-white/60">
                  {t.quickAction[key]}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.section>

        {/* 핫플레이스: 제목 + "추천 →" + 가로 스크롤 200px 카드 */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-outfit font-semibold text-sm text-white/80">
              🔥 {t.home.hotPlaces}
            </h3>
            <button
              type="button"
              onClick={() => setActiveTab("recommend")}
              className="text-xs text-accent font-medium hover:underline"
            >
              {t.home.recommendLink}
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar -mx-4 px-4">
            {hotPlaces.map((place) => (
              <HotPlaceCard
                key={place.id}
                place={place}
                lang={lang}
                reviewCountLabel={t.common.reviewCount}
              />
            ))}
          </div>
        </motion.section>

        {/* 인기 게시글: 제목 + "커뮤니티 →" + PostCard 리스트 */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-8"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-outfit font-semibold text-sm text-white/80">
              {t.home.popularPosts}
            </h3>
            <button
              type="button"
              onClick={() => setActiveTab("community")}
              className="text-xs text-accent font-medium hover:underline"
            >
              {t.home.communityLink}
            </button>
          </div>
          <div className="space-y-3">
            {popularPosts.map((post) => (
              <PostCard key={post.id} post={post} dark />
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
