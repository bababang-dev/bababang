"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { useStore } from "@/stores/useStore";
import { shopDict, type ShopEntry } from "@/lib/shopDict";

const localShopsKey = "bababang-admin-shops";
const deletedShopsKey = "bababang-admin-shop-deleted";

function shopKey(shop: ShopEntry): string {
  return `${shop.zh}::${shop.koreanNames[0] ?? ""}`;
}

export function AdminPage() {
  const { chatFeedback, reports, questionStats, chatMessages } = useStore();
  const [tab, setTab] = useState<"shops" | "reports" | "feedback" | "stats">("shops");
  const [localShops, setLocalShops] = useState<ShopEntry[]>([]);
  const [deletedKeys, setDeletedKeys] = useState<string[]>([]);
  const [doneReportIds, setDoneReportIds] = useState<number[]>([]);
  const [form, setForm] = useState({
    zh: "",
    aliases: "",
    category: "",
    district: "",
    description: "",
    recommendMenu: "",
    priceRange: "",
    tip: "",
  });

  useEffect(() => {
    try {
      const shopsRaw = window.localStorage.getItem(localShopsKey);
      const deletedRaw = window.localStorage.getItem(deletedShopsKey);
      setLocalShops(shopsRaw ? (JSON.parse(shopsRaw) as ShopEntry[]) : []);
      setDeletedKeys(deletedRaw ? (JSON.parse(deletedRaw) as string[]) : []);
    } catch {
      setLocalShops([]);
      setDeletedKeys([]);
    }
  }, []);

  const mergedShops = useMemo(() => {
    return [...shopDict, ...localShops].filter((shop) => !deletedKeys.includes(shopKey(shop)));
  }, [localShops, deletedKeys]);

  const feedbackStats = useMemo(() => {
    const good = chatFeedback.filter((f) => f.feedback === "good").length;
    const bad = chatFeedback.filter((f) => f.feedback === "bad").length;
    const total = good + bad;
    return {
      good,
      bad,
      ratio: total > 0 ? `${Math.round((good / total) * 100)}% / ${Math.round((bad / total) * 100)}%` : "0% / 0%",
    };
  }, [chatFeedback]);

  const topQuestions = useMemo(() => {
    const counter = new Map<string, number>();
    chatMessages
      .filter((m) => m.role === "user")
      .forEach((m) => counter.set(m.text, (counter.get(m.text) ?? 0) + 1));
    return Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [chatMessages]);

  const saveLocalShops = (shops: ShopEntry[]) => {
    setLocalShops(shops);
    window.localStorage.setItem(localShopsKey, JSON.stringify(shops));
  };

  const saveDeleted = (keys: string[]) => {
    setDeletedKeys(keys);
    window.localStorage.setItem(deletedShopsKey, JSON.stringify(keys));
  };

  const addShop = () => {
    if (!form.zh.trim() || !form.aliases.trim()) return;
    const entry: ShopEntry = {
      zh: form.zh.trim(),
      koreanNames: form.aliases
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean),
      category: form.category.trim() || "기타",
      district: form.district.trim() || "미상",
      description: form.description.trim(),
      recommendMenu: form.recommendMenu.trim(),
      priceRange: form.priceRange.trim(),
      tip: form.tip.trim(),
    };
    saveLocalShops([entry, ...localShops]);
    setForm({
      zh: "",
      aliases: "",
      category: "",
      district: "",
      description: "",
      recommendMenu: "",
      priceRange: "",
      tip: "",
    });
  };

  return (
    <div className="min-h-full bg-[#0a0a0f] text-white pb-24">
      <Header titleKey="admin" showSearch={false} dark />
      <div className="max-w-[430px] mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            ["shops", "가게 관리"],
            ["reports", "신고 관리"],
            ["feedback", "AI 피드백"],
            ["stats", "통계"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as typeof tab)}
              className={`px-3 py-1.5 rounded-full text-sm ${
                tab === key ? "bg-accent text-white" : "bg-white/10 text-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "shops" && (
          <div className="space-y-3 mt-3">
            <div className="glass-dark p-3 rounded-2xl space-y-2">
              <p className="text-sm text-white/80">가게 추가</p>
              <input className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm" placeholder="중국어이름" value={form.zh} onChange={(e) => setForm((s) => ({ ...s, zh: e.target.value }))} />
              <input className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm" placeholder="별명들 (쉼표 구분)" value={form.aliases} onChange={(e) => setForm((s) => ({ ...s, aliases: e.target.value }))} />
              <input className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm" placeholder="카테고리" value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} />
              <input className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm" placeholder="지역" value={form.district} onChange={(e) => setForm((s) => ({ ...s, district: e.target.value }))} />
              <input className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm" placeholder="한줄설명" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
              <input className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm" placeholder="추천메뉴" value={form.recommendMenu} onChange={(e) => setForm((s) => ({ ...s, recommendMenu: e.target.value }))} />
              <input className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm" placeholder="가격대" value={form.priceRange} onChange={(e) => setForm((s) => ({ ...s, priceRange: e.target.value }))} />
              <input className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm" placeholder="꿀팁" value={form.tip} onChange={(e) => setForm((s) => ({ ...s, tip: e.target.value }))} />
              <button type="button" onClick={addShop} className="w-full rounded-lg bg-accent py-2 text-sm">
                가게 추가
              </button>
            </div>

            {mergedShops.map((shop) => (
              <div key={shopKey(shop)} className="glass-dark rounded-2xl p-3 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{shop.koreanNames[0]} ({shop.zh})</p>
                  <p className="text-xs text-white/60 mt-1">{shop.category} · {shop.district}</p>
                </div>
                <button
                  type="button"
                  onClick={() => saveDeleted([...deletedKeys, shopKey(shop)])}
                  className="text-xs px-2 py-1 rounded bg-white/10"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "reports" && (
          <div className="space-y-2 mt-3">
            {reports.map((r, idx) => (
              <div key={`${r.shopName}-${idx}`} className="glass-dark rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{r.shopName}</p>
                  <p className="text-xs text-white/60">{r.reason} · {r.date}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDoneReportIds((s) => [...s, idx])}
                  className="text-xs px-2 py-1 rounded bg-accent/30 text-accent"
                >
                  {doneReportIds.includes(idx) ? "완료됨" : "처리완료"}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "feedback" && (
          <div className="space-y-2 mt-3">
            {chatFeedback.map((f, idx) => (
              <div key={`${f.messageIndex}-${idx}`} className="glass-dark rounded-2xl p-3">
                <p className="font-medium">{f.feedback === "good" ? "👍 좋아요" : "👎 싫어요"}</p>
                {f.reason && <p className="text-xs text-white/60 mt-1">사유: {f.reason}</p>}
                <p className="text-xs text-white/50 mt-1">{new Date(f.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "stats" && (
          <div className="space-y-2 mt-3">
            <div className="glass-dark rounded-2xl p-3">오늘 질문 수: {questionStats.today}</div>
            <div className="glass-dark rounded-2xl p-3">총 질문 수: {questionStats.total}</div>
            <div className="glass-dark rounded-2xl p-3">좋아요/싫어요 비율: {feedbackStats.ratio}</div>
            <div className="glass-dark rounded-2xl p-3">
              <p className="mb-2">인기 질문 TOP 5</p>
              {topQuestions.map(([q, count]) => (
                <p key={q} className="text-sm text-white/80">{q} ({count})</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
