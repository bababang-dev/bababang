"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Sparkles, Undo2 } from "lucide-react";
import { useStore } from "@/stores/useStore";
import { useModalBodyLock } from "@/lib/useModalBodyLock";
import { MediaUploadArea, type MediaItem } from "@/components/common/MediaUploadArea";

export type PromoCategory =
  | "restaurant"
  | "wholesale"
  | "realestate"
  | "education"
  | "medical"
  | "trade"
  | "beauty";

const CATEGORIES: { id: PromoCategory; icon: string; name: string }[] = [
  { id: "restaurant", icon: "🍜", name: "음식점" },
  { id: "wholesale", icon: "🏭", name: "도매/유통" },
  { id: "realestate", icon: "🏠", name: "부동산" },
  { id: "education", icon: "📚", name: "교육" },
  { id: "medical", icon: "🏥", name: "의료" },
  { id: "trade", icon: "🚢", name: "무역/물류" },
  { id: "beauty", icon: "💇", name: "미용" },
];

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs text-black/50 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`px-3 py-1.5 rounded-full text-xs ${
              value === o ? "bg-accent text-white" : "bg-white text-black/70 border border-black/10"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WritePromotionModal() {
  const {
    promotionModalOpen,
    closePromotionModal,
    triggerPromotionsRefresh,
    currentUserId,
  } = useStore();
  useModalBodyLock(promotionModalOpen);
  const [step, setStep] = useState<"cat" | "form">("cat");
  const [cat, setCat] = useState<PromoCategory | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessNameZh, setBusinessNameZh] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [wechat, setWechat] = useState("");
  const [description, setDescription] = useState("");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [aiDescLoading, setAiDescLoading] = useState(false);
  const [aiOriginalContent, setAiOriginalContent] = useState("");
  const [aiState, setAiState] = useState<"idle" | "ai" | "restored">("idle");
  const [tagsText, setTagsText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [td, setTd] = useState<Record<string, string>>({});
  const setF = (k: string, v: string) => setTd((s) => ({ ...s, [k]: v }));

  const reset = () => {
    setStep("cat");
    setCat(null);
    setBusinessName("");
    setBusinessNameZh("");
    setAddress("");
    setPhone("");
    setWechat("");
    setDescription("");
    setTagsText("");
    mediaItems.forEach((m) => URL.revokeObjectURL(m.preview));
    setMediaItems([]);
    setTd({});
    setUploadProgress(null);
    setUploadingIndex(null);
    setAiState("idle");
    setAiOriginalContent("");
  };

  const onClose = () => {
    reset();
    closePromotionModal();
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const next = [...mediaItems];
    for (let i = 0; i < files.length && next.length < 5; i++) {
      const f = files[i];
      next.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setMediaItems(next.slice(0, 5));
    e.target.value = "";
  };

  const removeMedia = (idx: number) => {
    setMediaItems((prev) => {
      const c = [...prev];
      const [r] = c.splice(idx, 1);
      if (r) URL.revokeObjectURL(r.preview);
      return c;
    });
  };

  const uploadAll = async (): Promise<string> => {
    const urls: string[] = [];
    for (let i = 0; i < mediaItems.length; i++) {
      setUploadingIndex(i);
      setUploadProgress(`업로드 중... (${i + 1}/${mediaItems.length})`);
      const fd = new FormData();
      fd.append("file", mediaItems[i].file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "업로드 실패");
      urls.push(data.url);
    }
    setUploadingIndex(null);
    setUploadProgress(null);
    return urls.join(",");
  };

  const handlePromotionAiHelperClick = async () => {
    if (aiState === "ai") {
      setDescription(aiOriginalContent);
      setAiState("restored");
      return;
    }
    if (!cat || !businessName.trim()) return;
    const selectedCategory = CATEGORIES.find((x) => x.id === cat)?.name ?? cat;
    const extra = [
      address.trim(),
      phone.trim(),
      wechat.trim(),
      businessNameZh.trim(),
      ...Object.values(td).map((v) => String(v).trim()).filter(Boolean),
    ].filter(Boolean).join(", ");

    setAiOriginalContent(description);
    setAiDescLoading(true);
    try {
      const res = await fetch("/api/ai-write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "description",
          data: {
            name: businessName,
            category: selectedCategory,
            extra,
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { content?: string };
      if (data.content) {
        setDescription(data.content);
        setAiState("ai");
      }
    } finally {
      setAiDescLoading(false);
    }
  };

  const onSubmit = async () => {
    if (!cat || !businessName.trim()) return;
    let imagesCsv = "";
    try {
      if (mediaItems.length > 0) imagesCsv = await uploadAll();
    } catch {
      setUploadingIndex(null);
      setUploadProgress(null);
      return;
    }
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId ?? 1,
          category: cat,
          businessName: businessName.trim(),
          businessNameZh: businessNameZh.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          wechat: wechat.trim() || null,
          description: description.trim() || null,
          images: imagesCsv || null,
          templateData: td,
          tags: tagsText.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { tags?: string };
      if (res.ok) {
        triggerPromotionsRefresh();
        const hadManualTags = tagsText.trim().length > 0;
        const aiTags =
          data.tags != null && String(data.tags).trim() !== "" ? String(data.tags).trim() : "";
        if (!hadManualTags && aiTags) {
          setTagsText(aiTags);
          await new Promise((r) => setTimeout(r, 500));
        }
        setToast("등록되었습니다!");
        window.setTimeout(() => {
          setToast(null);
          onClose();
        }, 1800);
      }
    } catch {
      /* ignore */
    }
  };

  if (!promotionModalOpen) return null;

  const isBusy = !!uploadProgress || uploadingIndex !== null;

  const inputCls =
    "w-full rounded-xl bg-white px-3 py-2.5 text-sm outline-none border border-black/10 placeholder:text-black/35";

  const categoryFields = () => {
    if (!cat) return null;
    switch (cat) {
      case "restaurant":
        return (
          <div className="space-y-3">
            <ChipRow
              label="음식 종류"
              options={["한식", "중식", "일식", "양식", "기타"]}
              value={td.foodType || ""}
              onChange={(v) => setF("foodType", v)}
            />
            <div>
              <p className="text-xs text-black/50 mb-1">대표 메뉴 (3개까지)</p>
              <input
                className={inputCls}
                placeholder="예시) 삼겹살, 김밥, 마라탕"
                value={td.menus || ""}
                onChange={(e) => setF("menus", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-black/50 mb-1">가격대</p>
              <input
                className={inputCls}
                placeholder="인당 80위안"
                value={td.priceRange || ""}
                onChange={(e) => setF("priceRange", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-black/50 mb-1">영업시간</p>
              <input
                className={inputCls}
                placeholder="11:00 ~ 22:00"
                value={td.hours || ""}
                onChange={(e) => setF("hours", e.target.value)}
              />
            </div>
            <ChipRow
              label="한국어 가능 여부"
              options={["가능", "불가능"]}
              value={td.koreanMenu || ""}
              onChange={(v) => setF("koreanMenu", v)}
            />
            <ChipRow
              label="배달 가능 여부"
              options={["가능", "불가능"]}
              value={td.delivery || ""}
              onChange={(v) => setF("delivery", v)}
            />
            <ChipRow
              label="주차 가능 여부"
              options={["가능", "불가능"]}
              value={td.parking || ""}
              onChange={(v) => setF("parking", v)}
            />
          </div>
        );
      case "wholesale":
        return (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-black/50 mb-1">취급 품목</p>
              <input
                className={inputCls}
                placeholder="의류, 전자부품, 식자재 등"
                value={td.products || ""}
                onChange={(e) => setF("products", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-black/50 mb-1">주요 납품처</p>
              <input
                className={inputCls}
                placeholder="한국, 동남아, 내수 등"
                value={td.supplyTo || ""}
                onChange={(e) => setF("supplyTo", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-black/50 mb-1">공장 위치</p>
              <input
                className={inputCls}
                placeholder="칭다오시 청양구 xxx"
                value={td.factoryLocation || ""}
                onChange={(e) => setF("factoryLocation", e.target.value)}
              />
            </div>
            <ChipRow
              label="샘플 가능 여부"
              options={["가능", "불가능", "협의"]}
              value={td.sample || ""}
              onChange={(v) => setF("sample", v)}
            />
          </div>
        );
      case "realestate":
        return (
          <div className="space-y-3">
            <ChipRow
              label="유형"
              options={["아파트", "상가"]}
              value={td.estateType || ""}
              onChange={(v) => setF("estateType", v)}
            />
            <div>
              <p className="text-xs text-black/50 mb-1">면적 (平米/㎡)</p>
              <input
                className={inputCls}
                placeholder="85"
                value={td.area || ""}
                onChange={(e) => setF("area", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-black/50 mb-1">월 임대료 (위안/월)</p>
              <input
                className={inputCls}
                placeholder="3500"
                value={td.rent || ""}
                onChange={(e) => setF("rent", e.target.value)}
              />
            </div>
            <ChipRow
              label="층수"
              options={["저층", "중층", "고층"]}
              value={td.floorLevel || ""}
              onChange={(v) => setF("floorLevel", v)}
            />
            <div>
              <p className="text-xs text-black/50 mb-1">방 개수</p>
              <input
                className={inputCls}
                placeholder="3"
                value={td.rooms || ""}
                onChange={(e) => setF("rooms", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-black/50 mb-1">입주 가능일</p>
              <input
                className={inputCls}
                placeholder="즉시 입주 가능"
                value={td.moveIn || ""}
                onChange={(e) => setF("moveIn", e.target.value)}
              />
            </div>
          </div>
        );
      case "education":
        return (
          <div className="space-y-3">
            <ChipRow
              label="교육 분야"
              options={["국어", "영어", "수학", "중국어", "예체능", "기타"]}
              value={td.eduField || ""}
              onChange={(v) => setF("eduField", v)}
            />
            <ChipRow
              label="대상"
              options={["유아", "초등", "중등", "성인"]}
              value={td.target || ""}
              onChange={(v) => setF("target", v)}
            />
            <ChipRow
              label="수업 방식"
              options={["대면", "온라인", "혼합"]}
              value={td.mode || ""}
              onChange={(v) => setF("mode", v)}
            />
            <div>
              <p className="text-xs text-black/50 mb-1">수업료</p>
              <input
                className={inputCls}
                placeholder="월 2000위안 또는 회당 200위안"
                value={td.tuition || ""}
                onChange={(e) => setF("tuition", e.target.value)}
              />
            </div>
            <ChipRow
              label="시범 수업 가능 여부"
              options={["가능", "불가능"]}
              value={td.trial || ""}
              onChange={(v) => setF("trial", v)}
            />
          </div>
        );
      case "medical":
        return (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-black/50 mb-1">진료 분야</p>
              <input
                className={inputCls}
                placeholder="내과, 피부과, 치과 등"
                value={td.medFields || ""}
                onChange={(e) => setF("medFields", e.target.value)}
              />
            </div>
            <ChipRow
              label="한국어 진료 가능"
              options={["가능", "불가능"]}
              value={td.koreanMed || ""}
              onChange={(v) => setF("koreanMed", v)}
            />
            <ChipRow
              label="의보 적용 여부"
              options={["가능", "불가능", "부분적용"]}
              value={td.insurance || ""}
              onChange={(v) => setF("insurance", v)}
            />
            <div>
              <p className="text-xs text-black/50 mb-1">진료 시간</p>
              <input
                className={inputCls}
                placeholder="09:00 ~ 18:00"
                value={td.medHours || ""}
                onChange={(e) => setF("medHours", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-black/50 mb-1">예약 방법</p>
              <input
                className={inputCls}
                placeholder="전화, 위챗 예약 가능"
                value={td.booking || ""}
                onChange={(e) => setF("booking", e.target.value)}
              />
            </div>
          </div>
        );
      case "trade":
        return (
          <div className="space-y-3">
            <ChipRow
              label="서비스 종류"
              options={["수출입", "통관", "운송", "창고"]}
              value={td.serviceKind || ""}
              onChange={(v) => setF("serviceKind", v)}
            />
            <div>
              <p className="text-xs text-black/50 mb-1">취급 가능 품목</p>
              <input
                className={inputCls}
                placeholder="일반화물, 식품, 화학품 등"
                value={td.tradeItems || ""}
                onChange={(e) => setF("tradeItems", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-black/50 mb-1">배송 가능 지역</p>
              <input
                className={inputCls}
                placeholder="한국, 일본, 동남아 등"
                value={td.regions || ""}
                onChange={(e) => setF("regions", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-black/50 mb-1">지역별 예상 소요일</p>
              <input
                className={inputCls}
                placeholder="한국 5~7일, 일본 3~5일"
                value={td.leadTime || ""}
                onChange={(e) => setF("leadTime", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-black/50 mb-1">최소 물량</p>
              <input
                className={inputCls}
                placeholder="1CBM 이상 또는 협의"
                value={td.minQty || ""}
                onChange={(e) => setF("minQty", e.target.value)}
              />
            </div>
          </div>
        );
      case "beauty":
        return (
          <div className="space-y-3">
            <ChipRow
              label="서비스 종류"
              options={["헤어", "네일", "속눈썹", "피부"]}
              value={td.beautyService || ""}
              onChange={(v) => setF("beautyService", v)}
            />
            <div>
              <p className="text-xs text-black/50 mb-1">가격대</p>
              <input
                className={inputCls}
                placeholder="커트 80위안, 염색 200위안~"
                value={td.beautyPrice || ""}
                onChange={(e) => setF("beautyPrice", e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-black/50 mb-1">예약 방법</p>
              <input
                className={inputCls}
                placeholder="전화, 위챗 예약"
                value={td.beautyBooking || ""}
                onChange={(e) => setF("beautyBooking", e.target.value)}
              />
            </div>
            <ChipRow
              label="한국인 시술사 여부"
              options={["있음", "없음"]}
              value={td.koreanStylist || ""}
              onChange={(v) => setF("koreanStylist", v)}
            />
            <div>
              <p className="text-xs text-black/50 mb-1">영업시간</p>
              <input
                className={inputCls}
                placeholder="10:00 ~ 20:00"
                value={td.beautyHours || ""}
                onChange={(e) => setF("beautyHours", e.target.value)}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[75] bg-[#f5f6fa] text-black max-w-[430px] mx-auto flex flex-col"
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-black/10 flex-shrink-0">
          <button
            type="button"
            onClick={step === "form" ? () => setStep("cat") : onClose}
            className="p-2 rounded-full hover:bg-black/5"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="font-outfit font-semibold">업체 홍보</h2>
          {step === "form" ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!businessName.trim() || !!uploadProgress || aiDescLoading}
              className="px-3 py-1.5 rounded-lg bg-accent text-white text-sm disabled:opacity-50"
            >
              등록
            </button>
          ) : (
            <span className="w-12" />
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-24">
          {step === "cat" && (
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCat(c.id);
                    setTd({});
                    setStep("form");
                  }}
                  className="rounded-2xl bg-white border border-black/10 p-4 text-left active:scale-[0.98] transition-transform"
                >
                  <span className="text-2xl">{c.icon}</span>
                  <p className="font-medium mt-2 text-sm">{c.name}</p>
                </button>
              ))}
            </div>
          )}

          {step === "form" && cat && (
            <div className="space-y-4">
              <p className="text-xs text-accent font-medium">
                {CATEGORIES.find((x) => x.id === cat)?.name} 템플릿
              </p>
              <div>
                <p className="text-xs text-black/50 mb-1">업체명 (한국어) *</p>
                <input
                  className={inputCls}
                  placeholder="업체명을 입력하세요"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs text-black/50 mb-1">업체명 (중국어)</p>
                <input
                  className={inputCls}
                  placeholder="中文名称（可选）"
                  value={businessNameZh}
                  onChange={(e) => setBusinessNameZh(e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs text-black/50 mb-1">주소</p>
                <input
                  className={inputCls}
                  placeholder="상세 주소를 입력하세요"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs text-black/50 mb-1">전화번호</p>
                <input
                  className={inputCls}
                  placeholder="0532-xxxx-xxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs text-black/50 mb-1">위챗 ID</p>
                <input
                  className={inputCls}
                  placeholder="WeChat ID"
                  value={wechat}
                  onChange={(e) => setWechat(e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs text-black/50 mb-1">한줄 소개</p>
                <textarea
                  className={`${inputCls} w-full min-h-[80px]`}
                  placeholder="업체를 한 줄로 소개해주세요"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => void handlePromotionAiHelperClick()}
                  disabled={aiDescLoading || isBusy || !businessName.trim()}
                  className={`mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-[#6c5ce7] text-sm font-medium text-[#6c5ce7] disabled:opacity-50 ${
                    aiState === "ai" ? "bg-[rgba(108,92,231,0.05)]" : "bg-white"
                  }`}
                >
                  {aiDescLoading ? (
                    <Sparkles className="w-4 h-4 text-[#6c5ce7]" />
                  ) : aiState === "ai" ? (
                    <Undo2 className="w-4 h-4 text-[#6c5ce7]" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-[#6c5ce7]" />
                  )}
                  {aiDescLoading
                    ? "AI 작성 중..."
                    : aiState === "ai"
                      ? "원본으로 되돌리기"
                      : aiState === "restored"
                        ? "AI 다시 작성하기"
                        : "AI 작성 도우미"}
                </button>
              </div>

              <MediaUploadArea
                mediaItems={mediaItems}
                onPick={onPick}
                onRemove={removeMedia}
                fileInputRef={fileRef}
                accept="image/*"
                uploadProgress={uploadProgress}
                uploadingIndex={uploadingIndex}
              />

              {categoryFields()}

              <input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="태그를 입력하세요 (쉼표로 구분)"
                className="w-full rounded-xl bg-white px-4 py-3 text-sm outline-none border border-black/10"
              />
              <p className="text-[12px] text-[#a78bfa] -mt-2">
                태그를 안 쓰면 AI가 자동으로 생성해요 ✨
              </p>
            </div>
          )}
        </div>
      </motion.div>
      {toast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[90] bg-black/85 text-white text-xs px-4 py-2 rounded-full">
          {toast}
        </div>
      )}
    </>
  );
}
