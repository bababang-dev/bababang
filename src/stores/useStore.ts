import { create } from "zustand";
import { mockPosts } from "@/lib/mockData";
import type { TabKey, Lang, User, ChatMessage, Post } from "@/types";

/** 로그인 API / localStorage 복원용 */
export type LoginUserPayload = {
  id: number;
  nickname: string;
  avatar: string;
  plan: "free" | "premium";
  tokens: number;
  language: Lang;
};

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
  /** 모바일 키보드 등 (하단 탭·FAB 숨김용) */
  isKeyboardOpen: boolean;
  setKeyboardOpen: (open: boolean) => void;
  chatMessages: ChatMessage[];
  addChatMessage: (msg: ChatMessage) => void;
  updateLastAiMessage: (
    text: string,
    extra?: { recommendedShops?: ChatMessage["recommendedShops"] }
  ) => void;
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

  // 유저 / 인증
  isLoggedIn: boolean;
  currentUserId: number | null;
  loginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  requireLogin: () => boolean;
  login: (user: LoginUserPayload) => void;
  logout: () => void;
  user: User | null;
  setUser: (user: User | null) => void;
  posts: Post[];
  setPosts: (posts: Post[]) => void;
  addPost: (post: Post) => void;

  // 무료 회원 일일 질문 제한
  dailyQuestionCount: number;
  lastQuestionDate: string;
  incrementQuestion: () => void;
  canAskQuestion: () => boolean;
  deductToken: () => void;

  /** 커뮤니티 목록 강제 새로고침 (글 작성 후 등) */
  postsRefreshTrigger: number;
  triggerPostsRefresh: () => void;

  /** 업체 홍보 등록 모달 */
  promotionModalOpen: boolean;
  openPromotionModal: () => void;
  closePromotionModal: () => void;
  promotionsRefreshTrigger: number;
  triggerPromotionsRefresh: () => void;

  /** 추천 탭 서브: 업체 홍보 FAB 표시용 */
  recommendSubTab: "places" | "promo";
  setRecommendSubTab: (t: "places" | "promo") => void;

  /** 길찾기 / 지도 액션시트 — destName=중국어(딥링크), koreanName=표시용 */
  mapActionSheet: {
    open: boolean;
    destLat: string;
    destLng: string;
    destName: string;
    destAddress: string;
    koreanName: string;
  } | null;
  openMapActionSheet: (
    destLat: string,
    destLng: string,
    destName: string,
    destAddress: string,
    koreanName?: string
  ) => void;
  closeMapActionSheet: () => void;

  /** 브라우저 GPS (앱 최초 / 길찾기용) */
  userLocation: { lat: number; lng: number } | null;
  setUserLocation: (loc: { lat: number; lng: number } | null) => void;
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
  isKeyboardOpen: false,
  setKeyboardOpen: (open) => set({ isKeyboardOpen: open }),
  chatMessages: [],
  addChatMessage: (msg) =>
    set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  updateLastAiMessage: (text, extra) =>
    set((s) => {
      const msgs = [...s.chatMessages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "ai") {
          msgs[i] = {
            ...msgs[i],
            text,
            ...(extra?.recommendedShops !== undefined
              ? { recommendedShops: extra.recommendedShops }
              : {}),
          };
          break;
        }
      }
      return { chatMessages: msgs };
    }),
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

  isLoggedIn: false,
  currentUserId: null,
  loginModalOpen: false,
  openLoginModal: () => set({ loginModalOpen: true }),
  closeLoginModal: () => set({ loginModalOpen: false }),
  requireLogin: () => {
    const s = get();
    if (s.isLoggedIn && s.currentUserId != null) return true;
    set({ loginModalOpen: true });
    return false;
  },
  login: (user) => {
    const joined = new Date().toISOString().slice(0, 7);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("bababang-lang", user.language);
    }
    set({
      isLoggedIn: true,
      currentUserId: user.id,
      lang: user.language,
      user: {
        name: user.nickname,
        nameZh: user.nickname,
        email: "",
        avatar: user.avatar,
        plan: user.plan,
        tokens: user.tokens,
        joined,
        stats: { posts: 0, bookmarks: 0, comments: 0, likes: 0 },
      },
      loginModalOpen: false,
    });
  },
  logout: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("bababang-user");
    }
    set({ isLoggedIn: false, currentUserId: null, user: null, loginModalOpen: false });
  },
  user: null,
  setUser: (user) => set({ user }),
  posts: mockPosts,
  setPosts: (posts) => set({ posts }),
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

  postsRefreshTrigger: 0,
  triggerPostsRefresh: () =>
    set((s) => ({ postsRefreshTrigger: s.postsRefreshTrigger + 1 })),

  promotionModalOpen: false,
  openPromotionModal: () => set({ promotionModalOpen: true }),
  closePromotionModal: () => set({ promotionModalOpen: false }),
  promotionsRefreshTrigger: 0,
  triggerPromotionsRefresh: () =>
    set((s) => ({ promotionsRefreshTrigger: s.promotionsRefreshTrigger + 1 })),

  recommendSubTab: "places",
  setRecommendSubTab: (t) => set({ recommendSubTab: t }),

  mapActionSheet: null,
  openMapActionSheet: (destLat, destLng, destName, destAddress, koreanName) =>
    set({
      mapActionSheet: {
        open: true,
        destLat,
        destLng,
        destName,
        destAddress,
        koreanName: koreanName ?? "",
      },
    }),
  closeMapActionSheet: () => set({ mapActionSheet: null }),

  userLocation: null,
  setUserLocation: (loc) => set({ userLocation: loc }),
}));
