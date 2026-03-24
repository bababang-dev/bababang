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

type AdminTab =
  | "dashboard"
  | "users"
  | "posts"
  | "ads"
  | "cache"
  | "knowledge"
  | "ai"
  | "shopDictionary";

const DICT_CATEGORY_OPTIONS = ["맛집", "병원", "마트", "교육", "미용", "부동산", "기타"] as const;
const DICT_DISTRICT_OPTIONS = [
  "시남구/시북구",
  "청양구,성양구",
  "황다오구,황도구",
  "라오산구,노산구",
  "리창구,이창구",
  "즉묵,지묵",
  "자오저우,교주",
] as const;
const REVIEW_SOURCE_OPTIONS = [
  "dianping",
  "xiaohongshu",
  "naver_blog",
  "naver_cafe",
  "zhihu",
  "weibo",
  "meituan",
  "user",
] as const;

function formatShopDictKoJson(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw !== "string") return String(raw);
  try {
    const p = JSON.parse(raw) as unknown;
    if (Array.isArray(p)) return p.map(String).join(",");
  } catch {
    return raw;
  }
  return raw;
}

function reportTypeLabel(t: string): string {
  if (t === "closed") return "폐업/없어짐";
  if (t === "wrong_info") return "정보 오류";
  if (t === "other") return "기타";
  return t;
}

const SYSTEM_PROMPT_NOTE =
  "시스템 프롬프트 전문은 서버 `src/app/api/chat/route.ts`의 `systemPrompt` 문자열에 정의되어 있습니다. (읽기 전용)";

export function AdminPage() {
  const { chatFeedback, questionStats, chatMessages } = useStore();
  const [tab, setTab] = useState<AdminTab>("dashboard");

  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [adminUsers, setAdminUsers] = useState<
    Array<{
      id: number;
      nickname: string;
      phone: string;
      tokens: number;
      role: string;
      created_at: string;
      post_count: number;
    }>
  >([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [adminPosts, setAdminPosts] = useState<
    Array<{
      id: number;
      title: string;
      category: string;
      created_at: string;
      report_count: number;
      author_nickname: string | null;
    }>
  >([]);
  const [postsLoading, setPostsLoading] = useState(false);

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

  const [cacheSub, setCacheSub] = useState<"shops" | "reviews" | "searches">("shops");
  const [cacheItems, setCacheItems] = useState<Array<Record<string, unknown>>>([]);
  const [cacheLoading, setCacheLoading] = useState(false);

  const [shopEdit, setShopEdit] = useState<{
    id: number;
    name_zh: string;
    name_ko: string;
    address: string;
    phone: string;
    rating: string;
    cost: string;
    open_time: string;
  } | null>(null);

  const [reviewEdit, setReviewEdit] = useState<{
    id: number;
    review_text: string;
    source: string;
  } | null>(null);

  const [dictItems, setDictItems] = useState<Array<Record<string, unknown>>>([]);
  const [dictLoading, setDictLoading] = useState(false);
  const [dictSearch, setDictSearch] = useState("");
  const [dictEditingId, setDictEditingId] = useState<number | null>(null);
  const [dictForm, setDictForm] = useState({
    nameZh: "",
    nameKo: "",
    category: "기타",
    district: "",
    address: "",
    phone: "",
    notes: "",
  });

  const [kbItems, setKbItems] = useState<
    Array<{
      id: number;
      title: string;
      file_type: string;
      category: string | null;
      is_active: number | boolean;
      created_at: string;
      content_length: number;
    }>
  >([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbTitle, setKbTitle] = useState("");
  const [kbContent, setKbContent] = useState("");
  const [kbCategory, setKbCategory] = useState("일반");

  const [freeAiLimit, setFreeAiLimit] = useState("5");
  const [cacheExpireDays, setCacheExpireDays] = useState("7");
  const [showShopReports, setShowShopReports] = useState(false);

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
    setFreeAiLimit(window.localStorage.getItem("bababang-free-ai-limit") || "5");
    setCacheExpireDays(window.localStorage.getItem("bababang-cache-expire-days") || "7");
  }, []);

  useEffect(() => {
    if (tab !== "dashboard") return;
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const res = await fetch("/api/admin/stats");
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data && typeof data === "object") setStats(data as Record<string, number>);
        else setStats(null);
      } catch {
        if (!cancelled) setStats(null);
      }
      if (!cancelled) setStatsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== "users") return;
    let cancelled = false;
    (async () => {
      setUsersLoading(true);
      try {
        const res = await fetch("/api/admin/users");
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && Array.isArray(data.users)) setAdminUsers(data.users);
        else setAdminUsers([]);
      } catch {
        if (!cancelled) setAdminUsers([]);
      }
      if (!cancelled) setUsersLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== "posts") return;
    let cancelled = false;
    (async () => {
      setPostsLoading(true);
      try {
        const res = await fetch("/api/admin/posts");
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && Array.isArray(data.posts)) setAdminPosts(data.posts);
        else setAdminPosts([]);
      } catch {
        if (!cancelled) setAdminPosts([]);
      }
      if (!cancelled) setPostsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== "ai" || !showShopReports) return;
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
  }, [tab, showShopReports]);

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

  useEffect(() => {
    if (tab !== "cache") return;
    let cancelled = false;
    (async () => {
      setCacheLoading(true);
      try {
        const res = await fetch("/api/admin/cache?type=" + encodeURIComponent(cacheSub));
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && Array.isArray(data.items)) setCacheItems(data.items as Array<Record<string, unknown>>);
        else setCacheItems([]);
      } catch {
        if (!cancelled) setCacheItems([]);
      }
      if (!cancelled) setCacheLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, cacheSub]);

  useEffect(() => {
    if (tab !== "shopDictionary") return;
    let cancelled = false;
    (async () => {
      setDictLoading(true);
      try {
        const res = await fetch("/api/admin/shop-dictionary");
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && Array.isArray(data.items)) {
          setDictItems(data.items as Array<Record<string, unknown>>);
        } else {
          setDictItems([]);
        }
      } catch {
        if (!cancelled) setDictItems([]);
      }
      if (!cancelled) setDictLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== "knowledge") return;
    let cancelled = false;
    (async () => {
      setKbLoading(true);
      try {
        const res = await fetch("/api/admin/knowledge");
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && Array.isArray(data.items)) setKbItems(data.items);
        else setKbItems([]);
      } catch {
        if (!cancelled) setKbItems([]);
      }
      if (!cancelled) setKbLoading(false);
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
      ratio:
        total > 0
          ? `${Math.round((good / total) * 100)}% / ${Math.round((bad / total) * 100)}%`
          : "0% / 0%",
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

  const filteredDictItems = useMemo(() => {
    const q = dictSearch.trim().toLowerCase();
    if (!q) return dictItems;
    return dictItems.filter((row) => {
      const zh = String(row.name_zh ?? "").toLowerCase();
      const ko = formatShopDictKoJson(row.name_ko).toLowerCase();
      return zh.includes(q) || ko.includes(q);
    });
  }, [dictItems, dictSearch]);

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

  const saveAiSettings = () => {
    window.localStorage.setItem("bababang-free-ai-limit", freeAiLimit.trim() || "5");
    window.localStorage.setItem("bababang-cache-expire-days", cacheExpireDays.trim() || "7");
    alert("저장했습니다. (이 기기·브라우저에만 적용)");
  };

  const setUserRole = async (userId: number, role: string) => {
    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    if (res.ok) {
      setAdminUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    }
  };

  const deletePost = async (id: number) => {
    if (!confirm("이 게시글을 삭제할까요?")) return;
    const res = await fetch("/api/admin/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setAdminPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const refreshCache = () => {
    void fetch("/api/admin/cache?type=" + encodeURIComponent(cacheSub))
      .then((r) => r.json())
      .then((d: { items?: unknown[] }) => {
        if (Array.isArray(d.items)) setCacheItems(d.items as Array<Record<string, unknown>>);
      });
  };

  const deleteCacheRow = async (type: string, id: number) => {
    const res = await fetch("/api/admin/cache", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
    });
    if (res.ok) refreshCache();
  };

  const verifyReview = async (id: number, action: "verify" | "reject") => {
    const res = await fetch("/api/admin/cache", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "reviews", id, action }),
    });
    if (res.ok) refreshCache();
  };

  const saveShopCacheEdit = async () => {
    if (!shopEdit) return;
    const res = await fetch("/api/admin/cache", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "shops",
        id: shopEdit.id,
        updates: {
          nameZh: shopEdit.name_zh,
          nameKo: shopEdit.name_ko,
          address: shopEdit.address,
          phone: shopEdit.phone,
          rating: shopEdit.rating,
          cost: shopEdit.cost,
          openTime: shopEdit.open_time,
        },
      }),
    });
    if (res.ok) {
      setShopEdit(null);
      refreshCache();
    }
  };

  const saveReviewEdit = async () => {
    if (!reviewEdit) return;
    const res = await fetch("/api/admin/cache", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "reviews",
        id: reviewEdit.id,
        action: "edit",
        reviewText: reviewEdit.review_text,
        source: reviewEdit.source,
      }),
    });
    if (res.ok) {
      setReviewEdit(null);
      refreshCache();
    }
  };

  const deleteReviewRow = async (id: number) => {
    if (!confirm("이 리뷰 캐시를 삭제할까요?")) return;
    await deleteCacheRow("reviews", id);
  };

  const refreshDictList = () => {
    void fetch("/api/admin/shop-dictionary")
      .then((r) => r.json())
      .then((d: { items?: unknown[] }) => {
        if (Array.isArray(d.items)) setDictItems(d.items as Array<Record<string, unknown>>);
      });
  };

  const saveDictionary = async () => {
    if (!dictForm.nameZh.trim() || !dictForm.nameKo.trim()) {
      alert("중국어·한국어 이름을 입력해주세요.");
      return;
    }
    const payload = {
      nameZh: dictForm.nameZh.trim(),
      nameKo: dictForm.nameKo.trim(),
      category: dictForm.category,
      district: dictForm.district,
      address: dictForm.address,
      phone: dictForm.phone,
      notes: dictForm.notes,
    };
    const res = dictEditingId
      ? await fetch("/api/admin/shop-dictionary", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: dictEditingId, ...payload }),
        })
      : await fetch("/api/admin/shop-dictionary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    if (res.ok) {
      setDictEditingId(null);
      setDictForm({
        nameZh: "",
        nameKo: "",
        category: "기타",
        district: "",
        address: "",
        phone: "",
        notes: "",
      });
      refreshDictList();
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      alert(j.error ?? "저장 실패");
    }
  };

  const deleteDictionaryRow = async (id: number) => {
    if (!confirm("삭제할까요?")) return;
    const res = await fetch("/api/admin/shop-dictionary", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) refreshDictList();
  };

  const startEditDictionary = (row: Record<string, unknown>) => {
    setDictEditingId(Number(row.id));
    setDictForm({
      nameZh: String(row.name_zh ?? ""),
      nameKo: formatShopDictKoJson(row.name_ko),
      category: String(row.category ?? "기타"),
      district: String(row.district ?? ""),
      address: String(row.address ?? ""),
      phone: String(row.phone ?? ""),
      notes: String(row.notes ?? ""),
    });
  };

  const cancelDictionaryForm = () => {
    setDictEditingId(null);
    setDictForm({
      nameZh: "",
      nameKo: "",
      category: "기타",
      district: "",
      address: "",
      phone: "",
      notes: "",
    });
  };

  const statCards = [
    { key: "totalUsers", label: "유저", icon: "👥", suffix: "명" },
    { key: "totalPosts", label: "게시글", icon: "📝", suffix: "개" },
    { key: "todayPosts", label: "오늘 게시글", icon: "📅", suffix: "개" },
    { key: "cachedShops", label: "캐시 가게", icon: "🗄️", suffix: "개" },
    { key: "cachedReviews", label: "캐시 리뷰", icon: "💬", suffix: "개" },
    { key: "cachedSearches", label: "캐시 검색", icon: "🔎", suffix: "개" },
    { key: "activeAds", label: "활성 광고", icon: "📣", suffix: "개" },
    { key: "todayTokens", label: "오늘 적립 토큰", icon: "🪙", suffix: "" },
  ];

  return (
    <div className="min-h-full bg-[#0a0a0f] text-white pb-24">
      <Header titleKey="admin" showSearch={false} dark />
      <div className="max-w-[430px] mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {(
            [
              ["dashboard", "대시보드"],
              ["users", "유저"],
              ["posts", "게시글"],
              ["ads", "광고"],
              ["cache", "캐시"],
              ["knowledge", "지식"],
              ["ai", "AI설정"],
              ["shopDictionary", "가게사전"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${
                tab === key ? "bg-accent text-white" : "bg-white/10 text-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "dashboard" && (
          <div className="mt-3">
            {statsLoading ? (
              <p className="text-sm text-white/50 py-6 text-center">불러오는 중...</p>
            ) : !stats ? (
              <p className="text-sm text-white/50 py-6 text-center">통계를 불러오지 못했어요.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {statCards.map(({ key, label, icon, suffix }) => (
                  <div key={key} className="glass-dark rounded-2xl p-4">
                    <p className="text-2xl mb-1">
                      {icon}{" "}
                      <span className="font-outfit font-bold text-xl">
                        {Number(stats[key] ?? 0).toLocaleString()}
                      </span>
                      {suffix ? (
                        <span className="text-sm font-normal text-white/70">{suffix}</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-white/50">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "users" && (
          <div className="space-y-2 mt-3">
            {usersLoading ? (
              <p className="text-sm text-white/50 py-4 text-center">불러오는 중...</p>
            ) : adminUsers.length === 0 ? (
              <p className="text-sm text-white/50 py-4 text-center">유저가 없습니다.</p>
            ) : (
              adminUsers.map((u) => (
                <div key={u.id} className="glass-dark rounded-2xl p-3 text-sm space-y-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{u.nickname}</span>
                    <span className="text-white/50 text-xs">{u.role}</span>
                  </div>
                  <p className="text-xs text-white/50">
                    {u.phone} · 토큰 {u.tokens} · 글 {u.post_count} ·{" "}
                    {u.created_at ? new Date(u.created_at).toLocaleDateString("ko-KR") : ""}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="text-[10px] px-2 py-1 rounded bg-white/10"
                      onClick={() => void setUserRole(u.id, "banned")}
                    >
                      밴
                    </button>
                    <button
                      type="button"
                      className="text-[10px] px-2 py-1 rounded bg-white/10"
                      onClick={() => void setUserRole(u.id, "user")}
                    >
                      밴 해제
                    </button>
                    <button
                      type="button"
                      className="text-[10px] px-2 py-1 rounded bg-accent/30"
                      onClick={() => void setUserRole(u.id, "admin")}
                    >
                      관리자
                    </button>
                    <button
                      type="button"
                      className="text-[10px] px-2 py-1 rounded bg-white/10"
                      onClick={() => void setUserRole(u.id, "user")}
                    >
                      관리자 해제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "posts" && (
          <div className="space-y-2 mt-3">
            {postsLoading ? (
              <p className="text-sm text-white/50 py-4 text-center">불러오는 중...</p>
            ) : adminPosts.length === 0 ? (
              <p className="text-sm text-white/50 py-4 text-center">게시글이 없습니다.</p>
            ) : (
              adminPosts.map((p) => {
                const flagged = Number(p.report_count) > 0;
                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl p-3 ${flagged ? "bg-red-500/15 border border-red-500/40" : "glass-dark"}`}
                  >
                    <p className="font-medium text-sm line-clamp-2">{p.title}</p>
                    <p className="text-xs text-white/50 mt-1">
                      {p.author_nickname ?? "—"} · {p.category} · 신고 {p.report_count ?? 0}
                    </p>
                    <p className="text-[10px] text-white/40 mt-1">
                      {p.created_at ? new Date(p.created_at).toLocaleString("ko-KR") : ""}
                    </p>
                    <button
                      type="button"
                      className="mt-2 text-xs px-2 py-1 rounded bg-white/10"
                      onClick={() => void deletePost(p.id)}
                    >
                      삭제
                    </button>
                  </div>
                );
              })
            )}
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
                  <div key={ad.id} className="glass-dark rounded-2xl p-3 flex flex-col gap-2">
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

        {tab === "cache" && (
          <div className="mt-3 space-y-3">
            <div className="flex gap-2">
              {(["shops", "reviews", "searches"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCacheSub(k)}
                  className={`px-3 py-1 rounded-full text-xs ${
                    cacheSub === k ? "bg-accent" : "bg-white/10 text-white/70"
                  }`}
                >
                  {k === "shops" ? "가게" : k === "reviews" ? "리뷰" : "검색"}
                </button>
              ))}
            </div>
            {cacheLoading ? (
              <p className="text-sm text-white/50 py-4 text-center">불러오는 중...</p>
            ) : (
              <div className="space-y-2">
                {cacheItems.map((row) => {
                  const id = Number(row.id);
                  const reported =
                    cacheSub === "reviews" &&
                    (row.is_reported === 1 || row.is_reported === true);
                  return (
                    <div
                      key={id}
                      className={`rounded-xl p-2 text-xs ${reported ? "bg-red-500/15 border border-red-500/35" : "glass-dark"}`}
                    >
                      {cacheSub === "shops" && (
                        <>
                          <p className="font-medium">{String(row.name_zh ?? "")}</p>
                          {row.name_ko ? (
                            <p className="text-white/50 text-[10px] mt-0.5">{String(row.name_ko)}</p>
                          ) : null}
                          <p className="text-white/50 truncate mt-0.5">{String(row.address ?? "")}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <button
                              type="button"
                              className="px-2 py-0.5 rounded bg-white/10"
                              onClick={() =>
                                setShopEdit({
                                  id,
                                  name_zh: String(row.name_zh ?? ""),
                                  name_ko: row.name_ko != null ? String(row.name_ko) : "",
                                  address: String(row.address ?? ""),
                                  phone: String(row.phone ?? ""),
                                  rating: row.rating != null ? String(row.rating) : "",
                                  cost: String(row.cost ?? ""),
                                  open_time: String(row.open_time ?? ""),
                                })
                              }
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              className="px-2 py-0.5 rounded bg-white/10"
                              onClick={() => void deleteCacheRow("shops", id)}
                            >
                              삭제
                            </button>
                          </div>
                        </>
                      )}
                      {cacheSub === "reviews" && (
                        <>
                          <p className="text-white/60">{String(row.shop_name ?? "")}</p>
                          <p className="line-clamp-2 mt-1">{String(row.review_text ?? "")}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <button
                              type="button"
                              className="px-2 py-0.5 rounded bg-white/10"
                              onClick={() =>
                                setReviewEdit({
                                  id,
                                  review_text: String(row.review_text ?? ""),
                                  source: String(row.source ?? "user"),
                                })
                              }
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              className="px-2 py-0.5 rounded bg-white/10"
                              onClick={() => void deleteReviewRow(id)}
                            >
                              삭제
                            </button>
                            <button
                              type="button"
                              className="px-2 py-0.5 rounded bg-accent/40"
                              onClick={() => void verifyReview(id, "verify")}
                            >
                              ✅ 검증
                            </button>
                          </div>
                        </>
                      )}
                      {cacheSub === "searches" && (
                        <>
                          <p className="truncate">{String(row.query_text ?? "")}</p>
                          <div className="mt-2 flex gap-1">
                            <button
                              type="button"
                              className="px-2 py-0.5 rounded bg-white/10"
                              onClick={() => void deleteCacheRow("searches", id)}
                            >
                              삭제
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "shopDictionary" && (
          <div className="mt-3 space-y-3">
            <button
              type="button"
              onClick={() => {
                cancelDictionaryForm();
              }}
              className="w-full rounded-lg bg-accent py-2 text-sm"
            >
              + 가게 추가
            </button>

            <div className="glass-dark rounded-2xl p-3 space-y-2">
              <p className="text-sm text-white/80">
                {dictEditingId ? `수정 (#${dictEditingId})` : "가게 등록"}
              </p>
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder='중국어 이름 (예: 缸桶屋(城阳店))'
                value={dictForm.nameZh}
                onChange={(e) => setDictForm((s) => ({ ...s, nameZh: e.target.value }))}
              />
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="한국어 이름, 쉼표 구분 (예: 깡통집,강통집)"
                value={dictForm.nameKo}
                onChange={(e) => setDictForm((s) => ({ ...s, nameKo: e.target.value }))}
              />
              <select
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={dictForm.category}
                onChange={(e) => setDictForm((s) => ({ ...s, category: e.target.value }))}
              >
                {DICT_CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c} className="bg-[#1a1a24]">
                    {c}
                  </option>
                ))}
              </select>
              <select
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={dictForm.district}
                onChange={(e) => setDictForm((s) => ({ ...s, district: e.target.value }))}
              >
                <option value="" className="bg-[#1a1a24]">
                  지역 선택
                </option>
                {DICT_DISTRICT_OPTIONS.map((d) => (
                  <option key={d} value={d} className="bg-[#1a1a24]">
                    {d}
                  </option>
                ))}
              </select>
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="주소"
                value={dictForm.address}
                onChange={(e) => setDictForm((s) => ({ ...s, address: e.target.value }))}
              />
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="전화"
                value={dictForm.phone}
                onChange={(e) => setDictForm((s) => ({ ...s, phone: e.target.value }))}
              />
              <textarea
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm min-h-[64px]"
                placeholder="메모"
                value={dictForm.notes}
                onChange={(e) => setDictForm((s) => ({ ...s, notes: e.target.value }))}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveDictionary()}
                  className="flex-1 rounded-lg bg-accent py-2 text-sm"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => cancelDictionaryForm()}
                  className="flex-1 rounded-lg bg-white/10 py-2 text-sm"
                >
                  취소
                </button>
              </div>
            </div>

            <input
              className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
              placeholder="이름 검색"
              value={dictSearch}
              onChange={(e) => setDictSearch(e.target.value)}
            />

            {dictLoading ? (
              <p className="text-sm text-white/50 py-4 text-center">불러오는 중...</p>
            ) : (
              <div className="space-y-2">
                {filteredDictItems.map((row) => {
                  const id = Number(row.id);
                  return (
                    <div key={id} className="glass-dark rounded-xl p-3 text-xs space-y-1">
                      <p className="font-medium text-sm">{String(row.name_zh ?? "")}</p>
                      <p className="text-white/60">{formatShopDictKoJson(row.name_ko)}</p>
                      <p className="text-white/50">
                        {String(row.category ?? "")}
                        {row.district ? ` · ${String(row.district)}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        <button
                          type="button"
                          className="px-2 py-0.5 rounded bg-white/10"
                          onClick={() => startEditDictionary(row)}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className="px-2 py-0.5 rounded bg-white/10"
                          onClick={() => void deleteDictionaryRow(id)}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "knowledge" && (
          <div className="mt-3 space-y-3">
            <div className="glass-dark rounded-2xl p-3 space-y-2">
              <p className="text-sm text-white/80">지식 등록 (텍스트)</p>
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="제목"
                value={kbTitle}
                onChange={(e) => setKbTitle(e.target.value)}
              />
              <label className="block text-xs text-white/50">카테고리</label>
              <select
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={kbCategory}
                onChange={(e) => setKbCategory(e.target.value)}
              >
                {["일반", "비자", "의료", "교육", "부동산", "생활"].map((c) => (
                  <option key={c} value={c} className="bg-[#1a1a24]">
                    {c}
                  </option>
                ))}
              </select>
              <textarea
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm min-h-[100px]"
                placeholder="내용"
                value={kbContent}
                onChange={(e) => setKbContent(e.target.value)}
              />
              <button
                type="button"
                className="w-full rounded-lg bg-accent py-2 text-sm"
                onClick={() => {
                  if (!kbTitle.trim() || !kbContent.trim()) return;
                  void fetch("/api/admin/knowledge", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      title: kbTitle.trim(),
                      content: kbContent.trim(),
                      fileType: "manual",
                      category: kbCategory.trim() || "일반",
                    }),
                  }).then((r) => {
                    if (r.ok) {
                      setKbTitle("");
                      setKbContent("");
                      void fetch("/api/admin/knowledge")
                        .then((x) => x.json())
                        .then((d: { items?: typeof kbItems }) => {
                          if (Array.isArray(d.items)) setKbItems(d.items);
                        });
                    }
                  });
                }}
              >
                등록
              </button>
            </div>
            {kbLoading ? (
              <p className="text-sm text-white/50 text-center">불러오는 중...</p>
            ) : (
              kbItems.map((it) => (
                <div key={it.id} className="glass-dark rounded-xl p-3 text-sm flex flex-col gap-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium line-clamp-1">{it.title}</span>
                    <span className="text-white/40 text-xs shrink-0">{it.file_type}</span>
                  </div>
                  <p className="text-xs text-white/50">
                    {it.category} · 약 {it.content_length ?? 0}자 ·{" "}
                    {it.created_at ? new Date(it.created_at).toLocaleString("ko-KR") : ""}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded bg-white/10"
                      onClick={() => {
                        const next = !Boolean(it.is_active);
                        void fetch("/api/admin/knowledge", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: it.id, is_active: next }),
                        }).then((r) => {
                          if (r.ok)
                            setKbItems((prev) =>
                              prev.map((x) =>
                                x.id === it.id ? { ...x, is_active: next } : x
                              )
                            );
                        });
                      }}
                    >
                      {it.is_active ? "비활성" : "활성"}
                    </button>
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded bg-white/10"
                      onClick={() => {
                        void fetch("/api/admin/knowledge", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: it.id }),
                        }).then((r) => {
                          if (r.ok) setKbItems((prev) => prev.filter((x) => x.id !== it.id));
                        });
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "ai" && (
          <div className="mt-3 space-y-4">
            <div className="glass-dark rounded-2xl p-3 space-y-2 text-sm">
              <p className="text-white/80 font-medium">AI 모델</p>
              <p className="text-white/60">gpt-4o-mini (고정)</p>
            </div>
            <div className="glass-dark rounded-2xl p-3 space-y-2 text-sm">
              <p className="text-white/80 font-medium">시스템 프롬프트</p>
              <p className="text-white/50 text-xs leading-relaxed">{SYSTEM_PROMPT_NOTE}</p>
            </div>
            <div className="glass-dark rounded-2xl p-3 space-y-2 text-sm">
              <p className="text-white/80 font-medium">클라이언트 설정 (localStorage)</p>
              <label className="block text-xs text-white/50">무료 AI 질문 횟수 / 일</label>
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                value={freeAiLimit}
                onChange={(e) => setFreeAiLimit(e.target.value)}
              />
              <label className="block text-xs text-white/50 mt-2">캐시 만료 (일)</label>
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                value={cacheExpireDays}
                onChange={(e) => setCacheExpireDays(e.target.value)}
              />
              <button
                type="button"
                className="w-full mt-2 rounded-lg bg-accent py-2 text-sm"
                onClick={saveAiSettings}
              >
                설정 저장
              </button>
            </div>

            <div className="glass-dark rounded-2xl p-3 text-sm space-y-2">
              <p className="text-white/80 mb-1">앱 내 AI 피드백</p>
              <p className="text-xs text-white/50">좋아요/싫어요 비율: {feedbackStats.ratio}</p>
            </div>
            <div className="glass-dark rounded-2xl p-3 text-sm space-y-1">
              <p className="text-white/80">질문 통계</p>
              <p className="text-xs text-white/60">오늘: {questionStats.today}</p>
              <p className="text-xs text-white/60">총: {questionStats.total}</p>
            </div>
            <div className="glass-dark rounded-2xl p-3 text-sm">
              <p className="text-white/80 mb-2">인기 질문 TOP 5</p>
              {topQuestions.map(([q, count]) => (
                <p key={q} className="text-xs text-white/70">
                  {q} ({count})
                </p>
              ))}
            </div>
            {chatFeedback.map((f, idx) => (
              <div key={`${f.messageIndex}-${idx}`} className="glass-dark rounded-2xl p-3 text-sm">
                <p>{f.feedback === "good" ? "👍 좋아요" : "👎 싫어요"}</p>
                {f.reason && <p className="text-xs text-white/50 mt-1">사유: {f.reason}</p>}
              </div>
            ))}

            <p className="text-xs text-white/40 px-1">로컬 업체 · 가게 신고</p>
            <div className="glass-dark p-3 rounded-2xl space-y-2">
              <p className="text-sm text-white/80">가게 추가 (shopDict 보조)</p>
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="중국어이름"
                value={form.zh}
                onChange={(e) => setForm((s) => ({ ...s, zh: e.target.value }))}
              />
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="별명들 (쉼표 구분)"
                value={form.aliases}
                onChange={(e) => setForm((s) => ({ ...s, aliases: e.target.value }))}
              />
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="카테고리"
                value={form.category}
                onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
              />
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="지역"
                value={form.district}
                onChange={(e) => setForm((s) => ({ ...s, district: e.target.value }))}
              />
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="한줄설명"
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              />
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="추천메뉴"
                value={form.recommendMenu}
                onChange={(e) => setForm((s) => ({ ...s, recommendMenu: e.target.value }))}
              />
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="가격대"
                value={form.priceRange}
                onChange={(e) => setForm((s) => ({ ...s, priceRange: e.target.value }))}
              />
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                placeholder="꿀팁"
                value={form.tip}
                onChange={(e) => setForm((s) => ({ ...s, tip: e.target.value }))}
              />
              <button type="button" onClick={addShop} className="w-full rounded-lg bg-accent py-2 text-sm">
                가게 추가
              </button>
            </div>
            {mergedShops.map((shop) => (
              <div
                key={shopKey(shop)}
                className="glass-dark rounded-2xl p-3 flex items-start justify-between gap-2"
              >
                <div>
                  <p className="font-semibold text-sm">
                    {shop.koreanNames[0]} ({shop.zh})
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    {shop.category} · {shop.district}
                  </p>
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

            {!showShopReports ? (
              <button
                type="button"
                className="w-full py-2 rounded-xl bg-white/10 text-sm"
                onClick={() => setShowShopReports(true)}
              >
                가게 신고 목록 보기 →
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  className="text-xs text-accent"
                  onClick={() => setShowShopReports(false)}
                >
                  ← 접기
                </button>
                {reportsLoading ? (
                  <p className="text-sm text-white/50 py-4 text-center">불러오는 중...</p>
                ) : apiReports.length === 0 ? (
                  <p className="text-sm text-white/50 py-4 text-center">신고 내역이 없습니다.</p>
                ) : (
                  apiReports.map((r, idx) => {
                    const rid = r.id ?? idx;
                    return (
                      <div
                        key={rid}
                        className="glass-dark rounded-2xl p-3 flex items-center justify-between gap-2"
                      >
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
          </div>
        )}

        {shopEdit && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
            onClick={() => setShopEdit(null)}
          >
            <div
              className="glass-dark rounded-2xl p-4 w-full max-w-[430px] space-y-2 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-medium">가게 캐시 수정</p>
              <label className="text-[10px] text-white/50">중국어 이름</label>
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                value={shopEdit.name_zh}
                onChange={(e) => setShopEdit((s) => (s ? { ...s, name_zh: e.target.value } : s))}
              />
              <label className="text-[10px] text-white/50">한국어 이름</label>
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                value={shopEdit.name_ko}
                onChange={(e) => setShopEdit((s) => (s ? { ...s, name_ko: e.target.value } : s))}
              />
              <label className="text-[10px] text-white/50">주소</label>
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                value={shopEdit.address}
                onChange={(e) => setShopEdit((s) => (s ? { ...s, address: e.target.value } : s))}
              />
              <label className="text-[10px] text-white/50">전화</label>
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                value={shopEdit.phone}
                onChange={(e) => setShopEdit((s) => (s ? { ...s, phone: e.target.value } : s))}
              />
              <label className="text-[10px] text-white/50">평점</label>
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                value={shopEdit.rating}
                onChange={(e) => setShopEdit((s) => (s ? { ...s, rating: e.target.value } : s))}
              />
              <label className="text-[10px] text-white/50">가격</label>
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                value={shopEdit.cost}
                onChange={(e) => setShopEdit((s) => (s ? { ...s, cost: e.target.value } : s))}
              />
              <label className="text-[10px] text-white/50">영업시간</label>
              <input
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm"
                value={shopEdit.open_time}
                onChange={(e) => setShopEdit((s) => (s ? { ...s, open_time: e.target.value } : s))}
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-accent py-2 text-sm"
                  onClick={() => void saveShopCacheEdit()}
                >
                  저장
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-white/10 py-2 text-sm"
                  onClick={() => setShopEdit(null)}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {reviewEdit && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
            onClick={() => setReviewEdit(null)}
          >
            <div
              className="glass-dark rounded-2xl p-4 w-full max-w-[430px] space-y-2 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-medium">리뷰 캐시 수정</p>
              <label className="text-[10px] text-white/50">소스</label>
              <select
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white"
                value={reviewEdit.source}
                onChange={(e) => setReviewEdit((s) => (s ? { ...s, source: e.target.value } : s))}
              >
                {REVIEW_SOURCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-[#1a1a24]">
                    {opt}
                  </option>
                ))}
              </select>
              <label className="text-[10px] text-white/50">리뷰 텍스트</label>
              <textarea
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm min-h-[120px]"
                value={reviewEdit.review_text}
                onChange={(e) => setReviewEdit((s) => (s ? { ...s, review_text: e.target.value } : s))}
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-accent py-2 text-sm"
                  onClick={() => void saveReviewEdit()}
                >
                  저장
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-white/10 py-2 text-sm"
                  onClick={() => setReviewEdit(null)}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
