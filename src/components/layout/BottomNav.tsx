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
  const { activeTab, setActiveTab, lang } = useStore();
  const t = i18n[lang].tab;
  const dark = isDark(activeTab);

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 max-w-[430px] mx-auto border-t backdrop-blur-xl ${
        dark
          ? "bg-[#0a0a0f]/95 border-white/10"
          : "bg-white/95 border-black/5"
      }`}
      style={{ marginLeft: "auto", marginRight: "auto" }}
    >
      <div className="flex justify-around items-center h-16 px-2">
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
              className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-2 rounded-xl active:scale-[0.98] ${
                active
                  ? "text-[var(--accent-light)]"
                  : "text-[var(--text-muted)]"
              }`}
              whileTap={{ scale: 0.92 }}
            >
              {active && (
                <span
                  className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--accent-light)" }}
                />
              )}
              <Icon
                className="w-[22px] h-[22px] flex-shrink-0"
                strokeWidth={active ? 2.5 : 2}
              />
              <span className="text-[10px] font-medium">{label}</span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
