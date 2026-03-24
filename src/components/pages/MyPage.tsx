"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  X,
  Loader2,
  Camera,
  Check,
} from "lucide-react";
import { useStore } from "@/stores/useStore";
import { i18n } from "@/lib/i18n";
import { Header } from "@/components/layout/Header";
import type { Lang } from "@/types";

const menuIcons = {
  membership: CreditCard,
  tokens: Coins,
  profile: User,
  language: Languages,
  settings: Settings,
  admin: Shield,
};

function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return raw || "—";
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

function formatRelativeTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (lang === "zh") {
    if (s < 60) return `${s}秒前`;
    if (s < 3600) return `${Math.floor(s / 60)}分钟前`;
    if (s < 86400) return `${Math.floor(s / 3600)}小时前`;
    return `${Math.floor(s / 86400)}天前`;
  }
  if (s < 60) return `${s}초 전`;
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

type TokenItem = { kind: "ai" | "post"; label: string; at: string };

export function MyPage() {
  const {
    lang,
    setLang,
    setMembershipOpen,
    adminMode,
    activateAdmin,
    incrementAdminTap,
    resetAdminTap,
    adminTapCount,
    setActiveTab,
    logout,
    openLoginModal,
    currentUserId,
    setUser,
    profileEditOpen,
    openProfileEdit,
    closeProfileEdit,
  } = useStore();
  const user = useStore((s) => s.user);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const [tokenOpen, setTokenOpen] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenItems, setTokenItems] = useState<TokenItem[]>([]);
  const [tokenCount, setTokenCount] = useState<number | null>(null);

  const [profileNick, setProfileNick] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const profileFileRef = useRef<HTMLInputElement>(null);

  const [langOpen, setLangOpen] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOn, setNotifOn] = useState(true);
  const [darkUiOn, setDarkUiOn] = useState(true);
  const [settingsToast, setSettingsToast] = useState<string | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const [phoneDisplay, setPhoneDisplay] = useState("");

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("bababang-user") : null;
      if (!raw) return;
      const p = JSON.parse(raw) as { phone?: string };
      if (p.phone) setPhoneDisplay(maskPhone(String(p.phone)));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (currentUserId == null) return;
    let cancelled = false;
    void fetch(`/api/auth/stats?userId=${currentUserId}`)
      .then((r) => r.json())
      .then(
        (data: { posts: number; bookmarks: number; comments: number; likes: number }) => {
          if (cancelled) return;
          const prev = useStore.getState().user;
          if (!prev) return;
          useStore.getState().setUser({
            ...prev,
            stats: {
              ...prev.stats,
              posts: data.posts ?? 0,
              bookmarks: data.bookmarks ?? 0,
              comments: data.comments ?? 0,
              likes: data.likes ?? 0,
            },
          });
        }
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!tokenOpen || currentUserId == null) return;
    setTokenLoading(true);
    void fetch(`/api/auth/token-history?userId=${currentUserId}`)
      .then((r) => r.json())
      .then((d: { tokens?: number; items?: TokenItem[]; error?: string }) => {
        if (d.error) {
          setTokenItems([]);
          setTokenCount(null);
          return;
        }
        const tc = typeof d.tokens === "number" ? d.tokens : null;
        setTokenCount(tc);
        if (tc != null) {
          const prev = useStore.getState().user;
          if (prev) useStore.getState().setUser({ ...prev, tokens: tc });
        }
        setTokenItems(Array.isArray(d.items) ? d.items : []);
      })
      .catch(() => {
        setTokenItems([]);
        setTokenCount(null);
      })
      .finally(() => setTokenLoading(false));
  }, [tokenOpen, currentUserId]);

  useEffect(() => {
    if (!profileEditOpen || !user) return;
    setProfileNick(user.name);
    setProfileAvatar(user.avatar);
  }, [profileEditOpen, user]);

  const showSettingsToast = useCallback((msg: string) => {
    setSettingsToast(msg);
    window.setTimeout(() => setSettingsToast(null), 2000);
  }, []);

  const onProfileFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) setProfileAvatar(data.url);
      else showSettingsToast(data.error ?? "업로드 실패");
    } catch {
      showSettingsToast("업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const handleProfileAiAvatar = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const photoUrl =
        profileAvatar && profileAvatar.startsWith("http") ? profileAvatar : undefined;
      const res = await fetch("/api/ai-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) setProfileAvatar(data.url);
      else alert(data.error || "생성에 실패했어요");
    } catch {
      alert("생성에 실패했어요");
    } finally {
      setAiLoading(false);
    }
  };

  const saveProfile = async () => {
    const nick = profileNick.trim();
    if (!nick || currentUserId == null) {
      showSettingsToast(lang === "zh" ? "请填写昵称" : "닉네임을 입력해주세요");
      return;
    }
    const avatar = profileAvatar.trim() || "👤";
    setProfileSaving(true);
    try {
      const res = await fetch("/api/auth/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          nickname: nick,
          avatar,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        showSettingsToast(data.error ?? "저장 실패");
        return;
      }
      const prev = useStore.getState().user;
      if (prev) {
        setUser({
          ...prev,
          name: nick,
          nameZh: nick,
          avatar,
        });
      }
      try {
        const raw = window.localStorage.getItem("bababang-user");
        if (raw) {
          const p = JSON.parse(raw) as Record<string, unknown>;
          p.nickname = nick;
          p.avatar = avatar;
          window.localStorage.setItem("bababang-user", JSON.stringify(p));
        }
      } catch {
        /* ignore */
      }
      showSettingsToast(lang === "zh" ? "已保存" : "저장했어요");
      closeProfileEdit();
    } catch {
      showSettingsToast("저장 실패");
    } finally {
      setProfileSaving(false);
    }
  };

  const clearCache = () => {
    try {
      window.localStorage.clear();
      logout();
      showSettingsToast(lang === "zh" ? "缓存已清除" : "캐시가 삭제되었어요");
      setSettingsOpen(false);
    } catch {
      showSettingsToast("실패");
    }
  };

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
    { key: "comments", value: u.stats.comments, icon: MessageCircle },
    { key: "likes", value: u.stats.likes, icon: Heart },
  ];

  const menuItems = [
    { key: "membership" as const, label: t.menuMembership, onClick: () => setMembershipOpen(true) },
    { key: "tokens" as const, label: t.menuTokens, onClick: () => setTokenOpen(true) },
    { key: "profile" as const, label: t.menuProfile, onClick: () => openProfileEdit() },
    { key: "language" as const, label: t.menuLanguage, onClick: () => setLangOpen(true) },
    { key: "settings" as const, label: t.menuSettings, onClick: () => setSettingsOpen(true) },
  ];
  const adminMenu = adminMode
    ? [{ key: "admin" as const, label: "🔒 관리자", onClick: () => setActiveTab("admin") }]
    : [];

  const displayTokens = tokenCount ?? u.tokens;
  const hasPhotoForAi = Boolean(profileAvatar && profileAvatar.startsWith("http"));

  return (
    <div className="min-h-full bg-[#0a0a0f] text-white pb-24 scrollbar-thin">
      <Header titleKey="my" showSearch={false} dark />
      <div className="max-w-[430px] mx-auto px-4">
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
                <img src={u.avatar} alt="" className="w-full h-full object-cover" />
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

      {/* 토큰 모달 */}
      <AnimatePresence>
        {tokenOpen && (
          <motion.div
            className="fixed inset-0 z-[80] flex flex-col bg-[#0a0a0f]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold">
                {lang === "zh" ? "代币" : "토큰"}
              </h2>
              <button
                type="button"
                onClick={() => setTokenOpen(false)}
                className="p-2 rounded-full bg-white/10"
                aria-label="close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-6">
              {tokenLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-accent" />
                </div>
              ) : (
                <>
                  <p className="text-white/80 text-sm mb-1">
                    {lang === "zh" ? "当前持有" : "현재 보유 토큰"}
                  </p>
                  <p className="text-3xl font-bold text-accent mb-8">
                    {displayTokens}
                    <span className="text-lg font-medium text-white/60 ml-1">
                      {lang === "zh" ? "个" : "개"}
                    </span>
                  </p>
                  <p className="text-white/70 text-sm mb-3">
                    {lang === "zh" ? "使用记录（最近10条）" : "토큰 사용 내역 (최근 10개)"}
                  </p>
                  <ul className="space-y-3">
                    {tokenItems.length === 0 && (
                      <li className="text-white/50 text-sm">
                        {lang === "zh" ? "暂无记录" : "내역이 없어요"}
                      </li>
                    )}
                    {tokenItems.map((item, i) => (
                      <li
                        key={`${item.at}-${i}`}
                        className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm"
                      >
                        <div className="flex justify-between gap-2 items-start">
                          <span className="text-white/90 break-all pr-2">
                            {item.kind === "ai"
                              ? `${lang === "zh" ? "AI 提问" : "AI 질문"}: ${item.label}`
                              : lang === "zh"
                                ? `发帖${item.label && item.label !== "글쓰기" ? ` · ${item.label}` : ""}`
                                : `글쓰기${item.label && item.label !== "글쓰기" ? ` · ${item.label}` : ""}`}
                          </span>
                          <span className="text-red-400 shrink-0 whitespace-nowrap">
                            {lang === "zh" ? "-1代币" : "-1토큰"}
                          </span>
                        </div>
                        <p className="text-xs text-white/45 mt-1">{formatRelativeTime(item.at, lang)}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-8 text-sm text-white/55 leading-relaxed border-t border-white/10 pt-6">
                    {lang === "zh"
                      ? "代币用于 AI 提问与发帖。每天免费补充 3 个！"
                      : "토큰은 AI 질문, 글쓰기에 사용돼요. 매일 무료 3개 충전!"}
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 프로필 모달 */}
      <AnimatePresence>
        {profileEditOpen && (
          <motion.div
            className="fixed inset-0 z-[80] flex flex-col bg-[#0a0a0f]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold">
                {lang === "zh" ? "编辑资料" : "프로필"}
              </h2>
              <button
                type="button"
                onClick={() => closeProfileEdit()}
                className="p-2 rounded-full bg-white/10"
                aria-label="close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
              <input
                ref={profileFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onProfileFile}
              />
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => profileFileRef.current?.click()}
                  className="relative w-28 h-28 rounded-full overflow-hidden flex items-center justify-center text-5xl"
                  style={{
                    background: "linear-gradient(135deg, #6c5ce7 0%, #8b5cf6 100%)",
                  }}
                >
                  {/^https?:\/\//i.test(profileAvatar) ? (
                    <img src={profileAvatar} alt="" className="w-full h-full object-cover" />
                  ) : !profileAvatar || profileAvatar.trim() === "" ? (
                    profileNick.slice(0, 1) || "?"
                  ) : (
                    <span>{profileAvatar}</span>
                  )}
                  <span className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                    <Camera className="w-4 h-4" />
                  </span>
                </button>
                {uploading && (
                  <span className="text-xs text-white/50 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Upload…
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleProfileAiAvatar}
                  disabled={aiLoading}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #6c5ce7 0%, #8b5cf6 100%)",
                  }}
                >
                  {aiLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                  ) : (
                    "✨ "
                  )}
                  {lang === "zh" ? "AI 形象生成" : "AI 캐릭터 생성"}
                </button>
                {!hasPhotoForAi && (
                  <p className="text-xs text-white/40 text-center">
                    {lang === "zh" ? "可先上传照片再生成" : "사진을 올리면 더 잘 나와요"}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">
                  {lang === "zh" ? "昵称" : "닉네임"}
                </label>
                <input
                  value={profileNick}
                  onChange={(e) => setProfileNick(e.target.value)}
                  className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">
                  {lang === "zh" ? "手机" : "휴대폰"}
                </label>
                <div className="w-full rounded-xl bg-white/5 border border-white/5 px-3 py-2.5 text-white/60">
                  {phoneDisplay || "—"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void saveProfile()}
                disabled={profileSaving}
                className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #6c5ce7 0%, #8b5cf6 100%)",
                }}
              >
                {profileSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : lang === "zh" ? "保存" : "저장"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 언어 바텀시트 */}
      <AnimatePresence>
        {langOpen && (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-[80] bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLangOpen(false)}
              aria-label="backdrop"
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-[81] rounded-t-2xl bg-[#171725] border border-white/10 border-b-0 max-w-[430px] mx-auto px-4 pb-10 pt-2"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28 }}
            >
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
              <p className="text-center text-white/60 text-sm mb-3">
                {lang === "zh" ? "语言" : "언어"}
              </p>
              {(
                [
                  { code: "ko" as const, flag: "🇰🇷", label: "한국어" },
                  { code: "zh" as const, flag: "🇨🇳", label: "中文" },
                ] as const
              ).map(({ code, flag, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setLang(code);
                    setLangOpen(false);
                  }}
                  className="w-full flex items-center gap-3 py-3 px-2 rounded-xl active:bg-white/5"
                >
                  <span className="text-xl">{flag}</span>
                  <span className="flex-1 text-left">{label}</span>
                  {lang === code ? (
                    <Check className="w-5 h-5 text-accent" />
                  ) : (
                    <span className="w-5 h-5" />
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 설정 모달 */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            className="fixed inset-0 z-[80] flex flex-col bg-[#0a0a0f]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold">
                {lang === "zh" ? "设置" : "설정"}
              </h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="p-2 rounded-full bg-white/10"
                aria-label="close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              <div className="rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/10">
                <div className="flex items-center justify-between p-4">
                  <span>{lang === "zh" ? "通知" : "알림 설정"}</span>
                  <button
                    type="button"
                    onClick={() => setNotifOn((v) => !v)}
                    className={`w-12 h-7 rounded-full transition-colors ${notifOn ? "bg-accent" : "bg-white/20"}`}
                  >
                    <span
                      className={`block w-6 h-6 m-0.5 rounded-full bg-white transition-transform ${notifOn ? "translate-x-5" : ""}`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between p-4">
                  <span>{lang === "zh" ? "深色模式" : "다크모드"}</span>
                  <button
                    type="button"
                    onClick={() => setDarkUiOn((v) => !v)}
                    className={`w-12 h-7 rounded-full ${darkUiOn ? "bg-accent" : "bg-white/20"}`}
                  >
                    <span
                      className={`block w-6 h-6 m-0.5 rounded-full bg-white transition-transform ${darkUiOn ? "translate-x-5" : ""}`}
                    />
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={clearCache}
                className="w-full rounded-2xl bg-white/5 border border-white/10 p-4 text-left active:bg-white/10"
              >
                {lang === "zh" ? "清除缓存" : "캐시 삭제"}
              </button>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex justify-between">
                <span className="text-white/60">{lang === "zh" ? "版本" : "앱 버전"}</span>
                <span>v1.0.0</span>
              </div>
              <a
                href="mailto:support@bababang.com"
                className="block rounded-2xl bg-white/5 border border-white/10 p-4"
              >
                {lang === "zh" ? "联系：support@bababang.com · 微信 bababang_qd" : "문의: support@bababang.com · 위챗 bababang_qd"}
              </a>
              <button
                type="button"
                onClick={() => setTermsOpen(true)}
                className="w-full rounded-2xl bg-white/5 border border-white/10 p-4 text-left"
              >
                {lang === "zh" ? "服务条款" : "이용약관"}
              </button>
              <button
                type="button"
                onClick={() => setPrivacyOpen(true)}
                className="w-full rounded-2xl bg-white/5 border border-white/10 p-4 text-left"
              >
                {lang === "zh" ? "隐私政策" : "개인정보처리방침"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 약관 / 개인정보 */}
      <AnimatePresence>
        {termsOpen && (
          <motion.div
            className="fixed inset-0 z-[85] flex flex-col bg-[#0a0a0f]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold">{lang === "zh" ? "服务条款" : "이용약관"}</h2>
              <button
                type="button"
                onClick={() => setTermsOpen(false)}
                className="p-2 rounded-full bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 text-sm text-white/70 leading-relaxed">
              {lang === "zh" ? (
                <p>
                  欢迎使用爸爸帮。使用本服务即表示您同意遵守社区规范，不发布违法或侵权内容。我们保留因违规终止服务的权利。
                </p>
              ) : (
                <p>
                  바바방 서비스를 이용해 주셔서 감사합니다. 서비스 이용 시 커뮤니티 가이드를 준수해 주시고, 불법·침해 콘텐츠는
                  금지됩니다. 위반 시 이용이 제한될 수 있습니다.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {privacyOpen && (
          <motion.div
            className="fixed inset-0 z-[85] flex flex-col bg-[#0a0a0f]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold">{lang === "zh" ? "隐私政策" : "개인정보처리방침"}</h2>
              <button
                type="button"
                onClick={() => setPrivacyOpen(false)}
                className="p-2 rounded-full bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 text-sm text-white/70 leading-relaxed">
              {lang === "zh" ? (
                <p>
                  我们仅收集提供服务所必需的信息（如账号与使用记录），不会向无关第三方出售您的数据。您可随时联系客服了解详情。
                </p>
              ) : (
                <p>
                  서비스 제공에 필요한 최소한의 정보(계정, 이용 기록 등)만 처리하며, 제3자에게 무단 판매하지 않습니다. 문의는
                  고객센터로 연락 주세요.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {settingsToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[90] px-4 py-2 rounded-xl bg-[#171725] border border-white/10 text-sm shadow-lg">
          {settingsToast}
        </div>
      )}

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
