import { create } from "zustand";
import { mockPosts } from "@/lib/mockData";
import type { TabKey, Lang, User, ChatMessage, Post } from "@/types";

interface AppState {
  // 네비게이션
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;

  // 언어
  lang: Lang;
  setLang: (lang: Lang) => void;

  // AI 채팅 패널
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  toggleChat: () => void;
  chatMessages: ChatMessage[];
  addChatMessage: (msg: ChatMessage) => void;
  clearChatMessages: () => void;
  chatFeedback: Array<{
    messageIndex: number;
    feedback: string;
    reason?: string;
    timestamp: Date;
  }>;
  addFeedback: (feedback: {
    messageIndex: number;
    feedback: string;
    reason?: string;
    timestamp: Date;
  }) => void;
  adminMode: boolean;
  activateAdmin: () => void;
  deactivateAdmin: () => void;
  adminTapCount: number;
  incrementAdminTap: () => void;
  resetAdminTap: () => void;
  reports: Array<{ shopName: string; reason: string; date: string }>;
  addReport: (report: { shopName: string; reason: string; date: string }) => void;
  questionStats: { total: number; today: number };
  incrementQuestionCount: () => void;
  questionStatsDate: string;

  // 북마크
  bookmarkedPosts: Set<string>;
  bookmarkedPlaces: Set<string>;
  togglePostBookmark: (id: string) => void;
  togglePlaceBookmark: (id: string) => void;

  // UI 상태
  detailView: string | null;
  setDetailView: (id: string | null) => void;
  membershipOpen: boolean;
  setMembershipOpen: (open: boolean) => void;
  writePostOpen: boolean;
  openWritePost: () => void;
  closeWritePost: () => void;

  // 유저
  user: User | null;
  setUser: (user: User | null) => void;
  posts: Post[];
  addPost: (post: Post) => void;

  // 무료 회원 일일 질문 제한
  dailyQuestionCount: number;
  lastQuestionDate: string;
  incrementQuestion: () => void;
  canAskQuestion: () => boolean;
  deductToken: () => void;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function initialLang(): Lang {
  if (typeof window === "undefined") return "ko";
  const saved = window.localStorage.getItem("bababang-lang");
  if (saved === "ko" || saved === "zh") return saved;
  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "ko";
}

export const useStore = create<AppState>((set, get) => ({
  activeTab: "home",
  setActiveTab: (tab) => set({ activeTab: tab }),

  lang: initialLang(),
  setLang: (lang) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("bababang-lang", lang);
    }
    set({ lang });
  },

  chatOpen: false,
  setChatOpen: (open) => set({ chatOpen: open }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  chatMessages: [],
  addChatMessage: (msg) =>
    set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  clearChatMessages: () => set({ chatMessages: [] }),
  chatFeedback: [],
  addFeedback: (feedback) =>
    set((s) => ({ chatFeedback: [...s.chatFeedback, feedback] })),
  adminMode: false,
  activateAdmin: () => set({ adminMode: true }),
  deactivateAdmin: () => set({ adminMode: false }),
  adminTapCount: 0,
  incrementAdminTap: () => set((s) => ({ adminTapCount: s.adminTapCount + 1 })),
  resetAdminTap: () => set({ adminTapCount: 0 }),
  reports: [
    { shopName: "깡통집", reason: "정보가 오래됨", date: "2026-03-17" },
    { shopName: "루위", reason: "영업시간 오류", date: "2026-03-17" },
  ],
  addReport: (report) => set((s) => ({ reports: [report, ...s.reports] })),
  questionStats: { total: 0, today: 0 },
  questionStatsDate: todayStr(),
  incrementQuestionCount: () =>
    set((s) => {
      const today = todayStr();
      const nextToday = s.questionStatsDate === today ? s.questionStats.today + 1 : 1;
      return {
        questionStats: { total: s.questionStats.total + 1, today: nextToday },
        questionStatsDate: today,
      };
    }),

  bookmarkedPosts: new Set(),
  bookmarkedPlaces: new Set(),
  togglePostBookmark: (id) =>
    set((s) => {
      const next = new Set(s.bookmarkedPosts);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { bookmarkedPosts: next };
    }),
  togglePlaceBookmark: (id) =>
    set((s) => {
      const next = new Set(s.bookmarkedPlaces);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { bookmarkedPlaces: next };
    }),

  detailView: null,
  setDetailView: (id) => set({ detailView: id }),
  membershipOpen: false,
  setMembershipOpen: (open) => set({ membershipOpen: open }),
  writePostOpen: false,
  openWritePost: () => set({ writePostOpen: true }),
  closeWritePost: () => set({ writePostOpen: false }),

  user: null,
  setUser: (user) => set({ user }),
  posts: mockPosts,
  addPost: (post) => set((s) => ({ posts: [post, ...s.posts] })),

  dailyQuestionCount: 0,
  lastQuestionDate: "",
  incrementQuestion: () =>
    set((s) => {
      const today = todayStr();
      if (s.lastQuestionDate !== today)
        return { lastQuestionDate: today, dailyQuestionCount: 1 };
      return { dailyQuestionCount: s.dailyQuestionCount + 1 };
    }),
  canAskQuestion: () => {
    const s = get();
    if (!s.user) return false;
    if (s.user.plan === "premium")
      return true;
    const today = todayStr();
    const count = s.lastQuestionDate === today ? s.dailyQuestionCount : 0;
    return count < 3;
  },
  deductToken: () =>
    set((s) => {
      if (!s.user) return {};
      const next = Math.max(0, s.user.tokens - 1);
      return { user: { ...s.user, tokens: next } };
    }),
}));
