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

type ApiReportRow = {
  id?: number;
  shop_name: string;
  report_type: string;
  detail?: string | null;
  created_at?: string;
};

type AdRow = {
  id: number;
  business_name: string;
  business_name_zh?: string | null;
  category: string;
  start_date?: string | null;
  end_date?: string | null;
  is_active: number | boolean;
  created_at?: string;
};

function reportTypeLabel(t: string): string {
  if (t === "closed") return "폐업/없어짐";
  if (t === "wrong_info") return "정보 오류";
  if (t === "other") return "기타";
  return t;
}

export function AdminPage() {
  const { chatFeedback, questionStats, chatMessages } = useStore();
  const [tab, setTab] = useState<"shops" | "reports" | "feedback" | "stats" | "ads">("shops");
  const [apiReports, setApiReports] = useState<ApiReportRow[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
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

  const [adsList, setAdsList] = useState<AdRow[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adForm, setAdForm] = useState({
    businessName: "",
    businessNameZh: "",
    category: "맛집",
    description: "",
    address: "",
    phone: "",
    wechat: "",
    startDate: "",
    endDate: "",
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

  useEffect(() => {
    if (tab !== "reports") return;
    let cancelled = false;
    (async () => {
      setReportsLoading(true);
      try {
        const res = await fetch("/api/reports");
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && Array.isArray(data.reports)) {
          setApiReports(data.reports as ApiReportRow[]);
        } else {
          setApiReports([]);
        }
      } catch {
        if (!cancelled) setApiReports([]);
      }
      if (!cancelled) setReportsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== "ads") return;
    let cancelled = false;
    (async () => {
      setAdsLoading(true);
      try {
        const res = await fetch("/api/ads?list=1");
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && Array.isArray(data.ads)) {
          setAdsList(data.ads as AdRow[]);
        } else {
          setAdsList([]);
        }
      } catch {
        if (!cancelled) setAdsList([]);
      }
      if (!cancelled) setAdsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

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
            ["ads", "광고 관리"],
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
            {reportsLoading ? (
              <p className="text-sm text-white/50 py-4 text-center">불러오는 중...</p>
            ) : apiReports.length === 0 ? (
              <p className="text-sm text-white/50 py-4 text-center">신고 내역이 없습니다.</p>
            ) : (
              apiReports.map((r, idx) => {
                const rid = r.id ?? idx;
                return (
                  <div key={rid} className="glass-dark rounded-2xl p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{r.shop_name}</p>
                      <p className="text-xs text-white/60 mt-1">
                        {reportTypeLabel(r.report_type)}
                        {r.detail ? ` · ${r.detail}` : ""}
                      </p>
                      {r.created_at && (
                        <p className="text-[10px] text-white/40 mt-1">
                          {new Date(r.created_at).toLocaleString("ko-KR")}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDoneReportIds((s) => [...s, rid as number])}
                      className="text-xs px-2 py-1 rounded bg-accent/30 text-accent flex-shrink-0"
                    >
                      {doneReportIds.includes(rid as number) ? "완료됨" : "처리완료"}
                    </button>
                  </div>
                );
              })
            )}
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

        {tab === "ads" && (
          <div className="space-y-3 mt-3">
            <div className="glass-dark p-3 rounded-2xl space-y-2">
              <p className="text-sm text-white/80">광고 추가</p>
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="업체명 (한글)"
                value={adForm.businessName}
                onChange={(e) => setAdForm((s) => ({ ...s, businessName: e.target.value }))}
              />
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="업체명 (중문)"
                value={adForm.businessNameZh}
                onChange={(e) => setAdForm((s) => ({ ...s, businessNameZh: e.target.value }))}
              />
              <select
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={adForm.category}
                onChange={(e) => setAdForm((s) => ({ ...s, category: e.target.value }))}
              >
                {["맛집", "병원", "부동산", "교육", "미용"].map((c) => (
                  <option key={c} value={c} className="bg-[#1a1a24]">
                    {c}
                  </option>
                ))}
              </select>
              <textarea
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm min-h-[72px]"
                placeholder="설명"
                value={adForm.description}
                onChange={(e) => setAdForm((s) => ({ ...s, description: e.target.value }))}
              />
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="주소"
                value={adForm.address}
                onChange={(e) => setAdForm((s) => ({ ...s, address: e.target.value }))}
              />
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="전화"
                value={adForm.phone}
                onChange={(e) => setAdForm((s) => ({ ...s, phone: e.target.value }))}
              />
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="위챗"
                value={adForm.wechat}
                onChange={(e) => setAdForm((s) => ({ ...s, wechat: e.target.value }))}
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 bg-white/10 rounded-lg px-2 py-2 text-sm text-white"
                  value={adForm.startDate}
                  onChange={(e) => setAdForm((s) => ({ ...s, startDate: e.target.value }))}
                />
                <input
                  type="date"
                  className="flex-1 bg-white/10 rounded-lg px-2 py-2 text-sm text-white"
                  value={adForm.endDate}
                  onChange={(e) => setAdForm((s) => ({ ...s, endDate: e.target.value }))}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!adForm.businessName.trim()) return;
                  void fetch("/api/ads", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      businessName: adForm.businessName.trim(),
                      businessNameZh: adForm.businessNameZh.trim() || null,
                      category: adForm.category,
                      description: adForm.description.trim() || null,
                      address: adForm.address.trim() || null,
                      phone: adForm.phone.trim() || null,
                      wechat: adForm.wechat.trim() || null,
                      adType: "card",
                      startDate: adForm.startDate || null,
                      endDate: adForm.endDate || null,
                    }),
                  })
                    .then((r) => r.json())
                    .then(() => {
                      setAdForm({
                        businessName: "",
                        businessNameZh: "",
                        category: "맛집",
                        description: "",
                        address: "",
                        phone: "",
                        wechat: "",
                        startDate: "",
                        endDate: "",
                      });
                      void fetch("/api/ads?list=1")
                        .then((r) => r.json())
                        .then((d: { ads?: AdRow[] }) => {
                          if (Array.isArray(d.ads)) setAdsList(d.ads);
                        });
                    });
                }}
                className="w-full rounded-lg bg-accent py-2 text-sm"
              >
                광고 등록
              </button>
            </div>

            {adsLoading ? (
              <p className="text-sm text-white/50 py-4 text-center">불러오는 중...</p>
            ) : adsList.length === 0 ? (
              <p className="text-sm text-white/50 py-4 text-center">등록된 광고가 없습니다.</p>
            ) : (
              adsList.map((ad) => {
                const active = Boolean(ad.is_active);
                return (
                  <div
                    key={ad.id}
                    className="glass-dark rounded-2xl p-3 flex flex-col gap-2"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {ad.business_name}
                          {ad.business_name_zh ? ` (${ad.business_name_zh})` : ""}
                        </p>
                        <p className="text-xs text-white/60 mt-1">카테고리: {ad.category}</p>
                        <p className="text-[10px] text-white/40 mt-1">
                          {(ad.start_date ?? "—") + " ~ " + (ad.end_date ?? "—")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void fetch("/api/ads", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: ad.id, is_active: !active }),
                          })
                            .then((r) => r.json())
                            .then(() => {
                              setAdsList((prev) =>
                                prev.map((a) =>
                                  a.id === ad.id ? { ...a, is_active: !active ? 1 : 0 } : a
                                )
                              );
                            });
                        }}
                        className={`text-xs px-2 py-1 rounded flex-shrink-0 ${
                          active ? "bg-green-500/30 text-green-200" : "bg-white/10 text-white/60"
                        }`}
                      >
                        {active ? "활성" : "비활성"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
