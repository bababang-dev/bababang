import { create } from "zustand";
import type { TabKey, Lang, User, ChatMessage } from "@/types";

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

  // 유저
  user: User | null;
  setUser: (user: User | null) => void;

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

export const useStore = create<AppState>((set, get) => ({
  activeTab: "home",
  setActiveTab: (tab) => set({ activeTab: tab }),

  lang: "ko",
  setLang: (lang) => set({ lang }),

  chatOpen: false,
  setChatOpen: (open) => set({ chatOpen: open }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  chatMessages: [],
  addChatMessage: (msg) =>
    set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  clearChatMessages: () => set({ chatMessages: [] }),

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

  user: null,
  setUser: (user) => set({ user }),

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
