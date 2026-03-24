"use client";

import { motion } from "framer-motion";
import {
  Home,
  Users,
  Star,
  Bookmark,
  User,
} from "lucide-react";
import { useStore } from "@/stores/useStore";
import { i18n } from "@/lib/i18n";
import type { TabKey } from "@/types";

const tabs: { key: TabKey; icon: typeof Home }[] = [
  { key: "home", icon: Home },
  { key: "community", icon: Users },
  { key: "recommend", icon: Star },
  { key: "bookmark", icon: Bookmark },
  { key: "my", icon: User },
];

const inactiveColor = "#8888a8";
const activeColor = "#6c5ce7";

export function BottomNav() {
  const { activeTab, setActiveTab, lang } = useStore();
  const hideBottomNav = useStore(
    (s) =>
      s.chatOpen ||
      s.writePostOpen ||
      s.promotionModalOpen ||
      s.loginModalOpen ||
      s.isKeyboardOpen ||
      Boolean(s.detailView) ||
      s.profileEditOpen
  );
  const t = i18n[lang].tab;

  if (hideBottomNav) return null;

  return (
    <nav className="bottom-nav-fixed">
      <div className="flex h-[60px] w-full items-stretch">
        {tabs.map(({ key, icon: Icon }) => {
          const active = activeTab === key;
          const label =
            key === "home"
              ? t.home
              : key === "community"
                ? t.community
                : key === "recommend"
                  ? t.recommend
                  : key === "bookmark"
                    ? t.bookmark
                    : t.my;
          return (
            <motion.button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 active:scale-[0.98]"
              style={{ color: active ? activeColor : inactiveColor }}
              whileTap={{ scale: 0.92 }}
            >
              {active && (
                <span
                  className="absolute top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                  style={{ background: activeColor }}
                />
              )}
              <Icon
                className="h-[22px] w-[22px] flex-shrink-0"
                strokeWidth={active ? 2.5 : 2}
              />
              <span className="text-[11px] font-medium leading-tight">{label}</span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
