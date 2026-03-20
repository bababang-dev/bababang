"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/stores/useStore";

const FILTER_CHIPS: { key: string | null; label: string }[] = [
  { key: null, label: "전체" },
  { key: "restaurant", label: "🍜 음식점" },
  { key: "wholesale", label: "🏭 도매/유통" },
  { key: "realestate", label: "🏠 부동산" },
  { key: "education", label: "📚 교육" },
  { key: "medical", label: "🏥 의료" },
  { key: "trade", label: "🚢 무역/물류" },
  { key: "beauty", label: "💇 미용" },
];

const CAT_LABEL: Record<string, string> = {
  restaurant: "음식점",
  wholesale: "도매/유통",
  realestate: "부동산",
  education: "교육",
  medical: "의료",
  trade: "무역/물류",
  beauty: "미용",
};

type PromoRow = {
  id: number;
  category: string;
  business_name: string;
  business_name_zh?: string | null;
  address?: string | null;
  phone?: string | null;
  description?: string | null;
  images?: string | null;
  template_data?: unknown;
  created_at?: string;
};

export function PromotionPage() {
  const [filter, setFilter] = useState<string | null>(null);
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { promotionsRefreshTrigger } = useStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const q = filter ? `?category=${encodeURIComponent(filter)}` : "";
        const res = await fetch("/api/promotions" + q);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && Array.isArray(data.promotions)) {
          setRows(data.promotions);
        } else setRows([]);
      } catch {
        if (!cancelled) setRows([]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, promotionsRefreshTrigger]);

  const imageList = (images: string | null | undefined) =>
    images ? images.split(",").map((s) => s.trim()).filter(Boolean) : [];

  return (
    <div className="pb-28">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {FILTER_CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setFilter(c.key)}
            className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium ${
              filter === c.key ? "bg-accent text-white" : "bg-white/80 text-black/70"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-center text-sm text-black/50 py-8">불러오는 중...</p>
        ) : (
          <AnimatePresence mode="popLayout">
            {rows.map((r, i) => {
              const imgs = imageList(r.images);
              return (
                <motion.article
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-light rounded-2xl overflow-hidden border border-black/5"
                >
                  {imgs[0] && (
                    <div className="w-full h-40 bg-black/5 relative">
                      <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent">
                      {CAT_LABEL[r.category] ?? r.category}
                    </span>
                    <h3 className="font-outfit font-bold text-base mt-2 text-black">
                      {r.business_name}
                      {r.business_name_zh ? (
                        <span className="text-black/50 font-normal text-sm ml-1">
                          ({r.business_name_zh})
                        </span>
                      ) : null}
                    </h3>
                    {r.address && (
                      <p className="text-xs text-black/60 mt-1">📍 {r.address}</p>
                    )}
                    {r.phone && (
                      <p className="text-xs text-black/60 mt-0.5">📞 {r.phone}</p>
                    )}
                    {r.description && (
                      <p className="text-sm text-black/75 mt-2 line-clamp-3">{r.description}</p>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        )}
        {!loading && rows.length === 0 && (
          <p className="text-center text-sm text-black/50 py-8">등록된 홍보가 없어요.</p>
        )}
      </div>
    </div>
  );
}
