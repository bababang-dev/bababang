"use client";

import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useStore } from "@/stores/useStore";
import { mockUser } from "@/lib/mockData";
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
  const setUser = useStore((s) => s.setUser);
  const user = useStore((s) => s.user);
  const setLang = useStore((s) => s.setLang);

  useEffect(() => {
    if (!user) setUser(mockUser);
  }, [user, setUser]);

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

  const isLightTab = ["bookmark", "community", "recommend"].includes(activeTab);

  return (
    <div
      className="max-w-[430px] mx-auto h-[100vh] overflow-hidden bg-[#0a0a0f] relative flex flex-col"
      style={{ maxWidth: 430 }}
    >
      <div
        className="page-scroll flex-1 min-h-0 overflow-auto"
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
    </div>
  );
}
