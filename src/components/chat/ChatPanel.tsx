"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, ThumbsUp, ThumbsDown } from "lucide-react";
import { useStore } from "@/stores/useStore";
import { i18n } from "@/lib/i18n";
import type { ShopEntry } from "@/lib/shopDict";
import type { ChatMessage } from "@/types";
import { ReportModal } from "@/components/modals/ReportModal";
import { openDidi } from "@/lib/deeplinks";
import { trackActivity } from "@/lib/trackActivity";
import { useModalBodyLock } from "@/lib/useModalBodyLock";


const FREE_QUOTA_MSG_PREFIX = "BB_UPGRADE_CTA\n";

const FREE_QUOTA_EXCEEDED_KO = `무료 질문 5회를 모두 사용하셨어요!

마지막 질문으로부터 24시간 후에 다시 5회 질문이 가능해요.

✨ 프리미엄으로 업그레이드하면:
- AI 질문 무제한
- AI 통역 (사진 번역)
- 음성 질문
- 상권 분석 (예정)
- 입시 상담 (예정)`;

const FREE_QUOTA_EXCEEDED_ZH = `您已用完 5 次免费提问。

自上次提问起满 24 小时后，可再次获得 5 次提问。

✨ 升级高级版可享：
- AI 提问无限
- AI 翻译（拍照翻译）
- 语音提问
- 商圈分析（即将上线）
- 升学咨询（即将上线）`;

/** localStorage 무료 AI 질문 — 24시간 경과 시 카운트 리셋 */
function readAiQuotaAfterReset(): number {
  if (typeof window === "undefined") return 0;
  const now = Date.now();
  const firstTime = parseInt(localStorage.getItem("bababang-ai-first-time") || "0", 10);
  let todayCount = parseInt(localStorage.getItem("bababang-ai-count") || "0", 10);
  if (firstTime > 0 && now - firstTime > 24 * 60 * 60 * 1000) {
    todayCount = 0;
    localStorage.setItem("bababang-ai-count", "0");
    localStorage.setItem("bababang-ai-first-time", "0");
  }
  return todayCount;
}

/** AI 스트림 done 시에만 호출 */
function bumpAiQuotaOnSuccess() {
  if (typeof window === "undefined") return;
  const currentCount = parseInt(localStorage.getItem("bababang-ai-count") || "0", 10);
  const currentFirst = parseInt(localStorage.getItem("bababang-ai-first-time") || "0", 10);
  localStorage.setItem("bababang-ai-count", String(currentCount + 1));
  if (!currentFirst) {
    localStorage.setItem("bababang-ai-first-time", String(Date.now()));
  }
}

const MASTER_PHONES = ["18514747772"];
const MASTER_IDS = ["1", "2"];
const FREE_AI_DAILY_LIMIT = 5;

function getCacheMaxAgeDays(): number {
  if (typeof window === "undefined") return 7;
  const v = parseInt(window.localStorage.getItem("bababang-cache-expire-days") || "7", 10);
  if (!Number.isFinite(v) || v < 1) return 7;
  return Math.min(90, v);
}

function cleanResponse(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/```[^`]*```/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n?\[RECOMMEND:[^\]]+\]\s*/g, "")
    .replace(/\n{5,}/g, "\n\n\n")
    .trim();
}

const AD_CATEGORY_KEYWORDS: Record<string, string[]> = {
  맛집: ["맛집", "식당", "먹", "음식", "고기", "치킨", "국밥", "카페"],
  병원: ["병원", "의원", "치과", "아플", "진료"],
  부동산: ["집", "부동산", "임대", "아파트", "방"],
  교육: ["학교", "학원", "과외", "교육"],
  미용: ["미용", "헤어", "네일"],
};

function detectAdCategory(userMessage: string): string {
  for (const [cat, keywords] of Object.entries(AD_CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => userMessage.includes(k))) return cat;
  }
  return "";
}

type AdApiRow = {
  business_name?: string;
  business_name_zh?: string;
  address?: string;
  phone?: string;
  wechat?: string;
  images?: string;
};

function adRowToRecommendedShop(
  ad: AdApiRow
): NonNullable<ChatMessage["recommendedShops"]>[number] {
  const imgs =
    typeof ad.images === "string" && ad.images
      ? ad.images.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const wechat = ad.wechat?.trim();
  return {
    name: String(ad.business_name_zh || ad.business_name || "").trim() || "AD",
    koreanName: String(ad.business_name || "").trim(),
    address: String(ad.address || ""),
    tel: String(ad.phone || ""),
    rating: "",
    cost: "",
    openTime: wechat ? `WeChat: ${wechat}` : "",
    photos: imgs,
    lat: "",
    lng: "",
    isAd: true,
  };
}

function lineStartsWithEmoji(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  const firstChar = t.codePointAt(0) || 0;
  return firstChar > 0x1f000 || (firstChar >= 0x2600 && firstChar <= 0x27bf);
}

type AiSegment =
  | { type: "blank" }
  | { type: "text"; lines: string[] }
  | { type: "chips"; lines: string[] };

function TextBlockWithChecklist({
  lines,
  segIdx,
  messageKey,
}: {
  lines: string[];
  segIdx: number;
  messageKey: string;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  return (
    <div className="flex flex-col gap-0.5">
      {lines.map((line, li) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("□") || trimmed.startsWith("☐")) {
          const id = `${messageKey}-s${segIdx}-l${li}`;
          const isChecked = checked[id] ?? false;
          const label = trimmed.replace(/^□\s*|☐\s*/, "");
          return (
            <label
              key={id}
              className="flex gap-2 py-1 cursor-pointer items-start text-left"
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) =>
                  setChecked((s) => ({ ...s, [id]: e.target.checked }))
                }
                className="mt-1 shrink-0 accent-[#6c5ce7]"
              />
              <span
                className={
                  isChecked ? "line-through text-white/50" : "text-white/95"
                }
              >
                {label}
              </span>
            </label>
          );
        }
        return (
          <div
            key={`${messageKey}-plain-s${segIdx}-l${li}`}
            className="whitespace-pre-wrap break-words"
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}

function segmentAiMessage(text: string): AiSegment[] {
  const rawLines = text.split(/\r?\n/);
  const segments: AiSegment[] = [];
  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    if (line.trim() === "") {
      segments.push({ type: "blank" });
      i++;
      continue;
    }
    if (lineStartsWithEmoji(line)) {
      const chipLines: string[] = [];
      while (i < rawLines.length) {
        const L = rawLines[i];
        if (L.trim() === "") break;
        if (!lineStartsWithEmoji(L)) break;
        chipLines.push(L.trim());
        i++;
      }
      segments.push({ type: "chips", lines: chipLines });
    } else {
      const textLines: string[] = [];
      while (i < rawLines.length) {
        const L = rawLines[i];
        if (L.trim() === "") break;
        if (lineStartsWithEmoji(L)) break;
        textLines.push(L);
        i++;
      }
      segments.push({ type: "text", lines: textLines });
    }
  }
  return segments;
}

function AiMessageContent({
  text,
  isStatusPhase,
  onChipTap,
  messageKey,
}: {
  text: string;
  isStatusPhase: boolean;
  onChipTap: (line: string) => void;
  messageKey?: string;
}) {
  if (isStatusPhase) {
    return <>{text}</>;
  }
  const segs = segmentAiMessage(text);
  return (
    <>
      {segs.map((seg, segIdx) => {
        if (seg.type === "blank") {
          return <div key={segIdx} className="h-2 w-full shrink-0" />;
        }
        if (seg.type === "text") {
          return (
            <div key={segIdx}>
              {messageKey ? (
                <TextBlockWithChecklist
                  lines={seg.lines}
                  segIdx={segIdx}
                  messageKey={messageKey}
                />
              ) : (
                <div className="whitespace-pre-wrap break-words">
                  {seg.lines.join("\n")}
                </div>
              )}
            </div>
          );
        }
        return (
          <div key={segIdx} className="flex flex-wrap items-start">
            {seg.lines.map((line, li) => (
              <button
                key={li}
                type="button"
                onClick={() => onChipTap(line)}
                className="inline-flex items-center glass-dark cursor-pointer transition-all duration-200 m-[3px] rounded-[20px] px-[14px] py-2 text-[13px] text-white bg-[rgba(108,92,231,0.1)] hover:bg-[rgba(108,92,231,0.25)] border border-[rgba(108,92,231,0.3)]"
              >
                {line}
              </button>
            ))}
          </div>
        );
      })}
    </>
  );
}

const feedbackReasonsKo = ["정보가 틀림", "내용이 부족함", "엉뚱한 답변", "기타"] as const;
const feedbackReasonsZh = ["信息不准确", "内容不足", "答非所问", "其他"] as const;

const quickPrompts = [
  "quickFood",
  "quickVisa",
  "quickHospital",
  "quickRealty",
] as const;

async function persistFeedbackToDb(payload: {
  userId: number;
  userMessage: string;
  aiResponse: string;
  feedback: "good" | "bad";
  feedbackReason?: string;
}) {
  try {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* ignore */
  }
}

export function ChatPanel() {
  const user = useStore((s) => s.user);
  const {
    chatOpen,
    setChatOpen,
    chatMessages,
    addChatMessage,
    updateLastAiMessage,
    lang,
    incrementQuestion,
    deductToken,
    setUser,
    setMembershipOpen,
    addFeedback,
    incrementQuestionCount,
    openMapActionSheet,
    currentUserId,
    requireLogin,
    touchChatActivity,
  } = useStore();
  useModalBodyLock(chatOpen);
  const [quotaVersion, setQuotaVersion] = useState(0);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamReplyStarted, setStreamReplyStarted] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const chatPendingPrompt = useStore((s) => s.chatPendingPrompt);
  const setChatPendingPrompt = useStore((s) => s.setChatPendingPrompt);
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {});
  const [toast, setToast] = useState("");
  const [feedbackMap, setFeedbackMap] = useState<Record<number, "good" | "bad">>(
    {}
  );
  const [reasonPickerFor, setReasonPickerFor] = useState<number | null>(null);
  const [reportShop, setReportShop] = useState<
    NonNullable<ChatMessage["recommendedShops"]>[number] | null
  >(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAiUserMessageRef = useRef("");
  const t = i18n[lang].chat;
  const tokens = user?.tokens ?? 0;
  const isFree = user?.plan === "free";

  let lsPhone = "";
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("bababang-user");
      if (raw) {
        lsPhone = String(
          (JSON.parse(raw) as { phone?: string }).phone ?? ""
        );
      }
    } catch {
      /* ignore */
    }
  }
  const effectivePhone = String(user?.phone || lsPhone || "");
  const digitsOnly = (p: string) => p.replace(/\D/g, "");
  const phoneMatchesMaster =
    Boolean(effectivePhone) &&
    MASTER_PHONES.some(
      (m) =>
        effectivePhone === m ||
        digitsOnly(effectivePhone) === digitsOnly(m) ||
        digitsOnly(effectivePhone).endsWith(digitsOnly(m))
    );
  const isMaster = Boolean(
    user &&
      (phoneMatchesMaster ||
        (currentUserId != null &&
          MASTER_IDS.includes(String(currentUserId))))
  );
  if (typeof window !== "undefined") {
    console.log(
      "=== 마스터 체크: phone=" +
        (user?.phone ?? "") +
        ", isMaster=" +
        isMaster +
        " ==="
    );
  }

  const atDailyLimit =
    isFree && !isMaster && readAiQuotaAfterReset() >= FREE_AI_DAILY_LIMIT;

  const toastThanksGood =
    lang === "zh" ? "谢谢！我们会努力回答得更好 🙂" : "감사합니다! 더 좋은 답변 드릴게요 😊";
  const toastBadPrompt =
    lang === "zh" ? "抱歉。哪一点不太满意？" : "죄송해요. 어떤 점이 아쉬웠나요?";
  const toastFeedbackOk =
    lang === "zh" ? "我们会参考您的意见！" : "의견 반영할게요!";
  const toastReportThanks =
    lang === "zh" ? "感谢举报！我们会尽快处理。" : "신고해주셔서 감사합니다! 확인 후 반영할게요.";

  useEffect(() => {
    if (chatOpen) setQuotaVersion((v) => v + 1);
  }, [chatOpen]);

  useEffect(() => {
    if (!chatOpen) return;
    const last = useStore.getState().lastChatTime;
    if (last != null && Date.now() - last > 30 * 60 * 1000) {
      useStore.getState().clearChatMessages();
    }
  }, [chatOpen]);

  const freeAiRemaining = useMemo(() => {
    const used = readAiQuotaAfterReset();
    return Math.max(0, FREE_AI_DAILY_LIMIT - used);
  }, [quotaVersion, chatOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatMessages, isStreaming]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const popularQuestions: Array<{
    emoji: string;
    text: string;
    action?: "camera" | "voice";
  }> = [
    { emoji: "🍜", text: "칭다오 맛집 추천해줘" },
    { emoji: "📋", text: "비자 연장 어떻게 해?" },
    { emoji: "🏥", text: "한국어 되는 병원 알려줘" },
    { emoji: "🏠", text: "집 구하려면 어떻게 해?" },
    { emoji: "💰", text: "오늘 환율 알려줘" },
    { emoji: "🌤️", text: "오늘 날씨 어때?" },
    { emoji: "📸", text: "사진 번역해줘", action: "camera" },
    { emoji: "🎙️", text: "음성번역 시작", action: "voice" },
    { emoji: "🤖", text: "은행 계좌 개설 방법 알려줘" },
    { emoji: "📱", text: "중국 유심 개통 방법" },
  ];

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceRecognitionRef = useRef<{ stop: () => void } | null>(null);
  const [voiceTranslateMode, setVoiceTranslateMode] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"ko" | "zh">("ko");
  const [voiceResult, setVoiceResult] = useState({
    original: "",
    corrected: "",
    translated: "",
    isInterim: false,
  });
  const [isVoiceTranslateListening, setIsVoiceTranslateListening] = useState(false);
  const [voiceMicPhase, setVoiceMicPhase] = useState<
    "idle" | "listening" | "translating" | "done"
  >("idle");
  const [voiceHistory, setVoiceHistory] = useState<
    Array<{ original: string; translated: string; lang: "ko" | "zh" }>
  >([]);
  const voiceCombinedRef = useRef("");
  const voicePendingStopRef = useRef(false);

  useEffect(() => {
    if (!voiceTranslateMode) {
      window.speechSynthesis.cancel();
      try {
        voiceRecognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      voiceRecognitionRef.current = null;
      setIsVoiceTranslateListening(false);
      setVoiceMicPhase("idle");
    }
  }, [voiceTranslateMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const warm = () => {
      window.speechSynthesis.getVoices();
    };
    warm();
    window.speechSynthesis.addEventListener("voiceschanged", warm);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", warm);
  }, []);

  const reportInaccurate = async () => {
    const kw = lastAiUserMessageRef.current.trim();
    if (!kw) return;
    try {
      await fetch("/api/admin/cache", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reviews",
          searchKeyword: kw,
          action: "report",
        }),
      });
      setToast(
        lang === "zh" ? "已反馈，我们将优化缓存。" : "반영했어요. 캐시를 조정할게요."
      );
    } catch {
      setToast(lang === "zh" ? "提交失败" : "전송에 실패했어요.");
    }
  };

  const handleImageUpload = (file: File) => {
    if (!requireLogin()) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      void (async () => {
        addChatMessage({ role: "user", text: "📸 사진 번역 요청", image: dataUrl });
        addChatMessage({ role: "ai", text: "🔍 사진을 분석하고 번역중..." });
        try {
          const res = await fetch("/api/translate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl, mode: "translate" }),
          });
          const data = (await res.json()) as { translation?: string; error?: string };
          updateLastAiMessage(
            data.translation || data.error || "번역에 실패했어요."
          );
        } catch {
          updateLastAiMessage("번역에 실패했어요. 다시 시도해주세요.");
        }
      })();
    };
    reader.readAsDataURL(file);
  };

  const speakText = (text: string, lang: "ko" | "zh") => {
    if (!text.trim() || typeof window === "undefined") return;
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "ko" ? "ko-KR" : "zh-CN";
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((v) => {
      if (lang === "zh") {
        return (
          v.lang.includes("zh") &&
          (v.name.includes("Ting") || v.name.includes("Google") || v.name.includes("Microsoft"))
        );
      }
      return (
        v.lang.includes("ko") &&
        (v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Yuna"))
      );
    });
    if (preferredVoice) utterance.voice = preferredVoice;
    window.speechSynthesis.speak(utterance);
  };

  const translateVoiceText = async (transcript: string) => {
    const trimmed = transcript.trim();
    if (!trimmed) {
      setVoiceMicPhase("idle");
      return;
    }
    setVoiceMicPhase("translating");
    setIsVoiceTranslateListening(false);
    try {
      const targetLang = voiceLang === "ko" ? "중국어" : "한국어";
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          targetLang,
          mixedMode: true,
        }),
      });
      const data = (await res.json()) as {
        translation?: string;
        corrected?: string;
        wasChanged?: boolean;
      };
      const translated = data.translation ?? "";
      const correctedRaw = typeof data.corrected === "string" ? data.corrected.trim() : "";
      const showCorrected =
        Boolean(data.wasChanged) && correctedRaw.length > 0 && correctedRaw !== trimmed;
      setVoiceResult({
        original: trimmed,
        corrected: showCorrected ? correctedRaw : "",
        translated,
        isInterim: false,
      });
      setVoiceHistory((prev) => [
        ...prev,
        { original: trimmed, translated, lang: voiceLang },
      ]);
      setVoiceMicPhase("done");
      speakText(translated, voiceLang === "ko" ? "zh" : "ko");
    } catch {
      setVoiceResult((prev) => ({
        ...prev,
        original: trimmed,
        corrected: "",
        translated: "번역 실패",
        isInterim: false,
      }));
      setVoiceMicPhase("idle");
    }
    voiceCombinedRef.current = "";
  };

  const startVoiceTranslate = () => {
    if (isVoiceTranslateListening && voiceRecognitionRef.current) {
      voicePendingStopRef.current = true;
      try {
        voiceRecognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        maxAlternatives: number;
        start: () => void;
        stop: () => void;
        onresult:
          | ((e: {
              results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
            }) => void)
          | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        maxAlternatives: number;
        start: () => void;
        stop: () => void;
        onresult:
          | ((e: {
              results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
            }) => void)
          | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
      };
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      alert(
        lang === "zh"
          ? "当前浏览器不支持语音识别"
          : "이 브라우저에서 음성인식을 지원하지 않아요."
      );
      return;
    }
    voicePendingStopRef.current = false;
    voiceCombinedRef.current = "";
    const recognition = new SR();
    recognition.lang = voiceLang === "ko" ? "ko-KR" : "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    voiceRecognitionRef.current = recognition;
    setIsVoiceTranslateListening(true);
    setVoiceMicPhase("listening");
    recognition.start();

    recognition.onresult = (event: {
      results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
    }) => {
      let allFinal = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) allFinal += t;
        else interim += t;
      }
      const combined = (allFinal + interim).trim();
      voiceCombinedRef.current = combined;
      setVoiceResult({
        original: combined || voiceCombinedRef.current,
        corrected: "",
        translated: "",
        isInterim: interim.length > 0 && !allFinal,
      });
    };
    recognition.onerror = () => {
      setIsVoiceTranslateListening(false);
      voiceRecognitionRef.current = null;
      setVoiceMicPhase("idle");
    };
    recognition.onend = () => {
      setIsVoiceTranslateListening(false);
      voiceRecognitionRef.current = null;
      if (voicePendingStopRef.current) {
        voicePendingStopRef.current = false;
        void translateVoiceText(voiceCombinedRef.current);
        return;
      }
      const t = voiceCombinedRef.current.trim();
      if (t) void translateVoiceText(t);
      else setVoiceMicPhase("idle");
    };
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!requireLogin()) return;

    const master = isMaster;
    const now = Date.now();
    const firstTime = parseInt(
      localStorage.getItem("bababang-ai-first-time") || "0",
      10
    );
    let todayCount = parseInt(
      localStorage.getItem("bababang-ai-count") || "0",
      10
    );
    if (firstTime > 0 && now - firstTime > 24 * 60 * 60 * 1000) {
      todayCount = 0;
      localStorage.setItem("bababang-ai-count", "0");
      localStorage.setItem("bababang-ai-first-time", "0");
    }

    if (!master && todayCount >= FREE_AI_DAILY_LIMIT) {
      addChatMessage({
        role: "ai",
        text:
          FREE_QUOTA_MSG_PREFIX +
          (lang === "zh" ? FREE_QUOTA_EXCEEDED_ZH : FREE_QUOTA_EXCEEDED_KO),
      });
      return;
    }

    if (!master && user && user.tokens <= 0) {
      addChatMessage({ role: "ai", text: t.noTokens });
      return;
    }
    touchChatActivity();
    setStatusMessage("");
    lastAiUserMessageRef.current = trimmed;
    void trackActivity("ask_ai", undefined, trimmed);
    addChatMessage({ role: "user", text: trimmed });
    addChatMessage({ role: "ai", text: "" });
    setInput("");
    if (chatTextareaRef.current) {
      chatTextareaRef.current.style.height = "auto";
    }
    setIsStreaming(true);
    setStreamReplyStarted(false);

    const messagesForApi = [...chatMessages, { role: "user" as const, text: trimmed }]
      .slice(-10)
      .map((m) => ({
        role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
        content: m.text,
      }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesForApi,
          userId: currentUserId ?? 1,
          userLocation: useStore.getState().userLocation ?? null,
          cacheMaxAgeDays: getCacheMaxAgeDays(),
          localShops:
            typeof window !== "undefined"
              ? ((JSON.parse(
                  window.localStorage.getItem("bababang-admin-shops") ?? "[]"
                ) as ShopEntry[]) || [])
              : [],
        }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { content?: string };
        updateLastAiMessage(errData.content ?? t.errorTryAgain);
        return;
      }

      if (!res.body) {
        updateLastAiMessage("응답을 받지 못했어요. 다시 시도해주세요~");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let completed = false;
      let replyStarted = false;

      const parseSseLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) return;
        const dataStr = trimmed.slice(5).trim();
        try {
          const data = JSON.parse(dataStr) as {
            type?: string;
            content?: string;
            meta?: { totalSources?: number };
            recommendedShops?: ChatMessage["recommendedShops"];
          };
          if (data.type === "status" && typeof data.content === "string") {
            setStatusMessage(data.content);
          } else if (data.type === "content" && typeof data.content === "string") {
            if (!replyStarted) {
              replyStarted = true;
              setStreamReplyStarted(true);
              setStatusMessage("");
            }
            fullText += data.content;
            updateLastAiMessage(fullText);
          } else if (data.type === "done") {
            completed = true;
            const finalText =
              typeof data.content === "string" ? cleanResponse(data.content) : cleanResponse(fullText);
            const shopsFromServer = data.recommendedShops ?? [];
            updateLastAiMessage(finalText, { recommendedShops: shopsFromServer });
            const cat = detectAdCategory(lastAiUserMessageRef.current);
            if (cat) {
              void (async () => {
                try {
                  const res = await fetch(
                    "/api/ads?category=" + encodeURIComponent(cat)
                  );
                  const j = (await res.json()) as { ads?: AdApiRow[] };
                  const ads = Array.isArray(j.ads) ? j.ads : [];
                  const adCards = ads.map((ad) => adRowToRecommendedShop(ad));
                  updateLastAiMessage(finalText, {
                    recommendedShops: [...adCards, ...shopsFromServer],
                  });
                } catch {
                  /* keep server shops */
                }
              })();
            }
            if (!master) {
              bumpAiQuotaOnSuccess();
            }
            setQuotaVersion((v) => v + 1);
            incrementQuestion();
            incrementQuestionCount();
            if (!master) {
              void (async () => {
                try {
                  const r = await fetch("/api/tokens", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: currentUserId ?? 1,
                      amount: 1,
                      type: "spend",
                      reason: "AI질문",
                    }),
                  });
                  const d = (await r.json()) as {
                    success?: boolean;
                    tokens?: number;
                  };
                  if (d.success && typeof d.tokens === "number") {
                    const u = useStore.getState().user;
                    if (u) setUser({ ...u, tokens: d.tokens });
                  } else {
                    deductToken();
                  }
                } catch {
                  deductToken();
                }
              })();
            }
          } else if (data.type === "error" && typeof data.content === "string") {
            updateLastAiMessage(data.content);
          }
        } catch {
          /* ignore */
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          parseSseLine(line);
        }
        if (done) break;
      }
      if (buffer.trim()) {
        parseSseLine(buffer);
      }

      if (!completed && fullText) {
        updateLastAiMessage(cleanResponse(fullText));
      }
    } catch {
      updateLastAiMessage("네트워크가 불안정해요. 다시 시도해주세요~");
    } finally {
      setIsStreaming(false);
      setStreamReplyStarted(false);
      setStatusMessage("");
    }
  };

  sendMessageRef.current = sendMessage;

  useEffect(() => {
    if (!chatOpen || !chatPendingPrompt) return;
    const t = chatPendingPrompt;
    setChatPendingPrompt(null);
    void sendMessageRef.current(t);
  }, [chatOpen, chatPendingPrompt, setChatPendingPrompt]);

  return (
    <AnimatePresence>
      {chatOpen && (
        <>
          <style>{`
            @keyframes blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
            .typing-cursor {
              display: inline;
              animation: blink 0.8s infinite;
              color: var(--accent-light, #a78bfa);
            }
          `}</style>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0"
            style={{
              zIndex: 998,
              background: "rgba(0,0,0,0.5)",
            }}
            onClick={() => setChatOpen(false)}
            aria-hidden
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="chat-container fixed top-0 right-0 bottom-0 flex min-h-0 flex-col border-l border-white/10 bg-[#0a0a0f] shadow-glass-dark"
            style={{
              width: "80%",
              maxWidth: "344px",
              zIndex: 999,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-1.5 px-2 py-3 border-b border-white/10 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
              <motion.button
                type="button"
                onClick={() => setChatOpen(false)}
                className="p-2 rounded-full hover:bg-white/10 shrink-0"
                whileTap={{ scale: 0.9 }}
                aria-label={lang === "zh" ? "关闭" : "닫기"}
              >
                <X className="w-6 h-6 text-white" strokeWidth={2} />
              </motion.button>
              <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                <p className="font-outfit font-semibold text-white text-sm sm:text-base truncate w-full text-center">
                  {t.aiName}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-white/90 min-w-[3.5rem]">
                <span className="text-white/50">{t.tokensLabel}</span>{" "}
                <span className="font-semibold text-white">{tokens}</span>
              </div>
            </div>

            {toast ? (
              <div className="shrink-0 px-3 pt-1">
                <div
                  className="w-full text-center text-white"
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    background: "var(--bg-dark-card)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  {toast}
                </div>
              </div>
            ) : null}

            {statusMessage && isStreaming && !streamReplyStarted ? (
              <div
                className="shrink-0 px-4 py-2 flex items-center gap-2 text-left border-b border-white/5"
                style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}
              >
                <span className="inline-block animate-spin mr-2 select-none" aria-hidden>
                  ⏳
                </span>
                <span className="min-w-0 flex-1 leading-snug">{statusMessage}</span>
              </div>
            ) : null}

            {/* 메시지 영역: AI 왼쪽 하단 각짐, 유저 오른쪽 하단 각짐, 새 메시지 scale */}
            <div
              ref={scrollRef}
              className="chat-messages min-h-0 flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin"
            >
              <AnimatePresence>
                {chatMessages.map((msg, i) => {
                  const isLastAi =
                    msg.role === "ai" && i === chatMessages.length - 1;
                  if (
                    isLastAi &&
                    isStreaming &&
                    !streamReplyStarted &&
                    msg.text.length === 0
                  ) {
                    return null;
                  }
                  const isFreeQuotaCta =
                    msg.role === "ai" &&
                    msg.text.startsWith(FREE_QUOTA_MSG_PREFIX);
                  const aiDisplayText = isFreeQuotaCta
                    ? msg.text.slice(FREE_QUOTA_MSG_PREFIX.length)
                    : msg.text;
                  const isStatusPhase = false;
                  return (
                  <motion.div
                    key={`msg-${i}`}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 28,
                    }}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "ai" ? (
                      <div className="max-w-[85%]">
                        <div
                          className={`rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-[4px] bg-white/10 backdrop-blur-card px-4 py-3 text-sm ${
                            isStatusPhase ? "italic text-white/50" : "text-white/95 flex flex-col gap-1.5"
                          }`}
                        >
                          <AiMessageContent
                            text={aiDisplayText}
                            isStatusPhase={isStatusPhase}
                            onChipTap={(line) => void sendMessage(line)}
                            messageKey={`ai-${i}`}
                          />
                          {isFreeQuotaCta ? (
                            <motion.button
                              type="button"
                              onClick={() => setMembershipOpen(true)}
                              className="mt-3 w-full text-center font-medium text-white"
                              style={{
                                padding: 12,
                                borderRadius: 12,
                                background:
                                  "linear-gradient(135deg, #6c5ce7 0%, #8b5cf6 100%)",
                              }}
                              whileTap={{ scale: 0.98 }}
                            >
                              {lang === "zh" ? "升级高级版 →" : "프리미엄 업그레이드 →"}
                            </motion.button>
                          ) : null}
                          {isLastAi && isStreaming && (
                            <span className="typing-cursor">▊</span>
                          )}
                        </div>
                        {msg.recommendedShops &&
                          !isFreeQuotaCta &&
                          msg.recommendedShops.length > 0 &&
                          /맛집|장소|추천|가게|식당|카페|주소|업체|칭다오|청도|美食|餐厅|烧烤|火锅|咖啡|데려|안내|소개|찾아|위치|怎么走|怎么去/i.test(
                            msg.text
                          ) && (
                            <p className="mt-1.5 text-[11px] text-white/45 italic">
                              📍 위 장소로 길찾기나 택시가 필요하면 추천 카드를 탭해보세요
                            </p>
                          )}
                        {!isFreeQuotaCta ? (
                        <div className="mt-1.5 flex items-center gap-2 text-white/50">
                          <button
                            type="button"
                            onClick={() => {
                              setFeedbackMap((s) => ({ ...s, [i]: "good" }));
                              setReasonPickerFor(null);
                              addFeedback({
                                messageIndex: i,
                                feedback: "good",
                                timestamp: new Date(),
                              });
                              const userMsg =
                                i > 0 && chatMessages[i - 1]?.role === "user"
                                  ? chatMessages[i - 1].text
                                  : "";
                              const aiMsg = chatMessages[i]?.text ?? "";
                              void persistFeedbackToDb({
                                userId: currentUserId ?? 1,
                                userMessage: userMsg,
                                aiResponse: aiMsg,
                                feedback: "good",
                              });
                              setToast(toastThanksGood);
                            }}
                            className={`p-1 rounded ${
                              feedbackMap[i] === "good" ? "text-accent" : ""
                            }`}
                          >
                            <ThumbsUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFeedbackMap((s) => ({ ...s, [i]: "bad" }));
                              setReasonPickerFor(i);
                              setToast(toastBadPrompt);
                            }}
                            className={`p-1 rounded ${
                              feedbackMap[i] === "bad" ? "text-accent" : ""
                            }`}
                          >
                            <ThumbsDown className="w-4 h-4" />
                          </button>
                        </div>
                        ) : null}
                        {!isFreeQuotaCta &&
                          msg.text.trim() &&
                          !(i === chatMessages.length - 1 && isStreaming) && (
                            <button
                              type="button"
                              onClick={() => void reportInaccurate()}
                              style={{
                                fontSize: 11,
                                color: "rgba(255,255,255,0.3)",
                                padding: "4px 8px",
                                marginTop: 4,
                              }}
                            >
                              ⚠️ 정보가 틀려요
                            </button>
                          )}
                        {reasonPickerFor === i && !isFreeQuotaCta && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {(lang === "zh" ? feedbackReasonsZh : feedbackReasonsKo).map(
                              (reason) => (
                                <button
                                  key={reason}
                                  type="button"
                                  onClick={() => {
                                    addFeedback({
                                      messageIndex: i,
                                      feedback: "bad",
                                      reason,
                                      timestamp: new Date(),
                                    });
                                    const userMsg =
                                      i > 0 && chatMessages[i - 1]?.role === "user"
                                        ? chatMessages[i - 1].text
                                        : "";
                                    const aiMsg = chatMessages[i]?.text ?? "";
                                    void persistFeedbackToDb({
                                      userId: currentUserId ?? 1,
                                      userMessage: userMsg,
                                      aiResponse: aiMsg,
                                      feedback: "bad",
                                      feedbackReason: reason,
                                    });
                                    setReasonPickerFor(null);
                                    setToast(toastFeedbackOk);
                                  }}
                                  className="px-2 py-1 rounded-full text-[10px] bg-white/10 text-white/80"
                                >
                                  {reason}
                                </button>
                              )
                            )}
                          </div>
                        )}
                        {msg.recommendedShops &&
                          !isFreeQuotaCta &&
                          msg.recommendedShops.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-2 rounded-2xl bg-white/5 border border-white/10 p-2"
                          >
                            <p className="text-[11px] text-white/50 px-1 mb-2">📍 추천 업체</p>
                            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                              {msg.recommendedShops.map((shop, si) => {
                                const displayKo = shop.koreanName?.trim();
                                const displayZh = shop.name?.trim();
                                const mainTitle = displayKo || displayZh || "";
                                const showZhSub =
                                  Boolean(displayKo && displayZh && displayKo !== displayZh);
                                const mapLabel = displayKo || displayZh || "";
                                const hasRatingOrCost = Boolean(shop.rating || shop.cost);
                                const hasAddress = Boolean(shop.address?.trim());
                                const hasTime = Boolean(shop.openTime && String(shop.openTime).trim());
                                const hasAnyDetail = hasRatingOrCost || hasAddress || hasTime;
                                return (
                                <div
                                  key={`${shop.name}-${si}`}
                                  className={`group relative w-[240px] min-w-[240px] flex-shrink-0 glass-dark rounded-[14px] p-[14px] border ${
                                    shop.isAd
                                      ? "border-[rgba(108,92,231,0.3)]"
                                      : "border-white/10"
                                  }`}
                                  onContextMenu={(e) => {
                                    if (shop.isAd) return;
                                    e.preventDefault();
                                    setReportShop(shop);
                                  }}
                                >
                                  {shop.isAd ? (
                                    <span
                                      className="absolute top-[8px] right-[10px] z-20 font-semibold text-white leading-none"
                                      style={{
                                        fontSize: 8,
                                        padding: "2px 4px",
                                        borderRadius: 4,
                                        background: "#6c5ce7",
                                      }}
                                    >
                                      AD
                                    </span>
                                  ) : (
                                  <button
                                    type="button"
                                    className="absolute top-[10px] right-[10px] z-10 text-[8px] leading-none p-0.5 rounded opacity-[0.08] hover:opacity-100 hover:bg-white/5 active:opacity-100 focus:opacity-100 focus:outline-none transition-opacity"
                                    aria-label="장소 신고"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setReportShop(shop);
                                    }}
                                  >
                                    ⚠️
                                  </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      sendMessage(`${mapLabel} 자세히 알려줘`)
                                    }
                                    className="w-full text-left pr-5"
                                  >
                                    <p className="text-[15px] font-bold text-white leading-snug">
                                      {mainTitle}
                                    </p>
                                    {showZhSub ? (
                                      <p className="text-[12px] text-white/45 mt-0.5 line-clamp-2">
                                        {displayZh}
                                      </p>
                                    ) : null}
                                    {hasAnyDetail ? (
                                      <>
                                        {hasRatingOrCost ? (
                                          <p
                                            className="text-[12px] mt-2"
                                            style={{ color: "var(--gold)" }}
                                          >
                                            {shop.rating ? `⭐ ${shop.rating}` : ""}
                                            {shop.rating && shop.cost ? " · " : ""}
                                            {shop.cost ? `인당 ${shop.cost}위안` : ""}
                                          </p>
                                        ) : null}
                                        {hasAddress ? (
                                          <p className="text-[11px] text-white/45 mt-1.5 line-clamp-1">
                                            📍 {shop.address}
                                          </p>
                                        ) : null}
                                        {hasTime ? (
                                          <p className="text-[11px] text-white/45 mt-1">
                                            🕐 {shop.openTime}
                                          </p>
                                        ) : null}
                                      </>
                                    ) : (
                                      <p className="text-[11px] text-white/35 mt-2">
                                        상세 정보를 확인해보세요
                                      </p>
                                    )}
                                  </button>
                                  {(() => {
                                    const linkZhName =
                                      (displayZh && displayZh.trim()) ||
                                      String(shop.name || "").trim() ||
                                      mapLabel;
                                    if (!linkZhName) return null;
                                    const lat = shop.lat ? String(shop.lat) : "";
                                    const lng = shop.lng ? String(shop.lng) : "";
                                    return (
                                      <div className="mt-3 flex gap-2">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openMapActionSheet(
                                              lat,
                                              lng,
                                              linkZhName,
                                              shop.address || "",
                                              displayKo || ""
                                            );
                                          }}
                                          className="flex-1 rounded-full border border-white/15 bg-white/5 px-2 py-1.5 text-[10px] leading-tight text-white/90"
                                          style={{
                                            borderColor: "var(--accent)",
                                            color: "var(--accent)",
                                          }}
                                        >
                                          길찾기
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openDidi(lat, lng, linkZhName);
                                          }}
                                          className="flex-1 rounded-full border border-white/15 bg-white/5 px-2 py-1.5 text-[10px] leading-tight"
                                          style={{
                                            borderColor: "var(--gold)",
                                            color: "var(--gold)",
                                          }}
                                        >
                                          택시
                                        </button>
                                      </div>
                                    );
                                  })()}
                                </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    ) : (
                      <div
                        className="max-w-[85%] rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-[4px] px-4 py-3 text-sm text-white flex flex-col gap-2"
                        style={{
                          background:
                            "linear-gradient(135deg, #6c5ce7 0%, #8b7cf7 100%)",
                        }}
                      >
                        {msg.image ? (
                          <img
                            src={msg.image}
                            alt=""
                            className="object-contain"
                            style={{
                              maxWidth: 200,
                              borderRadius: 12,
                            }}
                          />
                        ) : null}
                        <span className="whitespace-pre-wrap break-words">{msg.text}</span>
                      </div>
                    )}
                  </motion.div>
                  );
                })}
              </AnimatePresence>

              {chatMessages.length === 0 && (
                <div className="mt-2">
                  <p className="text-xs text-white/60 mb-2">
                    {lang === "zh" ? "热门提问" : "인기 질문"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {popularQuestions.map((item) => (
                      <button
                        key={item.text}
                        type="button"
                        onClick={() => {
                          if (item.action === "camera") {
                            cameraInputRef.current?.click();
                            return;
                          }
                          if (item.action === "voice") {
                            setVoiceTranslateMode(true);
                            return;
                          }
                          void sendMessage(item.text);
                        }}
                        className="text-left rounded-xl bg-white/10 px-3 py-2 text-xs text-white/90"
                      >
                        <span className="mr-1">{item.emoji}</span>
                        {item.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 퀵액션 가로 스크롤 */}
            <div className="shrink-0 px-4 py-2 overflow-x-auto flex gap-2 scrollbar-thin border-t border-white/5">
              {quickPrompts.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => sendMessage(i18n[lang].chat[key])}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-xs hover:bg-white/20 active:scale-[0.98]"
                >
                  {t[key]}
                </button>
              ))}
            </div>

            {/* 일일 한도 도달 시 업그레이드 안내 */}
            {atDailyLimit && (
              <div className="shrink-0 px-4 py-2 border-t border-white/5 flex justify-center">
                <motion.button
                  type="button"
                  onClick={() => setMembershipOpen(true)}
                  className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium"
                  whileTap={{ scale: 0.98 }}
                >
                  {t.upgrade}
                </motion.button>
              </div>
            )}

            <p
              className={`shrink-0 px-4 pt-2 text-right text-[13px] ${
                !isMaster && freeAiRemaining <= 0
                  ? "text-red-400"
                  : !isMaster && freeAiRemaining <= 3
                    ? "text-[#feca57]"
                    : "text-white/45"
              }`}
            >
              {isMaster ? (
                <span style={{ color: "#a78bfa" }}>⚡ 관리자 무제한</span>
              ) : freeAiRemaining <= 0 ? (
                lang === "zh" ? (
                  "免费提问次数已用完"
                ) : (
                  "무료 질문을 모두 사용했어요"
                )
              ) : lang === "zh" ? (
                `今日剩余免费提问: ${freeAiRemaining}/${FREE_AI_DAILY_LIMIT}`
              ) : (
                `오늘 남은 무료 질문: ${freeAiRemaining}/${FREE_AI_DAILY_LIMIT}`
              )}
            </p>
            {/* 입력창 + 전송 (sticky 하단 + safe-area) */}
            <div
              className="chat-input-area border-t border-white/10 flex w-full min-w-0 overflow-hidden items-end"
              style={{
                display: "flex",
                gap: 8,
                padding: "8px 12px",
                width: "100%",
              }}
            >
              <label
                className="shrink-0 cursor-pointer p-2 rounded-xl hover:bg-white/10 flex items-center justify-center"
                style={{ padding: 8 }}
                title={lang === "zh" ? "拍照翻译" : "사진 번역"}
              >
                <span className="text-xl leading-none select-none" aria-hidden>
                  📷
                </span>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <motion.button
                type="button"
                onClick={() => setVoiceTranslateMode(true)}
                className="shrink-0 rounded-xl p-2 flex items-center justify-center text-xl leading-none"
                style={{ background: "rgba(255,255,255,0.08)" }}
                whileTap={{ scale: 0.95 }}
                title={lang === "zh" ? "语音翻译" : "음성번역"}
                aria-label={lang === "zh" ? "语音翻译" : "음성번역"}
              >
                🎙️
              </motion.button>
              <textarea
                ref={chatTextareaRef}
                value={input}
                rows={1}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage(input);
                  }
                }}
                placeholder={t.placeholder}
                className="min-w-0 flex-1 bg-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-accent/50"
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 16,
                  resize: "none",
                  overflow: "hidden",
                  lineHeight: 1.4,
                  maxHeight: 120,
                  fontFamily: "inherit",
                }}
              />
              <motion.button
                type="button"
                onClick={() => sendMessage(input)}
                className="flex shrink-0 items-center justify-center rounded-xl bg-accent text-white"
                style={{ width: 40, height: 40, flexShrink: 0 }}
                whileTap={{ scale: 0.95 }}
              >
                <Send className="w-5 h-5" />
              </motion.button>
            </div>

            {voiceTranslateMode ? (
              <div
                className="absolute inset-0 z-[100] flex min-h-0 flex-col bg-[#0a0a0f]"
                style={{ top: 0, right: 0, bottom: 0, left: 0 }}
              >
                <div
                  className="shrink-0 py-3 text-center font-bold text-white"
                  style={{ fontSize: 16 }}
                >
                  🎙️ 음성번역
                </div>

                <div className="shrink-0 space-y-3 px-4 pb-3">
                  <div
                    className="min-h-[4.5rem] rounded-2xl p-4"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    <div
                      className="mb-2 text-[11px]"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      {voiceLang === "ko" ? "🇰🇷 원문" : "🇨🇳 原文"}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: voiceResult.isInterim
                          ? "rgba(255,255,255,0.35)"
                          : "rgba(255,255,255,0.9)",
                        fontWeight: 400,
                      }}
                    >
                      {voiceResult.original || "마이크를 누르고 말해보세요"}
                    </div>
                    {voiceResult.corrected &&
                    voiceResult.corrected !== voiceResult.original &&
                    !voiceResult.isInterim ? (
                      <div className="mt-2 flex flex-col gap-1">
                        <span
                          className="inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px]"
                          style={{
                            background: "rgba(108,92,231,0.35)",
                            color: "#e9d5ff",
                          }}
                        >
                          ✨ 교정
                        </span>
                        <span style={{ fontSize: 15, color: "white", fontWeight: 600 }}>
                          {voiceResult.corrected}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 12,
                      padding: "12px 0",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setVoiceLang("ko")}
                      style={{
                        padding: "12px 24px",
                        borderRadius: 12,
                        background:
                          voiceLang === "ko"
                            ? "rgba(108,92,231,0.3)"
                            : "rgba(255,255,255,0.05)",
                        border:
                          voiceLang === "ko"
                            ? "2px solid #6c5ce7"
                            : "1px solid rgba(255,255,255,0.1)",
                        color:
                          voiceLang === "ko" ? "#a78bfa" : "rgba(255,255,255,0.4)",
                        fontWeight: voiceLang === "ko" ? 700 : 400,
                        fontSize: 15,
                      }}
                    >
                      🇰🇷 한국어
                    </button>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 20 }}>→</span>
                    <button
                      type="button"
                      onClick={() => setVoiceLang("zh")}
                      style={{
                        padding: "12px 24px",
                        borderRadius: 12,
                        background:
                          voiceLang === "zh"
                            ? "rgba(239,68,68,0.2)"
                            : "rgba(255,255,255,0.05)",
                        border:
                          voiceLang === "zh"
                            ? "2px solid #ef4444"
                            : "1px solid rgba(255,255,255,0.1)",
                        color:
                          voiceLang === "zh" ? "#f87171" : "rgba(255,255,255,0.4)",
                        fontWeight: voiceLang === "zh" ? 700 : 400,
                        fontSize: 15,
                      }}
                    >
                      🇨🇳 中文
                    </button>
                  </div>

                  <div
                    className="min-h-[4.5rem] rounded-2xl border p-4"
                    style={{
                      background: "rgba(108,92,231,0.1)",
                      borderColor: "rgba(108,92,231,0.2)",
                    }}
                  >
                    <div
                      className="mb-2 text-[11px]"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      {voiceLang === "ko" ? "🇨🇳 번역" : "🇰🇷 번역"}
                    </div>
                    {voiceMicPhase === "translating" ? (
                      <div
                        className="flex items-center gap-2 text-lg"
                        style={{ color: "#a78bfa" }}
                      >
                        <span className="inline-block animate-spin text-white/60">⏳</span>
                        <span>...</span>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 18,
                            color: "#a78bfa",
                            flex: 1,
                            wordBreak: "break-word",
                          }}
                        >
                          {voiceResult.translated || "번역 결과가 여기에 표시돼요"}
                        </span>
                        {voiceResult.translated ? (
                          <button
                            type="button"
                            onClick={() =>
                              speakText(
                                voiceResult.translated,
                                voiceLang === "ko" ? "zh" : "ko"
                              )
                            }
                            style={{
                              background: "rgba(108,92,231,0.2)",
                              border: "1px solid rgba(108,92,231,0.3)",
                              borderRadius: "50%",
                              width: 36,
                              height: 36,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                            aria-label={lang === "zh" ? "朗读" : "듣기"}
                          >
                            🔊
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
                  <div className="text-[11px] text-white/40 mb-1">대화 기록</div>
                  {voiceHistory.length === 0 ? (
                    <p className="text-sm text-white/35">아직 기록이 없어요</p>
                  ) : (
                    <div className="space-y-3">
                      {voiceHistory.map((item, hi) => (
                        <div
                          key={hi}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: item.lang === "ko" ? "flex-start" : "flex-end",
                            padding: "4px 0",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              color: "rgba(255,255,255,0.4)",
                              marginBottom: 2,
                            }}
                          >
                            {item.lang === "ko" ? "🇰🇷 한국어" : "🇨🇳 中文"}
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              color: "white",
                              background:
                                item.lang === "ko"
                                  ? "rgba(108,92,231,0.2)"
                                  : "rgba(255,255,255,0.1)",
                              padding: "8px 12px",
                              borderRadius: 12,
                              maxWidth: "85%",
                            }}
                          >
                            {item.original}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "4px 12px",
                              maxWidth: "100%",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 14,
                                color: "#a78bfa",
                                flex: 1,
                                wordBreak: "break-word",
                              }}
                            >
                              → {item.translated}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                speakText(
                                  item.translated,
                                  item.lang === "ko" ? "zh" : "ko"
                                )
                              }
                              style={{
                                background: "rgba(108,92,231,0.2)",
                                border: "1px solid rgba(108,92,231,0.3)",
                                borderRadius: "50%",
                                width: 36,
                                height: 36,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                              aria-label={lang === "zh" ? "朗读" : "듣기"}
                            >
                              🔊
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className="shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "20px 30px",
                    gap: 20,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        voiceRecognitionRef.current?.stop();
                      } catch {
                        /* ignore */
                      }
                      window.speechSynthesis.cancel();
                      setVoiceTranslateMode(false);
                      setIsVoiceTranslateListening(false);
                      setVoiceMicPhase("idle");
                    }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "white",
                      fontSize: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label="닫기"
                  >
                    ✕
                  </button>

                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (voiceMicPhase === "translating") return;
                        void startVoiceTranslate();
                      }}
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: "50%",
                        background: isVoiceTranslateListening
                          ? "rgba(239,68,68,0.8)"
                          : "linear-gradient(135deg, #6c5ce7, #a78bfa)",
                        border: "none",
                        fontSize: 28,
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: voiceMicPhase === "translating" ? 0.65 : 1,
                      }}
                    >
                      {isVoiceTranslateListening ? "⏹️" : "🎤"}
                    </button>
                  </div>

                  <div style={{ width: 48 }} />
                </div>
              </div>
            ) : null}
          </motion.aside>
          <ReportModal
            open={!!reportShop}
            onClose={() => setReportShop(null)}
            shopDisplayName={
              reportShop
                ? `${reportShop.koreanName || reportShop.name}${reportShop.address ? ` · ${reportShop.address}` : ""}`
                : ""
            }
            onSubmitted={(tokenMsg) =>
              setToast(
                tokenMsg ? `${toastReportThanks} ${tokenMsg}` : toastReportThanks
              )
            }
          />
        </>
      )}
    </AnimatePresence>
  );
}
