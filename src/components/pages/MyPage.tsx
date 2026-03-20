"use client";

import { useState } from "react";
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
  Shield,
  LogOut,
} from "lucide-react";
import { useStore } from "@/stores/useStore";
import { i18n } from "@/lib/i18n";
import { Header } from "@/components/layout/Header";

const menuIcons = {
  membership: CreditCard,
  tokens: Coins,
  profile: User,
  language: Languages,
  settings: Settings,
  admin: Shield,
};

export function MyPage() {
  const {
    lang,
    setMembershipOpen,
    adminMode,
    activateAdmin,
    incrementAdminTap,
    resetAdminTap,
    adminTapCount,
    setActiveTab,
    logout,
    openLoginModal,
  } = useStore();
  const user = useStore((s) => s.user);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const u = user;
  if (!u) {
    return (
      <div className="min-h-full bg-[#0a0a0f] text-white pb-24 scrollbar-thin">
        <Header titleKey="my" showSearch={false} dark />
        <div className="max-w-[430px] mx-auto px-4 pt-16 text-center">
          <p className="text-white/70 text-sm mb-4">로그인하고 마이페이지를 이용해 보세요</p>
          <button
            type="button"
            onClick={openLoginModal}
            className="px-8 py-3 rounded-xl font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, #6c5ce7 0%, #8b5cf6 100%)",
            }}
          >
            로그인
          </button>
        </div>
      </div>
    );
  }
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
  const adminMenu = adminMode
    ? [{ key: "admin" as const, label: "🔒 관리자", onClick: () => setActiveTab("admin") }]
    : [];

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
              className="w-16 h-16 rounded-full flex items-center justify-center font-outfit text-2xl font-bold text-white overflow-hidden shrink-0"
              style={{
                background: "linear-gradient(135deg, #6c5ce7 0%, #8b5cf6 100%)",
              }}
              onClick={() => {
                incrementAdminTap();
                if (adminTapCount + 1 >= 5) {
                  resetAdminTap();
                  setPasswordOpen(true);
                }
              }}
            >
              {/^https?:\/\//i.test(u.avatar) ? (
                <img
                  src={u.avatar}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : !u.avatar || u.avatar.trim() === "" ? (
                (lang === "zh" ? u.nameZh : u.name).slice(0, 1)
              ) : (
                <span className="text-3xl leading-none">{u.avatar}</span>
              )}
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
          {[...menuItems, ...adminMenu].map(({ key, label, onClick }) => {
            const Icon = menuIcons[key];
            return (
              <motion.button
                key={key}
                type="button"
                onClick={onClick}
                className="w-full glass-dark p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform rounded-2xl"
                whileTap={{ scale: 0.98 }}
              >
                {Icon ? <Icon className="w-5 h-5 text-white/70" /> : <span className="w-5 h-5" />}
                <span className="flex-1">{label}</span>
                {key === "tokens" && (
                  <span className="text-accent font-medium">{u.tokens}</span>
                )}
                <ChevronRight className="w-5 h-5 text-white/40" />
              </motion.button>
            );
          })}
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            onClick={() => setLogoutConfirm(true)}
            className="w-full glass-dark p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform rounded-2xl mt-2 border border-white/5"
            whileTap={{ scale: 0.98 }}
          >
            <LogOut className="w-5 h-5 text-white/70" />
            <span className="flex-1 text-left">로그아웃</span>
            <ChevronRight className="w-5 h-5 text-white/40" />
          </motion.button>
        </motion.section>
      </div>

      {logoutConfirm && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center px-6">
          <div className="w-full max-w-[360px] rounded-2xl bg-[#171725] p-4 border border-white/10">
            <p className="text-sm text-white/80 mb-3">로그아웃 하시겠어요?</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-white/10 text-sm"
                onClick={() => setLogoutConfirm(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-accent text-sm"
                onClick={() => {
                  setLogoutConfirm(false);
                  logout();
                }}
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center px-6">
          <div className="w-full max-w-[360px] rounded-2xl bg-[#171725] p-4 border border-white/10">
            <p className="text-sm text-white/80 mb-2">관리자 비밀번호</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm outline-none"
              placeholder="비밀번호 입력"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-white/10 text-sm"
                onClick={() => {
                  setPassword("");
                  setPasswordOpen(false);
                }}
              >
                취소
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-accent text-sm"
                onClick={() => {
                  if (password === "bababang2026") {
                    activateAdmin();
                  }
                  setPassword("");
                  setPasswordOpen(false);
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
