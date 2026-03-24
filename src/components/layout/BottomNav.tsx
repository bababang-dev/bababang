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

const darkTabs: TabKey[] = ["home", "my"];
const isDark = (tab: TabKey) => darkTabs.includes(tab);

export function BottomNav() {
  const { activeTab, setActiveTab, lang, chatOpen } = useStore();
  const t = i18n[lang].tab;
  const dark = isDark(activeTab);

  if (chatOpen) return null;

  return (
    <nav
      className={`bottom-nav fixed bottom-0 left-0 right-0 z-40 max-w-[430px] mx-auto border-t backdrop-blur-xl ${
        dark
          ? "bg-[#0a0a0f]/95 border-white/10"
          : "bg-white/95 border-black/5"
      }`}
      style={{ marginLeft: "auto", marginRight: "auto" }}
    >
      <div className="flex h-[60px] justify-around items-center px-2">
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
              className={`relative flex h-full min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-xl active:scale-[0.98] ${
                active
                  ? "text-[var(--accent-light)]"
                  : "text-[var(--text-muted)]"
              }`}
              whileTap={{ scale: 0.92 }}
            >
              {active && (
                <span
                  className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--accent-light)" }}
                />
              )}
              <Icon
                className="h-6 w-6 flex-shrink-0"
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
