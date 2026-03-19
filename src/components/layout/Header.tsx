"use client";

import { motion } from "framer-motion";
import { Search, Languages } from "lucide-react";
import { useStore } from "@/stores/useStore";

const titles: Record<string, { ko: string; zh: string }> = {
  home: { ko: "아빠방", zh: "爸爸帮" },
  community: { ko: "커뮤니티", zh: "社区" },
  recommend: { ko: "추천", zh: "推荐" },
  bookmark: { ko: "북마크", zh: "收藏" },
  my: { ko: "마이", zh: "我的" },
  admin: { ko: "관리자", zh: "管理员" },
};

interface HeaderProps {
  titleKey: string;
  showSearch?: boolean;
  onSearchClick?: () => void;
  dark?: boolean;
}

export function Header({
  titleKey,
  showSearch = true,
  onSearchClick,
  dark = false,
}: HeaderProps) {
  const { lang, setLang } = useStore();
  const title = titles[titleKey]?.[lang] ?? titleKey;

  const toggleLang = () => setLang(lang === "ko" ? "zh" : "ko");

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`sticky top-0 z-30 max-w-[430px] mx-auto flex items-center justify-between h-14 px-4 ${
        dark ? "bg-[#0a0a0f] text-white" : "bg-[#f5f6fa] text-black"
      }`}
    >
      <h1 className="font-outfit text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-2">
        <motion.button
          type="button"
          onClick={toggleLang}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm ${
            dark ? "text-white/80 hover:bg-white/10" : "text-black/70 hover:bg-black/5"
          }`}
          whileTap={{ scale: 0.96 }}
        >
          <Languages className="w-4 h-4" />
          <span>{lang === "ko" ? "한" : "中"}</span>
        </motion.button>
        {showSearch && (
          <motion.button
            type="button"
            onClick={onSearchClick}
            className={`p-2 rounded-full ${
              dark ? "hover:bg-white/10" : "hover:bg-black/5"
            }`}
            whileTap={{ scale: 0.92 }}
          >
            <Search className="w-5 h-5" />
          </motion.button>
        )}
      </div>
    </motion.header>
  );
}
