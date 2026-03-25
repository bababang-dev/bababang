"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MoreHorizontal,
  Settings,
  Volume2,
  VolumeX,
  User,
  Users,
  Columns2,
  Check,
  X,
  ArrowLeftRight,
} from "lucide-react";
import { useStore } from "@/stores/useStore";
import { useModalBodyLock } from "@/lib/useModalBodyLock";

const INTERPRET_STYLE_ID = "interpret-panel-keyframes-v2";

const INTERPRET_CSS = `
@keyframes interpret-pulse {
  0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.45); }
  70% { box-shadow: 0 0 0 20px rgba(239,68,68,0); }
  100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
}
@keyframes interpret-listening-dots {
  0%, 20% { opacity: 0; }
  50% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes interpret-ripple {
  0% { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(2.2); opacity: 0; }
}
@keyframes interpret-purple-glow {
  0%, 100% { box-shadow: inset 0 0 0 2px rgba(108,92,231,0.25); }
  50% { box-shadow: inset 0 0 0 2px rgba(108,92,231,0.55), 0 0 24px rgba(108,92,231,0.2); }
}
.interpret-mic-ripples span {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  border: 2px solid rgba(239,68,68,0.35);
  animation: interpret-ripple 1.5s ease-out infinite;
}
.interpret-mic-ripples span:nth-child(2) { animation-delay: 0.4s; }
.interpret-mic-ripples span:nth-child(3) { animation-delay: 0.8s; }
.interpret-dot-1 { animation: interpret-listening-dots 1.2s infinite; animation-delay: 0s; }
.interpret-dot-2 { animation: interpret-listening-dots 1.2s infinite; animation-delay: 0.2s; }
.interpret-dot-3 { animation: interpret-listening-dots 1.2s infinite; animation-delay: 0.4s; }
`;

export interface InterpretEntry {
  id: string;
  speaker: "me" | "them";
  original: string;
  translated: string;
  fromLang: string;
  toLang: string;
  timestamp: Date;
}

const langCodeMap: Record<string, string> = {
  ko: "ko-KR",
  zh: "zh-CN",
  en: "en-US",
  ja: "ja-JP",
  hi: "hi-IN",
  es: "es-ES",
  ar: "ar-SA",
  fr: "fr-FR",
  id: "id-ID",
  pt: "pt-BR",
  ru: "ru-RU",
  de: "de-DE",
  it: "it-IT",
  th: "th-TH",
  pl: "pl-PL",
  ms: "ms-MY",
  el: "el-GR",
  nl: "nl-NL",
};

const LANG_SHEET: { code: string; flag: string; native: string; english: string }[] = [
  { code: "en", flag: "🇺🇸", native: "English", english: "English" },
  { code: "ja", flag: "🇯🇵", native: "日本語", english: "Japanese" },
  { code: "zh", flag: "🇨🇳", native: "中文", english: "Chinese" },
  { code: "hi", flag: "🇮🇳", native: "हिन्दी", english: "Hindi" },
  { code: "es", flag: "🇪🇸", native: "Español", english: "Spanish" },
  { code: "ar", flag: "🇸🇦", native: "العربية", english: "Arabic" },
  { code: "fr", flag: "🇫🇷", native: "Français", english: "French" },
  { code: "id", flag: "🇮🇩", native: "Bahasa Indonesia", english: "Indonesian" },
  { code: "pt", flag: "🇧🇷", native: "Português", english: "Portuguese" },
  { code: "ru", flag: "🇷🇺", native: "Русский", english: "Russian" },
  { code: "de", flag: "🇩🇪", native: "Deutsch", english: "German" },
  { code: "it", flag: "🇮🇹", native: "Italiano", english: "Italian" },
  { code: "th", flag: "🇹🇭", native: "ไทย", english: "Thai" },
  { code: "pl", flag: "🇵🇱", native: "Polski", english: "Polish" },
  { code: "ms", flag: "🇲🇾", native: "Bahasa Melayu", english: "Malaysian" },
  { code: "el", flag: "🇬🇷", native: "Ελληνικά", english: "Greek" },
  { code: "nl", flag: "🇳🇱", native: "Nederlands", english: "Dutch" },
  { code: "ko", flag: "🇰🇷", native: "한국어", english: "Korean" },
];

function langMeta(code: string) {
  return LANG_SHEET.find((l) => l.code === code) ?? LANG_SHEET[2];
}

function detectLanguage(
  text: string,
  myLang: string,
  theirLang: string,
  currentBcp47: string
): "me" | "them" {
  const t = text.trim();
  if (!t) {
    return currentBcp47 === langCodeMap[myLang] ? "me" : "them";
  }

  const hasKorean = /[가-힣]/.test(t);
  const hasChinese = /[\u4e00-\u9fff]/.test(t);
  const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff]/.test(t);
  const hasArabic = /[\u0600-\u06ff]/.test(t);
  const hasThai = /[\u0e00-\u0e7f]/.test(t);
  const hasHindi = /[\u0900-\u097f]/.test(t);
  const hasCyrillic = /[\u0400-\u04ff]/.test(t);

  const latinLetters = (t.match(/[a-zA-Z]/g) || []).length;
  const latinHeavy = t.length > 2 && latinLetters >= t.length * 0.35;

  if (myLang === "ko" && hasKorean) return "me";
  if (myLang === "zh" && hasChinese) return "me";
  if (myLang === "ja" && hasJapanese) return "me";
  if (myLang === "en" && latinHeavy && !hasKorean && !hasChinese && !hasJapanese) return "me";
  if (myLang === "hi" && hasHindi) return "me";
  if (myLang === "th" && hasThai) return "me";
  if (myLang === "ar" && hasArabic) return "me";
  if (myLang === "ru" && hasCyrillic) return "me";

  if (theirLang === "ko" && hasKorean) return "them";
  if (theirLang === "zh" && hasChinese) return "them";
  if (theirLang === "ja" && hasJapanese) return "them";
  if (theirLang === "en" && latinHeavy && !hasKorean && !hasChinese && !hasJapanese) return "them";
  if (theirLang === "hi" && hasHindi) return "them";
  if (theirLang === "th" && hasThai) return "them";
  if (theirLang === "ar" && hasArabic) return "them";
  if (theirLang === "ru" && hasCyrillic) return "them";

  return currentBcp47 === langCodeMap[myLang] ? "me" : "them";
}

type LayoutMode = "single" | "face" | "side";
type InputMode = "realtime" | "push";
type UiStatus = "idle" | "listening" | "translating" | "speaking";

function ensureStyleInjected() {
  if (typeof document === "undefined") return;
  if (document.getElementById(INTERPRET_STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = INTERPRET_STYLE_ID;
  el.textContent = INTERPRET_CSS;
  document.head.appendChild(el);
}

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

export function InterpreterPanel() {
  const interpreterOpen = useStore((s) => s.interpreterOpen);
  const setInterpreterOpen = useStore((s) => s.setInterpreterOpen);
  const currentUserId = useStore((s) => s.currentUserId);

  useModalBodyLock(interpreterOpen);

  const [phase, setPhase] = useState<"setup" | "live">("setup");
  const [theirLang, setTheirLang] = useState("zh");
  const [myLang, setMyLang] = useState("ko");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("single");
  const [inputMode, setInputMode] = useState<InputMode>("realtime");
  const [history, setHistory] = useState<InterpretEntry[]>([]);
  const [status, setStatus] = useState<UiStatus>("idle");
  const [currentInterim, setCurrentInterim] = useState("");
  const [pushSpeakerTurn, setPushSpeakerTurn] = useState<"me" | "them">("me");
  const [errorMsg, setErrorMsg] = useState("");
  const [langPicker, setLangPicker] = useState<"their" | "my" | null>(null);
  const [liveSettingsOpen, setLiveSettingsOpen] = useState(false);
  const [setupMenuOpen, setSetupMenuOpen] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [ttsOn, setTtsOn] = useState(true);

  const ttsOnRef = useRef(true);
  ttsOnRef.current = ttsOn;

  const recognitionRef = useRef<SpeechRec | null>(null);
  const isActiveRef = useRef(false);
  const suppressOnEndRestartRef = useRef(false);
  const processingUtteranceRef = useRef(false);
  const alternateListenRef = useRef<"my" | "their">("my");
  const currentBcp47Ref = useRef(langCodeMap.ko);

  const pushCombinedRef = useRef("");
  const pushPendingStopRef = useRef(false);
  const pushRecognitionRef = useRef<SpeechRec | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    ensureStyleInjected();
  }, []);

  const closeAll = useCallback(() => {
    isActiveRef.current = false;
    suppressOnEndRestartRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    try {
      pushRecognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    pushRecognitionRef.current = null;
    setInterpreterOpen(false);
    setPhase("setup");
    setHistory([]);
    setCurrentInterim("");
    setErrorMsg("");
    setStatus("idle");
    setLangPicker(null);
    setLiveSettingsOpen(false);
    setSetupMenuOpen(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  }, [setInterpreterOpen]);

  const playTtsBlob = useCallback(
    (text: string, langCode: string): Promise<void> => {
      return new Promise((resolve) => {
        if (!text.trim() || !ttsOnRef.current) {
          resolve();
          return;
        }
        void (async () => {
          try {
            const ttsRes = await fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text, lang: langCode }),
            });
            if (!ttsRes.ok) {
              resolve();
              return;
            }
            const audioBlob = await ttsRes.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = audioRef.current;
            if (audio) {
              audio.src = audioUrl;
              audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                resolve();
              };
              audio.onerror = () => {
                URL.revokeObjectURL(audioUrl);
                resolve();
              };
              void audio.play().catch(() => {
                URL.revokeObjectURL(audioUrl);
                resolve();
              });
            } else {
              const audio = new Audio(audioUrl);
              audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                resolve();
              };
              audio.onerror = () => {
                URL.revokeObjectURL(audioUrl);
                resolve();
              };
              void audio.play().catch(() => {
                URL.revokeObjectURL(audioUrl);
                resolve();
              });
            }
          } catch {
            resolve();
          }
        })();
      });
    },
    []
  );

  const handleTranslate = useCallback(
    async (text: string, bcp47ForDetect: string) => {
      const trimmed = text.trim();
      if (!trimmed || processingUtteranceRef.current) return;

      processingUtteranceRef.current = true;
      suppressOnEndRestartRef.current = true;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }

      setCurrentInterim("");
      setStatus("translating");

      const speaker = detectLanguage(trimmed, myLang, theirLang, bcp47ForDetect);
      const fromLang = speaker === "me" ? myLang : theirLang;
      const toLang = speaker === "me" ? theirLang : myLang;

      try {
        const res = await fetch("/api/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            fromLang,
            toLang,
            userId: currentUserId ?? undefined,
          }),
        });
        const data = (await res.json()) as { translated?: string; error?: string };
        if (!res.ok) {
          setErrorMsg(data.error || "번역 실패");
          setStatus("listening");
          return;
        }
        const translated = (data.translated ?? "").trim();
        const entry: InterpretEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          speaker,
          original: trimmed,
          translated,
          fromLang,
          toLang,
          timestamp: new Date(),
        };
        setHistory((prev) => [...prev, entry]);

        setStatus("speaking");
        await playTtsBlob(translated, toLang);
      } catch {
        setErrorMsg("네트워크 오류");
      } finally {
        setStatus("listening");
        processingUtteranceRef.current = false;
        alternateListenRef.current = alternateListenRef.current === "my" ? "their" : "my";
        suppressOnEndRestartRef.current = false;
        if (inputMode === "realtime" && phase === "live" && isActiveRef.current) {
          try {
            startRealtimeRecognitionRef.current?.();
          } catch {
            /* ignore */
          }
        }
      }
    },
    [myLang, theirLang, currentUserId, playTtsBlob, inputMode, phase]
  );

  const handleTranslateRef = useRef(handleTranslate);
  handleTranslateRef.current = handleTranslate;

  const startRealtimeRecognitionRef = useRef<(() => void) | null>(null);

  const attachRealtimeRecognition = useCallback(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setErrorMsg("이 브라우저는 음성인식을 지원하지 않아요.");
      return;
    }

    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }

    const next = alternateListenRef.current;
    const code = next === "my" ? myLang : theirLang;
    const bcp47 = langCodeMap[code] || "ko-KR";
    currentBcp47Ref.current = bcp47;

    const recognition = new SR() as SpeechRec;
    recognition.lang = bcp47;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const piece = r[0]?.transcript ?? "";
        if (r.isFinal) finalText += piece;
        else interimText += piece;
      }
      if (interimText) setCurrentInterim(interimText);
      const ft = finalText.trim();
      if (ft && !processingUtteranceRef.current) {
        void handleTranslateRef.current(ft, currentBcp47Ref.current);
      }
    };

    recognition.onerror = () => {
      if (!isActiveRef.current) return;
      setStatus("listening");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (!isActiveRef.current || suppressOnEndRestartRef.current || processingUtteranceRef.current) {
        return;
      }
      if (inputMode !== "realtime" || phase !== "live") return;
      try {
        startRealtimeRecognitionRef.current?.();
      } catch {
        /* ignore */
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setStatus("listening");
    } catch {
      setErrorMsg("음성인식을 시작할 수 없어요.");
    }
  }, [myLang, theirLang, inputMode, phase]);

  startRealtimeRecognitionRef.current = attachRealtimeRecognition;

  useEffect(() => {
    if (!interpreterOpen || phase !== "live" || inputMode !== "realtime") {
      isActiveRef.current = false;
      suppressOnEndRestartRef.current = true;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
      return;
    }

    isActiveRef.current = true;
    suppressOnEndRestartRef.current = false;
    alternateListenRef.current = "my";
    attachRealtimeRecognition();

    return () => {
      isActiveRef.current = false;
      suppressOnEndRestartRef.current = true;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, [interpreterOpen, phase, inputMode, myLang, theirLang, attachRealtimeRecognition]);

  const startPushListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setErrorMsg("이 브라우저는 음성인식을 지원하지 않아요.");
      return;
    }

    try {
      pushRecognitionRef.current?.stop();
    } catch {
      /* ignore */
    }

    const code = pushSpeakerTurn === "me" ? myLang : theirLang;
    const bcp47 = langCodeMap[code] || "ko-KR";
    currentBcp47Ref.current = bcp47;
    pushCombinedRef.current = "";
    pushPendingStopRef.current = false;

    const recognition = new SR() as SpeechRec;
    recognition.lang = bcp47;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let allFinal = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        const piece = r[0]?.transcript ?? "";
        if (r.isFinal) allFinal += piece;
        else interim += piece;
      }
      const combined = (allFinal + interim).trim();
      pushCombinedRef.current = combined;
      setCurrentInterim(combined);
    };

    recognition.onerror = () => {
      pushRecognitionRef.current = null;
      setStatus("idle");
      setCurrentInterim("");
    };

    recognition.onend = () => {
      pushRecognitionRef.current = null;
      if (pushPendingStopRef.current) {
        pushPendingStopRef.current = false;
        const t = pushCombinedRef.current.trim();
        if (t) void handleTranslateRef.current(t, currentBcp47Ref.current);
        else setStatus("idle");
        setCurrentInterim("");
        return;
      }
      const t = pushCombinedRef.current.trim();
      if (t) void handleTranslateRef.current(t, currentBcp47Ref.current);
      else setStatus("idle");
      setCurrentInterim("");
    };

    pushRecognitionRef.current = recognition;
    try {
      recognition.start();
      setStatus("listening");
    } catch {
      setErrorMsg("음성인식을 시작할 수 없어요.");
    }
  }, [pushSpeakerTurn, myLang, theirLang]);

  const stopPushListening = useCallback(() => {
    pushPendingStopRef.current = true;
    try {
      pushRecognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const beginLive = useCallback(() => {
    setErrorMsg("");
    setPhase("live");
    setHistory([]);
    setCurrentInterim("");
    setStatus("idle");
    alternateListenRef.current = "my";
  }, []);

  const transPx = Math.round(18 * fontScale);
  const theirM = langMeta(theirLang);
  const myM = langMeta(myLang);

  const showGlow = status === "listening" && (inputMode === "realtime" || inputMode === "push");

  const bubbleBlock = (e: InterpretEntry) => {
    const isMe = e.speaker === "me";
    return (
      <div
        key={e.id}
        className={`flex w-full mb-3 ${isMe ? "justify-end" : "justify-start"}`}
      >
        <div
          className="max-w-[85%] rounded-2xl px-3 py-2.5 relative"
          style={{ background: "rgba(255,255,255,0.08)", borderRadius: 16 }}
        >
          <button
            type="button"
            onClick={() => void playTtsBlob(e.translated, e.toLang)}
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-sm opacity-70 hover:opacity-100"
            aria-label="TTS"
          >
            🔊
          </button>
          <p className="text-[12px] text-white/45 pr-8 whitespace-pre-wrap break-words">{e.original}</p>
          <p
            className="text-white font-medium mt-1 pr-6 whitespace-pre-wrap break-words"
            style={{ fontSize: transPx }}
          >
            {e.translated}
          </p>
        </div>
      </div>
    );
  };

  const statusLine = (
    <div
      className="min-h-[22px] text-center text-[13px]"
      style={{ color: "rgba(255,255,255,0.55)" }}
    >
      {status === "listening" ? (
        <>
          🎤 듣고 있어요
          <span className="interpret-dot-1">.</span>
          <span className="interpret-dot-2">.</span>
          <span className="interpret-dot-3">.</span>
        </>
      ) : status === "translating" ? (
        <>🔄 번역중...</>
      ) : status === "speaking" ? (
        <>🔊 말하는 중...</>
      ) : null}
    </div>
  );

  const meEntries = history.filter((e) => e.speaker === "me");
  const themEntries = history.filter((e) => e.speaker === "them");
  const latestMeEntry = meEntries[meEntries.length - 1];
  const prevMeEntries = meEntries.slice(0, -1);
  const latestThemEntry = themEntries[themEntries.length - 1];
  const prevThemEntries = themEntries.slice(0, -1);

  const controlBar = (
    <div
      className="shrink-0 flex flex-col gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-white/10 bg-[#0a0a0f]"
      style={layoutMode === "side" ? { position: "absolute", bottom: 0, left: 0, right: 0 } : {}}
    >
      {statusLine}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setPushSpeakerTurn((s) => (s === "me" ? "them" : "me"))}
          className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] text-white/80"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
          title={pushSpeakerTurn === "me" ? "내 언어로 인식" : "상대 언어로 인식"}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          {pushSpeakerTurn === "me" ? myM.flag : theirM.flag}
        </button>

        {inputMode === "push" ? (
          <div className="relative w-[76px] h-[76px] flex items-center justify-center">
            {status === "listening" ? (
              <div className="interpret-mic-ripples pointer-events-none absolute inset-0">
                <span />
                <span />
                <span />
              </div>
            ) : null}
            <motion.button
              type="button"
              disabled={status === "translating" || status === "speaking"}
              onMouseDown={(e) => {
                e.preventDefault();
                startPushListening();
              }}
              onMouseUp={() => stopPushListening()}
              onMouseLeave={() => {
                if (status === "listening") stopPushListening();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                startPushListening();
              }}
              onTouchEnd={() => stopPushListening()}
              className="relative z-[1] w-[72px] h-[72px] rounded-full flex flex-col items-center justify-center text-white font-semibold text-[11px] disabled:opacity-50"
              style={{
                background:
                  status === "listening"
                    ? "#ef4444"
                    : "linear-gradient(135deg, #6c5ce7, #a78bfa)",
                touchAction: "none",
                animation: status === "listening" ? "interpret-pulse 1.5s infinite" : undefined,
                boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
              }}
            >
              <Mic className="w-7 h-7 mb-0.5" strokeWidth={2.2} />
              누르기
            </motion.button>
          </div>
        ) : (
          <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-[11px] text-white/50 border border-white/15 bg-white/5 px-2 text-center leading-tight">
            자동
            <br />
            듣기
          </div>
        )}

        <motion.div
          animate={status === "speaking" ? { scale: [1, 1.1, 1] } : {}}
          transition={status === "speaking" ? { repeat: Infinity, duration: 0.85 } : {}}
        >
          <button
            type="button"
            onClick={() => setTtsOn((v) => !v)}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-white text-[#0a0a0f]"
            aria-label="TTS"
          >
            {ttsOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </motion.div>

        <button
          type="button"
          onClick={() => setLiveSettingsOpen(true)}
          className="w-11 h-11 rounded-full flex items-center justify-center bg-white text-[#0a0a0f]"
          aria-label="설정"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const languageSheet = (
    <AnimatePresence>
      {langPicker && (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-[1100] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLangPicker(null)}
          />
          <motion.div
            role="dialog"
            className="fixed left-0 right-0 bottom-0 z-[1101] max-h-[72vh] flex flex-col mx-auto max-w-[430px] rounded-t-[20px] overflow-hidden"
            style={{ background: "#1a1a2e" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-white font-semibold">언어 선택</span>
              <button type="button" onClick={() => setLangPicker(null)} className="p-2">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-2 py-2 pb-8">
              {LANG_SHEET.map((L) => {
                const sel =
                  langPicker === "their" ? L.code === theirLang : L.code === myLang;
                return (
                  <button
                    key={L.code}
                    type="button"
                    onClick={() => {
                      if (langPicker === "their") setTheirLang(L.code);
                      else setMyLang(L.code);
                      setLangPicker(null);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-white/5"
                  >
                    <span className="text-xl">{L.flag}</span>
                    <span className="flex-1 text-white">
                      <span className="font-medium">{L.native}</span>
                      <span className="text-white/50 text-sm"> / {L.english}</span>
                    </span>
                    {sel ? <Check className="w-5 h-5 text-sky-400 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  const liveSettingsSheet = (
    <AnimatePresence>
      {liveSettingsOpen && (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-[1100] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLiveSettingsOpen(false)}
          />
          <motion.div
            className="fixed left-0 right-0 bottom-0 z-[1101] max-h-[80vh] overflow-y-auto mx-auto max-w-[430px] px-4 pt-4 pb-8 rounded-t-[20px]"
            style={{ background: "#1a1a2e" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-white font-semibold">설정</span>
              <button type="button" onClick={() => setLiveSettingsOpen(false)} className="p-2">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <p className="text-xs text-white mb-2 font-medium">표시 스타일</p>
            <div className="flex gap-2 mb-4">
              {(
                [
                  ["single", "단일", User],
                  ["face", "대면", Users],
                  ["side", "나란히", Columns2],
                ] as const
              ).map(([k, lab, Icon]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setLayoutMode(k)}
                  className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl text-xs text-white"
                  style={
                    layoutMode === k
                      ? {
                          background: "rgba(255,255,255,0.14)",
                          border: "1px solid rgba(255,255,255,0.35)",
                        }
                      : {
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }
                  }
                >
                  <Icon className="w-5 h-5" />
                  {lab}
                </button>
              ))}
            </div>
            <p className="text-xs text-white mb-2 font-medium">입력 모드</p>
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setInputMode("realtime")}
                className="flex-1 py-3 rounded-xl text-sm text-white"
                style={
                  inputMode === "realtime"
                    ? {
                        background: "rgba(255,255,255,0.18)",
                        border: "1px solid rgba(255,255,255,0.35)",
                      }
                    : {
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }
                }
              >
                실시간
              </button>
              <button
                type="button"
                onClick={() => setInputMode("push")}
                className="flex-1 py-3 rounded-xl text-sm text-white"
                style={
                  inputMode === "push"
                    ? {
                        background: "rgba(255,255,255,0.18)",
                        border: "1px solid rgba(255,255,255,0.35)",
                      }
                    : {
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }
                }
              >
                누르고 말하기
              </button>
            </div>
            <p className="text-xs text-white mb-2 font-medium">글자 크기</p>
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={() => setFontScale((f) => Math.max(0.85, f - 0.1))}
                className="w-10 h-10 rounded-lg bg-white text-[#0a0a0f] font-bold"
              >
                A-
              </button>
              <span className="flex-1 text-center text-white text-sm font-medium">미리보기</span>
              <button
                type="button"
                onClick={() => setFontScale((f) => Math.min(1.35, f + 0.1))}
                className="w-10 h-10 rounded-lg bg-white text-[#0a0a0f] font-bold text-lg"
              >
                A+
              </button>
            </div>
            <p className="text-center mb-4 text-white font-bold" style={{ fontSize: transPx }}>
              번역 텍스트 크기
            </p>
            <button
              type="button"
              onClick={() => {
                setLiveSettingsOpen(false);
                setPhase("setup");
                isActiveRef.current = false;
                suppressOnEndRestartRef.current = true;
                try {
                  recognitionRef.current?.stop();
                } catch {
                  /* ignore */
                }
                recognitionRef.current = null;
              }}
              className="w-full py-3 rounded-xl font-semibold bg-white text-[#0a0a0f]"
            >
              설정으로 돌아가기
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <AnimatePresence>
      {interpreterOpen ? (
        <motion.div
          key="interpret-v2"
          className="fixed inset-0 z-[1000] flex flex-col"
          style={{
            background: "#0a0a0f",
            animation: showGlow ? "interpret-purple-glow 2.5s ease-in-out infinite" : undefined,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <audio ref={audioRef} className="hidden" />

          {phase === "setup" ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-2">
                <h1 className="text-lg font-semibold text-white">실시간 번역</h1>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSetupMenuOpen(true)}
                    className="p-2 rounded-full hover:bg-white/10 text-white/80"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={closeAll} className="p-2 rounded-full hover:bg-white/10">
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-6">
                <p className="text-[13px] text-white/55 mb-2">상대방 언어</p>
                <button
                  type="button"
                  onClick={() => setLangPicker("their")}
                  className="w-full flex items-center justify-between px-4 py-3.5 mb-4 text-left rounded-xl border border-white/15 bg-white/5"
                >
                  <span className="text-white flex items-center gap-2">
                    <span className="text-lg">{theirM.flag}</span>
                    {theirM.native}
                  </span>
                  <span className="text-white/40">›</span>
                </button>
                <p className="text-[13px] text-white/55 mb-2">내 언어</p>
                <button
                  type="button"
                  onClick={() => setLangPicker("my")}
                  className="w-full flex items-center justify-between px-4 py-3.5 mb-4 text-left rounded-xl border border-white/15 bg-white/5"
                >
                  <span className="text-white flex items-center gap-2">
                    <span className="text-lg">{myM.flag}</span>
                    {myM.native}
                  </span>
                  <span className="text-white/40">›</span>
                </button>

                <p className="text-[13px] text-white/55 mb-2">표시 스타일</p>
                <div className="flex gap-2 mb-4">
                  {(
                    [
                      ["single", "단일", User],
                      ["face", "대면", Users],
                      ["side", "나란히", Columns2],
                    ] as const
                  ).map(([k, lab, Icon]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setLayoutMode(k)}
                      className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl text-[11px] text-white"
                      style={
                        layoutMode === k
                          ? {
                              background: "rgba(255,255,255,0.14)",
                              border: "1px solid rgba(255,255,255,0.35)",
                            }
                          : {
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                            }
                      }
                    >
                      <Icon className="w-5 h-5" />
                      {lab}
                    </button>
                  ))}
                </div>

                <p className="text-[13px] text-white/55 mb-2">입력 모드</p>
                <div className="flex gap-2 mb-6">
                  <button
                    type="button"
                    onClick={() => setInputMode("realtime")}
                    className="flex-1 py-3 rounded-xl text-sm text-white"
                    style={
                      inputMode === "realtime"
                        ? {
                            background: "rgba(255,255,255,0.18)",
                            border: "1px solid rgba(255,255,255,0.35)",
                          }
                        : {
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                          }
                    }
                  >
                    실시간
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode("push")}
                    className="flex-1 py-3 rounded-xl text-sm text-white"
                    style={
                      inputMode === "push"
                        ? {
                            background: "rgba(255,255,255,0.18)",
                            border: "1px solid rgba(255,255,255,0.35)",
                          }
                        : {
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                          }
                    }
                  >
                    누르고 말하기
                  </button>
                </div>

                <motion.button
                  type="button"
                  onClick={beginLive}
                  className="w-full py-3.5 rounded-xl font-semibold text-[#0a0a0f] bg-white"
                  whileTap={{ scale: 0.99 }}
                >
                  대화 시작
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 relative">
              <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    isActiveRef.current = false;
                    suppressOnEndRestartRef.current = true;
                    try {
                      recognitionRef.current?.stop();
                    } catch {
                      /* ignore */
                    }
                    recognitionRef.current = null;
                    try {
                      pushRecognitionRef.current?.stop();
                    } catch {
                      /* ignore */
                    }
                    pushRecognitionRef.current = null;
                    setPhase("setup");
                    setStatus("idle");
                    setCurrentInterim("");
                  }}
                  className="p-2 text-white/70 text-lg"
                >
                  ←
                </button>
                <span className="text-sm font-medium text-white/90">실시간 번역</span>
                <button type="button" onClick={closeAll} className="p-2 rounded-full hover:bg-white/10">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {errorMsg ? (
                <div className="shrink-0 px-3 py-2 text-center text-sm text-red-300">{errorMsg}</div>
              ) : null}

              {layoutMode === "single" && (
                <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
                  {currentInterim ? (
                    <p className="text-base text-white/70 mb-2 whitespace-pre-wrap border border-white/10 rounded-xl px-3 py-2 bg-white/5">
                      {currentInterim}
                      <span className="inline-block w-0.5 h-4 ml-0.5 bg-white/50 animate-pulse align-middle" />
                    </p>
                  ) : null}
                  {history.map((e) => bubbleBlock(e))}
                </div>
              )}

              {layoutMode === "face" && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div
                    className="min-h-0 flex-1 overflow-y-auto px-3 py-2 flex flex-col justify-end gap-2"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      transform: "rotate(180deg)",
                    }}
                  >
                    {prevMeEntries.map((e) => (
                      <div
                        key={e.id}
                        className="text-center text-white/55 text-sm px-2"
                        style={{ transform: "rotate(180deg)" }}
                      >
                        {e.translated}
                      </div>
                    ))}
                    {latestMeEntry ? (
                      <div
                        className="rounded-2xl px-3 py-3 text-center mx-auto max-w-[95%]"
                        style={{
                          background: "rgba(255,255,255,0.1)",
                          transform: "rotate(180deg)",
                        }}
                      >
                        <p
                          className="text-white font-bold leading-snug"
                          style={{ fontSize: Math.max(transPx + 8, 24) }}
                        >
                          {latestMeEntry.translated}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            void playTtsBlob(latestMeEntry.translated, latestMeEntry.toLang)
                          }
                          className="mt-2 text-sm opacity-70"
                        >
                          🔊
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 border-y border-white/10 bg-[#0a0a0f]">{controlBar}</div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
                    {prevThemEntries.map((e) => (
                      <div key={e.id} className="text-white/55 text-sm px-2">
                        {e.translated}
                      </div>
                    ))}
                    {latestThemEntry ? (
                      <div
                        className="rounded-2xl px-3 py-3 max-w-[95%]"
                        style={{ background: "rgba(255,255,255,0.1)" }}
                      >
                        <p
                          className="text-white font-bold leading-snug"
                          style={{ fontSize: Math.max(transPx + 6, 24) }}
                        >
                          {latestThemEntry.translated}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            void playTtsBlob(latestThemEntry.translated, latestThemEntry.toLang)
                          }
                          className="mt-2 text-sm opacity-70"
                        >
                          🔊
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {layoutMode === "side" && (
                <div className="flex-1 min-h-0 flex flex-row relative pb-[120px]">
                  <div className="flex-1 min-w-0 overflow-y-auto px-2 py-2 border-r border-white/10">
                    <p className="text-[11px] text-white/45 text-center mb-2">내 언어</p>
                    {history.map((e) => {
                      const line =
                        e.speaker === "me" ? e.original : e.translated;
                      const sub = e.speaker === "me" ? e.translated : e.original;
                      return (
                        <div
                          key={e.id + "L"}
                          className="mb-2 rounded-xl px-2 py-2 bg-white/8"
                          style={{ background: "rgba(255,255,255,0.08)" }}
                        >
                          <p className="text-[11px] text-white/40 whitespace-pre-wrap">{sub}</p>
                          <p className="text-white mt-0.5 whitespace-pre-wrap" style={{ fontSize: transPx - 2 }}>
                            {line}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              void playTtsBlob(
                                e.speaker === "me" ? e.original : e.translated,
                                e.speaker === "me" ? myLang : myLang
                              )
                            }
                            className="text-xs mt-1 opacity-70"
                          >
                            🔊
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex-1 min-w-0 overflow-y-auto px-2 py-2">
                    <p className="text-[11px] text-white/45 text-center mb-2">상대 언어</p>
                    {history.map((e) => {
                      const line =
                        e.speaker === "them" ? e.original : e.translated;
                      const sub = e.speaker === "them" ? e.translated : e.original;
                      return (
                        <div
                          key={e.id + "R"}
                          className="mb-2 rounded-xl px-2 py-2"
                          style={{ background: "rgba(255,255,255,0.08)" }}
                        >
                          <p className="text-[11px] text-white/40 whitespace-pre-wrap">{sub}</p>
                          <p className="text-white mt-0.5 whitespace-pre-wrap" style={{ fontSize: transPx - 2 }}>
                            {line}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              void playTtsBlob(
                                e.speaker === "them" ? e.original : e.translated,
                                e.speaker === "them" ? theirLang : theirLang
                              )
                            }
                            className="text-xs mt-1 opacity-70"
                          >
                            🔊
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {controlBar}
                </div>
              )}

              {layoutMode === "single" && controlBar}
            </div>
          )}

          {languageSheet}
          {liveSettingsSheet}

          <AnimatePresence>
            {setupMenuOpen && (
              <>
                <motion.button
                  type="button"
                  className="fixed inset-0 z-[1100] bg-black/50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSetupMenuOpen(false)}
                />
                <motion.div
                  className="fixed left-0 right-0 bottom-0 z-[1101] mx-auto max-w-[430px] px-4 py-4 rounded-t-[20px] bg-[#1a1a2e]"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                >
                  <p className="text-white font-medium mb-3">안내</p>
                  <p className="text-sm text-white/70 mb-3">
                    실시간 모드는 Web Speech API로 듣고, 문장이 끝나면 자동 번역·TTS 후 다시 듣습니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSetupMenuOpen(false)}
                    className="w-full py-3 rounded-xl bg-white/10 text-white text-sm"
                  >
                    닫기
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
