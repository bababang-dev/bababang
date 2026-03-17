"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Crown,
  FileText,
  Bookmark,
  MessageCircle,
  Heart,
  CreditCard,
  Coins,
  User,
  Languages,
  Settings,
  ChevronRight,
} from "lucide-react";
import { useStore } from "@/stores/useStore";
import { mockUser } from "@/lib/mockData";
import { i18n } from "@/lib/i18n";
import { Header } from "@/components/layout/Header";

const menuIcons = {
  membership: CreditCard,
  tokens: Coins,
  profile: User,
  language: Languages,
  settings: Settings,
};

export function MyPage() {
  const { lang, setUser, setMembershipOpen } = useStore();
  const user = useStore((s) => s.user);
  useEffect(() => {
    if (!user) setUser(mockUser);
  }, [user, setUser]);

  const u = user ?? mockUser;
  const t = i18n[lang].myPage;
  const displayName = lang === "zh" ? u.nameZh : u.name;

  const stats = [
    { key: "posts", value: u.stats.posts, icon: FileText },
    { key: "bookmarks", value: u.stats.bookmarks, icon: Bookmark },
    { key: "comments", value: 0, icon: MessageCircle },
    { key: "likes", value: 0, icon: Heart },
  ];

  const menuItems = [
    { key: "membership" as const, label: t.menuMembership, onClick: () => setMembershipOpen(true) },
    { key: "tokens" as const, label: t.menuTokens },
    { key: "profile" as const, label: t.menuProfile },
    { key: "language" as const, label: t.menuLanguage },
    { key: "settings" as const, label: t.menuSettings },
  ];

  return (
    <div className="min-h-full bg-[#0a0a0f] text-white pb-24 scrollbar-thin">
      <Header titleKey="my" showSearch={false} dark />
      <div className="max-w-[430px] mx-auto px-4">
        {/* 프로필 카드: 글래스 다크 + 보라 그라데이션 아바타 + PREMIUM 배지 */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-dark p-5 mt-4 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center font-outfit text-2xl font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #6c5ce7 0%, #8b5cf6 100%)",
              }}
            >
              {u.name.slice(0, 1)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-outfit font-semibold text-lg">{displayName}</h2>
                {u.plan === "premium" && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/20 text-gold text-xs font-medium">
                    <Crown className="w-3.5 h-3.5" />
                    PREMIUM
                  </span>
                )}
              </div>
              <p className="text-white/60 text-sm mt-0.5">{u.email}</p>
            </div>
          </div>
        </motion.section>

        {/* 활동 통계 4칸 */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-4 gap-2 mt-4"
        >
          {stats.map(({ key, value, icon: Icon }) => (
            <div
              key={key}
              className="glass-dark p-4 flex flex-col items-center gap-1 active:scale-[0.98] transition-transform rounded-2xl"
            >
              <Icon className="w-5 h-5 text-accent" />
              <span className="font-outfit font-semibold">{value}</span>
              <span className="text-[10px] text-white/60">
                {key === "posts"
                  ? t.statsPosts
                  : key === "bookmarks"
                    ? t.statsBookmarks
                    : key === "comments"
                      ? t.statsComments
                      : t.statsLikes}
              </span>
            </div>
          ))}
        </motion.section>

        {/* 메뉴 리스트 */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 space-y-1"
        >
          {menuItems.map(({ key, label, onClick }) => {
            const Icon = menuIcons[key];
            return (
              <motion.button
                key={key}
                type="button"
                onClick={onClick}
                className="w-full glass-dark p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform rounded-2xl"
                whileTap={{ scale: 0.98 }}
              >
                <Icon className="w-5 h-5 text-white/70" />
                <span className="flex-1">{label}</span>
                {key === "tokens" && (
                  <span className="text-accent font-medium">{u.tokens}</span>
                )}
                <ChevronRight className="w-5 h-5 text-white/40" />
              </motion.button>
            );
          })}
        </motion.section>
      </div>
    </div>
  );
}
