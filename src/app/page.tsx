"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useStore } from "@/stores/useStore";
import { BottomNav } from "@/components/layout/BottomNav";
import { FloatingAIButton } from "@/components/layout/FloatingAIButton";
import { FloatingSecondaryFAB } from "@/components/layout/FloatingSecondaryFAB";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { HomePage } from "@/components/pages/HomePage";
import { CommunityPage } from "@/components/pages/CommunityPage";
import { RecommendPage } from "@/components/pages/RecommendPage";
import { BookmarkPage } from "@/components/pages/BookmarkPage";
import { MyPage } from "@/components/pages/MyPage";
import { AdminPage } from "@/components/pages/AdminPage";
import { PostDetail } from "@/components/modals/PostDetail";
import { PlaceDetail } from "@/components/modals/PlaceDetail";
import { MembershipModal } from "@/components/modals/MembershipModal";
import { WritePostModal } from "@/components/modals/WritePostModal";
import { WritePromotionModal } from "@/components/modals/WritePromotionModal";
import { MapActionSheet } from "@/components/modals/MapActionSheet";
import { LoginModal } from "@/components/modals/LoginModal";
import { getUserLocation } from "@/lib/geolocation";
import type { TabKey } from "@/types";

const pages: Record<TabKey, React.ReactNode> = {
  home: <HomePage />,
  community: <CommunityPage />,
  recommend: <RecommendPage />,
  bookmark: <BookmarkPage />,
  my: <MyPage />,
  admin: <AdminPage />,
};

export default function MainPage() {
  const activeTab = useStore((s) => s.activeTab);
  const setRecommendSubTab = useStore((s) => s.setRecommendSubTab);
  const detailView = useStore((s) => s.detailView);
  const membershipOpen = useStore((s) => s.membershipOpen);
  const login = useStore((s) => s.login);
  const loginModalOpen = useStore((s) => s.loginModalOpen);
  const chatOpen = useStore((s) => s.chatOpen);
  const writePostOpen = useStore((s) => s.writePostOpen);
  const promotionModalOpen = useStore((s) => s.promotionModalOpen);
  const setLang = useStore((s) => s.setLang);
  const setUserLocation = useStore((s) => s.setUserLocation);
  const [locationToast, setLocationToast] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("bababang-user");
    if (!saved) return;
    try {
      const userData = JSON.parse(saved) as { id?: number };
      if (userData.id == null || !Number.isFinite(Number(userData.id))) return;
      void fetch("/api/auth/me?userId=" + String(userData.id))
        .then((r) => r.json())
        .then(
          (data: {
            user?: {
              id: number;
              nickname: string;
              avatar: string;
              plan: "free" | "premium";
              tokens: number;
              language: string;
            };
          }) => {
            if (data.user) {
              login({
                id: data.user.id,
                nickname: data.user.nickname,
                avatar: data.user.avatar,
                plan: data.user.plan,
                tokens: data.user.tokens,
                language: data.user.language === "zh" ? "zh" : "ko",
              });
            }
          }
        )
        .catch(() => {});
    } catch {
      /* ignore */
    }
  }, [login]);

  useEffect(() => {
    const saved = window.localStorage.getItem("bababang-lang");
    if (saved === "ko" || saved === "zh") {
      setLang(saved);
      return;
    }
    setLang(window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "ko");
  }, [setLang]);

  useEffect(() => {
    const scrollEl = document.querySelector(".page-scroll");
    if (scrollEl) scrollEl.scrollTop = 0;
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "recommend") {
      setRecommendSubTab("places");
    }
  }, [activeTab, setRecommendSubTab]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loc = await getUserLocation();
      if (cancelled) return;
      if (loc) {
        setUserLocation(loc);
        return;
      }
      if (typeof navigator === "undefined" || !navigator.geolocation) return;
      try {
        const perm = await navigator.permissions.query({ name: "geolocation" as PermissionName });
        if (
          perm.state === "denied" &&
          !sessionStorage.getItem("bababang-loc-denied-toast")
        ) {
          setLocationToast("위치 권한이 필요해요. 설정에서 허용해주세요");
          sessionStorage.setItem("bababang-loc-denied-toast", "1");
        }
      } catch {
        /* Permissions API 미지원 시 토스트 생략 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUserLocation]);

  useEffect(() => {
    if (!locationToast) return;
    const t = window.setTimeout(() => setLocationToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [locationToast]);

  const isLightTab = ["bookmark", "community", "recommend"].includes(activeTab);

  const pageScrollLocked =
    chatOpen || loginModalOpen || writePostOpen || promotionModalOpen;

  return (
    <div
      className="app-shell max-w-[430px] mx-auto overflow-hidden bg-[#0a0a0f] relative flex flex-col"
      style={{ maxWidth: 430 }}
    >
      <div
        className={`page-scroll flex-1 min-h-0 ${pageScrollLocked ? "page-scroll--locked" : "overflow-auto"}`}
        style={
          isLightTab ? { background: "#f5f6fa", minHeight: "100%" } : undefined
        }
      >
        <div
          key={activeTab}
          className="min-h-full animate-[fadeIn_0.15s_ease]"
        >
          {pages[activeTab]}
        </div>
      </div>

      <BottomNav />
      <FloatingAIButton />
      <FloatingSecondaryFAB />

      <ChatPanel />

      <AnimatePresence>
        {detailView && !detailView.startsWith("pl") && (
          <PostDetail key="post-detail" />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {detailView?.startsWith("pl") && <PlaceDetail key="place-detail" />}
      </AnimatePresence>
      <AnimatePresence>
        {membershipOpen && <MembershipModal key="membership" />}
      </AnimatePresence>
      <WritePostModal />
      <WritePromotionModal />
      <MapActionSheet />
      {locationToast && (
        <div className="fixed bottom-28 left-1/2 z-[100] -translate-x-1/2 max-w-[90%] rounded-full bg-black/85 px-4 py-2 text-center text-xs text-white">
          {locationToast}
        </div>
      )}
      {loginModalOpen && <LoginModal />}
    </div>
  );
}
