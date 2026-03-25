"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MoreHorizontal,
  Settings,
  Volume2,
  VolumeX,
  ArrowDownUp,
  User,
  Users,
  Columns2,
  Check,
  X,
} from "lucide-react";
import { useStore } from "@/stores/useStore";
import { useModalBodyLock } from "@/lib/useModalBodyLock";

const SESSIONS_KEY = "bababang-interpret-sessions-v1";

const INTERPRET_STYLE_ID = "interpret-panel-keyframes";

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

type PastSession = {
  id: string;
  at: number;
  theirLang: string;
  myLang: string;
};

type FlowStatus = "idle" | "listening" | "translating" | "speaking";

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

const SPEECH_LANG: Record<string, string> = {
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

function langMeta(code: string) {
  return LANG_SHEET.find((l) => l.code === code) ?? LANG_SHEET[2];
}

type LayoutMode = "single" | "face" | "side";
type InputMode = "realtime" | "push";

function loadSessions(): PastSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as PastSession[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: PastSession[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 30)));
  } catch {
    /* ignore */
  }
}

function ensureStyleInjected() {
  if (typeof document === "undefined") return;
  if (document.getElementById(INTERPRET_STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = INTERPRET_STYLE_ID;
  el.textContent = INTERPRET_CSS;
  document.head.appendChild(el);
}

async function requestMicStreamWithAlerts(): Promise<MediaStream | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return stream;
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string };
    if (e.name === "NotAllowedError") {
      alert(
        "마이크 권한을 허용해주세요. 브라우저 설정에서 마이크 권한을 확인해주세요."
      );
    } else if (e.name === "NotFoundError") {
      alert("마이크를 찾을 수 없습니다.");
    } else {
      alert("마이크 오류: " + (e.message || String(err)));
    }
    return null;
  }
}

export function InterpreterPanel() {
  const interpreterOpen = useStore((s) => s.interpreterOpen);
  const setInterpreterOpen = useStore((s) => s.setInterpreterOpen);
  const currentUserId = useStore((s) => s.currentUserId);

  useModalBodyLock(interpreterOpen);

  const [phase, setPhase] = useState<"setup" | "live">("setup");
  const [theirLang, setTheirLang] = useState("zh");
  const [myLang, setMyLang] = useState("ko");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("face");
  const [inputMode, setInputMode] = useState<InputMode>("push");
  const [speakerTurn, setSpeakerTurn] = useState<"me" | "them">("me");
  const [history, setHistory] = useState<InterpretEntry[]>([]);
  const [interim, setInterim] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [langPicker, setLangPicker] = useState<"their" | "my" | null>(null);
  const [liveSettingsOpen, setLiveSettingsOpen] = useState(false);
  const [setupMenuOpen, setSetupMenuOpen] = useState(false);
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [fontScale, setFontScale] = useState(1);
  const [ttsOn, setTtsOn] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [flowStatus, setFlowStatus] = useState<FlowStatus>("idle");
  const [realtimeSessionKey, setRealtimeSessionKey] = useState(0);

  const ttsOnRef = useRef(true);
  ttsOnRef.current = ttsOn;

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    ensureStyleInjected();
  }, []);

  useEffect(() => {
    if (interpreterOpen) setPastSessions(loadSessions());
  }, [interpreterOpen]);

  const closeAll = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    setInterpreterOpen(false);
    setPhase("setup");
    setHistory([]);
    setInterim("");
    setErrorMsg("");
    setLangPicker(null);
    setLiveSettingsOpen(false);
    setSetupMenuOpen(false);
    setIsRecording(false);
    setFlowStatus("idle");
    setRealtimeSessionKey(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  }, [setInterpreterOpen]);

  const playTtsAudio = useCallback((text: string, langCode: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!text.trim() || !ttsOnRef.current) {
        resolve();
        return;
      }
      void (async () => {
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, lang: langCode }),
          });
          if (!res.ok) {
            resolve();
            return;
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const el = audioRef.current;
          if (el) {
            el.pause();
            el.src = url;
            el.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            el.onerror = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            void el.play().catch(() => {
              URL.revokeObjectURL(url);
              resolve();
            });
          } else {
            const a = new Audio(url);
            a.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            a.onerror = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            void a.play().catch(() => {
              URL.revokeObjectURL(url);
              resolve();
            });
          }
        } catch {
          resolve();
        }
      })();
    });
  }, []);

  const previewLangTts = useCallback(
    (code: string) => {
      const samples: Record<string, string> = {
        en: "Hello",
        ja: "こんにちは",
        zh: "你好",
        ko: "안녕하세요",
        hi: "नमस्ते",
        es: "Hola",
        ar: "مرحبا",
        fr: "Bonjour",
        id: "Halo",
        pt: "Olá",
        ru: "Привет",
        de: "Hallo",
        it: "Ciao",
        th: "สวัสดี",
        pl: "Cześć",
        ms: "Helo",
        el: "Γεια",
        nl: "Hallo",
      };
      void playTtsAudio(samples[code] || "Hello", code);
    },
    [playTtsAudio]
  );

  const interpretUtterance = useCallback(
    async (
      trimmed: string,
      from: string,
      to: string,
      speaker: "me" | "them",
      onPipelineDone?: () => void
    ) => {
      if (!trimmed) {
        onPipelineDone?.();
        return;
      }
      setFlowStatus("translating");
      setErrorMsg("");
      try {
        const res = await fetch("/api/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            fromLang: from,
            toLang: to,
            userId: currentUserId ?? undefined,
          }),
        });
        const data = (await res.json()) as { translated?: string; error?: string };
        if (!res.ok) {
          setErrorMsg(data.error || "통역 실패");
          return;
        }
        const translated = (data.translated || "").trim();
        const entry: InterpretEntry = {
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random()}`,
          speaker,
          original: trimmed,
          translated,
          fromLang: from,
          toLang: to,
          timestamp: new Date(),
        };
        setHistory((h) => [...h, entry]);
        setInterim("");
        setFlowStatus("speaking");
        await playTtsAudio(translated, to);
      } finally {
        setFlowStatus("idle");
        onPipelineDone?.();
      }
    },
    [currentUserId, playTtsAudio]
  );

  const interpretUtteranceRef = useRef(interpretUtterance);
  interpretUtteranceRef.current = interpretUtterance;

  const stopRealtime = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
  }, []);

  useEffect(() => {
    if (!interpreterOpen || phase !== "live" || inputMode !== "realtime") {
      stopRealtime();
      return;
    }
    if (typeof window === "undefined") return;

    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        maxAlternatives: number;
        start: () => void;
        stop: () => void;
        onresult: ((e: {
          results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
        }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        maxAlternatives: number;
        start: () => void;
        stop: () => void;
        onresult: ((e: {
          results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
        }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
      };
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setErrorMsg("이 브라우저는 실시간 음성인식을 지원하지 않아요.");
      return;
    }

    stopRealtime();

    const from = speakerTurn === "me" ? myLang : theirLang;
    const to = speakerTurn === "me" ? theirLang : myLang;
    const turn = speakerTurn;
    const rec = new SR();
    rec.lang = SPEECH_LANG[from] || "ko-KR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    setFlowStatus("listening");

    let busy = false;
    rec.onresult = (event) => {
      let finalT = "";
      let inter = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) finalT += t;
        else inter += t;
      }
      const combined = (finalT + inter).trim();
      setInterim(combined);
      const ft = finalT.trim();
      if (ft && !busy) {
        busy = true;
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
        void interpretUtteranceRef
          .current(ft, from, to, turn, () => {
            busy = false;
            setRealtimeSessionKey((k) => k + 1);
          })
          .catch(() => {
            busy = false;
            setRealtimeSessionKey((k) => k + 1);
          });
      }
    };
    rec.onerror = () => {
      setFlowStatus("idle");
      stopRealtime();
    };
    rec.onend = () => {
      recognitionRef.current = null;
    };
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      setErrorMsg("음성인식을 시작할 수 없어요.");
      setFlowStatus("idle");
    }

    return () => stopRealtime();
  }, [
    interpreterOpen,
    phase,
    inputMode,
    speakerTurn,
    myLang,
    theirLang,
    stopRealtime,
    realtimeSessionKey,
  ]);

  const getLiveMicStream = useCallback(async (): Promise<MediaStream | null> => {
    const cur = mediaStreamRef.current;
    if (cur) {
      const live = cur.getAudioTracks().some((t) => t.readyState === "live");
      if (live) return cur;
      cur.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    const stream = await requestMicStreamWithAlerts();
    if (stream) mediaStreamRef.current = stream;
    return stream;
  }, []);

  const startPushRecord = async () => {
    if (flowStatus === "translating" || flowStatus === "speaking" || mediaRecorderRef.current) {
      return;
    }
    const turn = speakerTurn;
    const my = myLang;
    const their = theirLang;
    setErrorMsg("");
    setIsRecording(true);
    setFlowStatus("listening");
    try {
      const stream = await getLiveMicStream();
      if (!stream) {
        setIsRecording(false);
        setFlowStatus("idle");
        return;
      }
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      recChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) recChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        setIsRecording(false);
        void (async () => {
          const blob = new Blob(recChunksRef.current, { type: mime });
          if (blob.size < 100) {
            setFlowStatus("idle");
            mediaRecorderRef.current = null;
            return;
          }
          const from = turn === "me" ? my : their;
          const to = turn === "me" ? their : my;
          const fd = new FormData();
          fd.append("audio", blob, "audio.webm");
          fd.append("lang", from);
          setFlowStatus("translating");
          try {
            const wr = await fetch("/api/whisper", { method: "POST", body: fd });
            const wd = (await wr.json()) as { text?: string; error?: string };
            if (!wr.ok || !wd.text?.trim()) {
              setErrorMsg(wd.error || "음성 인식 실패");
              setFlowStatus("idle");
              return;
            }
            await interpretUtterance(wd.text.trim(), from, to, turn);
          } finally {
            mediaRecorderRef.current = null;
          }
        })();
      };
      mediaRecorderRef.current = mr;
      mr.start();
    } catch {
      setIsRecording(false);
      setFlowStatus("idle");
      setErrorMsg("마이크 오류가 발생했어요.");
    }
  };

  const stopPushRecord = () => {
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      /* ignore */
    }
  };

  const swapLanguages = () => {
    const t = theirLang;
    setTheirLang(myLang);
    setMyLang(t);
  };

  const endSession = () => {
    if (history.length > 0) {
      const sess: PastSession = {
        id: `${Date.now()}`,
        at: Date.now(),
        theirLang,
        myLang,
      };
      const next = [sess, ...pastSessions].slice(0, 30);
      setPastSessions(next);
      saveSessions(next);
    }
    setHistory([]);
    setPhase("setup");
    setLiveSettingsOpen(false);
    stopRealtime();
    setFlowStatus("idle");
    setRealtimeSessionKey((k) => k + 1);
  };

  const startLiveSession = async () => {
    const stream = await requestMicStreamWithAlerts();
    if (!stream) return;
    if (mediaStreamRef.current && mediaStreamRef.current !== stream) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    mediaStreamRef.current = stream;
    setPhase("live");
    setFlowStatus("idle");
    setRealtimeSessionKey((k) => k + 1);
  };

  const transPx = Math.round(18 * fontScale);
  const theirM = langMeta(theirLang);
  const myM = langMeta(myLang);
  const myEntriesFace = history.filter((e) => e.speaker === "me");
  const theirEntriesFace = history.filter((e) => e.speaker === "them");

  const busyPipeline = flowStatus === "translating" || flowStatus === "speaking";

  const showListenGlow =
    isRecording ||
    (inputMode === "realtime" && phase === "live" && flowStatus === "listening");

  const bubbleOne = (
    side: "left" | "right",
    mainText: string,
    subText: string | null,
    ttsText: string,
    ttsLang: string
  ) => (
    <div
      className={`flex w-full mb-2 ${side === "right" ? "justify-end" : "justify-start"}`}
    >
      <div
        className="max-w-[85%] rounded-2xl px-3 py-2.5 relative"
        style={{
          background: "rgba(255,255,255,0.08)",
          borderRadius: 16,
        }}
      >
        <button
          type="button"
          onClick={() => void playTtsAudio(ttsText, ttsLang)}
          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-sm opacity-70 hover:opacity-100"
          aria-label="읽기"
        >
          🔊
        </button>
        {subText ? (
          <p className="text-[12px] text-white/45 pr-8 whitespace-pre-wrap break-words leading-snug">
            {subText}
          </p>
        ) : null}
        <p
          className={`text-white font-medium whitespace-pre-wrap break-words leading-snug ${subText ? "mt-1 pr-6" : "pr-8"}`}
          style={{ fontSize: transPx }}
        >
          {mainText}
        </p>
      </div>
    </div>
  );

  const renderEntryPair = (e: InterpretEntry) => {
    if (e.speaker === "me") {
      return (
        <div key={e.id} className="mb-3 w-full">
          {bubbleOne("right", e.original, null, e.original, myLang)}
          {bubbleOne("left", e.translated, null, e.translated, theirLang)}
        </div>
      );
    }
    return (
      <div key={e.id} className="mb-3 w-full">
        {bubbleOne("left", e.original, null, e.original, theirLang)}
        {bubbleOne("right", e.translated, null, e.translated, myLang)}
      </div>
    );
  };

  const statusLine = (
    <div
      style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 13 }}
      className="min-h-[20px]"
    >
      {isRecording || (inputMode === "realtime" && flowStatus === "listening") ? (
        <>
          🎤 듣고 있어요
          <span className="inline">
            <span className="interpret-dot-1">.</span>
            <span className="interpret-dot-2">.</span>
            <span className="interpret-dot-3">.</span>
          </span>
        </>
      ) : flowStatus === "translating" ? (
        <>🔄 번역중...</>
      ) : flowStatus === "speaking" ? (
        <>🔊 말하는 중...</>
      ) : null}
    </div>
  );

  const controlBar = (
    <div
      className="shrink-0 flex flex-col gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-white/10 bg-[#0a0a0f]"
      style={layoutMode === "side" ? { position: "absolute", bottom: 0, left: 0, right: 0 } : {}}
    >
      {statusLine}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setSpeakerTurn((s) => (s === "me" ? "them" : "me"))}
          className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium"
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff",
          }}
        >
          <span
            style={{
              opacity: speakerTurn === "me" ? 1 : 0.45,
              transform: speakerTurn === "me" ? "scale(1.15)" : "scale(1)",
              transition: "0.2s",
            }}
          >
            {myM.flag}
          </span>
          <span className="text-white/50">/</span>
          <span
            style={{
              opacity: speakerTurn === "them" ? 1 : 0.45,
              transform: speakerTurn === "them" ? "scale(1.15)" : "scale(1)",
              transition: "0.2s",
            }}
          >
            {theirM.flag}
          </span>
        </button>

        {inputMode === "push" ? (
          <div className="flex flex-col items-center gap-1 relative">
            <div className="relative w-[76px] h-[76px] flex items-center justify-center">
              {isRecording ? (
                <div className="interpret-mic-ripples pointer-events-none absolute inset-0">
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}
              <motion.button
                type="button"
                disabled={busyPipeline}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void startPushRecord();
                }}
                onMouseUp={() => stopPushRecord()}
                onMouseLeave={() => isRecording && stopPushRecord()}
                onTouchStart={(e) => {
                  e.preventDefault();
                  void startPushRecord();
                }}
                onTouchEnd={() => stopPushRecord()}
                className="relative z-[1] w-[72px] h-[72px] rounded-full flex flex-col items-center justify-center text-white font-semibold text-[11px] disabled:opacity-50"
                style={{
                  background: isRecording ? "#ef4444" : "linear-gradient(135deg, #6c5ce7, #a78bfa)",
                  touchAction: "none",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                  animation: isRecording ? "interpret-pulse 1.5s infinite" : undefined,
                }}
              >
                <Mic className="w-7 h-7 mb-0.5" strokeWidth={2.2} />
                누르기
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-xs text-white/50 border border-white/15 bg-white/5">
            실시간
          </div>
        )}

        <motion.div
          animate={
            flowStatus === "speaking"
              ? { scale: [1, 1.12, 1] }
              : { scale: 1 }
          }
          transition={
            flowStatus === "speaking"
              ? { repeat: Infinity, duration: 0.8 }
              : {}
          }
        >
          <button
            type="button"
            onClick={() => setTtsOn((v) => !v)}
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{
              background: "#ffffff",
              color: "#0a0a0f",
            }}
            aria-label={ttsOn ? "음성 끄기" : "음성 켜기"}
          >
            {ttsOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </motion.div>

        <button
          type="button"
          onClick={() => setLiveSettingsOpen(true)}
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{
            background: "#ffffff",
            color: "#0a0a0f",
          }}
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
            aria-label="닫기"
            className="fixed inset-0 z-[1100] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLangPicker(null)}
          />
          <motion.div
            role="dialog"
            aria-modal
            className="fixed left-0 right-0 bottom-0 z-[1101] max-h-[72vh] flex flex-col mx-auto max-w-[430px]"
            style={{
              background: "#1a1a2e",
              borderRadius: "20px 20px 0 0",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-white font-semibold">언어 선택</span>
              <button
                type="button"
                onClick={() => setLangPicker(null)}
                className="p-2 rounded-full hover:bg-white/10"
                aria-label="닫기"
              >
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
                      <span className="text-white/45 text-sm"> / {L.english}</span>
                    </span>
                    {sel ? (
                      <Check className="w-5 h-5 text-sky-400 shrink-0" strokeWidth={2.5} />
                    ) : null}
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
            className="fixed left-0 right-0 bottom-0 z-[1101] max-h-[80vh] overflow-y-auto mx-auto max-w-[430px] px-4 pt-4 pb-8"
            style={{
              background: "#1a1a2e",
              borderRadius: "20px 20px 0 0",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-white font-semibold">설정</span>
              <button type="button" onClick={() => setLiveSettingsOpen(false)} className="p-2">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <p className="text-xs text-white mb-2 font-medium">레이아웃</p>
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
            <p
              className="text-center mb-4 text-white font-bold"
              style={{ fontSize: transPx }}
            >
              번역 텍스트 크기
            </p>
            <button
              type="button"
              onClick={endSession}
              className="w-full py-3 rounded-xl font-semibold bg-white text-[#0a0a0f]"
            >
              세션 종료
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
          key="interpreter-panel"
          className="fixed inset-0 z-[1000] flex flex-col interpret-panel-root"
          style={{
            background: "#0a0a0f",
            animation: showListenGlow ? "interpret-purple-glow 2.5s ease-in-out infinite" : undefined,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <audio ref={audioRef} className="hidden" />

          {phase === "setup" ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-2">
                <h1 className="text-lg font-semibold text-white tracking-tight">실시간 번역</h1>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSetupMenuOpen(true)}
                    className="p-2 rounded-full hover:bg-white/10 text-white/80"
                    aria-label="설정"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={closeAll}
                    className="p-2 rounded-full hover:bg-white/10 text-white/80"
                    aria-label="닫기"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <p className="text-[13px] text-white/55 mb-2">상대방 언어</p>
                <button
                  type="button"
                  onClick={() => setLangPicker("their")}
                  className="w-full flex items-center justify-between px-4 py-3.5 mb-1 text-left"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <span className="flex items-center gap-2 text-white">
                    <span className="text-lg">{theirM.flag}</span>
                    <span>{theirM.native}</span>
                  </span>
                  <span className="flex items-center gap-2 text-white/45">
                    <span>›</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        void previewLangTts(theirLang);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          void previewLangTts(theirLang);
                        }
                      }}
                      className="text-base p-1"
                    >
                      🔊
                    </span>
                  </span>
                </button>

                <div className="flex justify-center py-2">
                  <button
                    type="button"
                    onClick={swapLanguages}
                    className="p-2 rounded-full bg-white/10 text-white/70"
                    aria-label="언어 바꿈"
                  >
                    <ArrowDownUp className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-[13px] text-white/55 mb-2">내 언어</p>
                <button
                  type="button"
                  onClick={() => setLangPicker("my")}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <span className="flex items-center gap-2 text-white">
                    <span className="text-lg">{myM.flag}</span>
                    <span>{myM.native}</span>
                  </span>
                  <span className="flex items-center gap-2 text-white/45">
                    <span>›</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        void previewLangTts(myLang);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          void previewLangTts(myLang);
                        }
                      }}
                      className="text-base p-1"
                    >
                      🔊
                    </span>
                  </span>
                </button>

                <p className="text-[13px] text-white/55 mt-6 mb-2">표시 스타일</p>
                <div className="flex gap-2">
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
                      className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl text-[11px] text-white/90"
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

                <p className="text-[13px] text-white/55 mt-6 mb-2">입력 모드</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInputMode("realtime")}
                    className="flex-1 py-3 rounded-xl text-sm text-white/90"
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
                    className="flex-1 py-3 rounded-xl text-sm text-white/90"
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
                  onClick={() => void startLiveSession()}
                  className="w-full mt-8 py-3.5 rounded-xl font-semibold text-[#0a0a0f]"
                  style={{ background: "#ffffff" }}
                  whileTap={{ scale: 0.99 }}
                >
                  🎙 대화 시작
                </motion.button>

                <p className="text-[13px] text-white/45 mt-8 mb-2">대화 기록</p>
                <div className="space-y-2">
                  {pastSessions.length === 0 ? (
                    <p className="text-sm text-white/35">저장된 세션이 없어요</p>
                  ) : (
                    pastSessions.map((s) => {
                      const d = new Date(s.at);
                      const tf = langMeta(s.theirLang);
                      const mf = langMeta(s.myLang);
                      return (
                        <div
                          key={s.id}
                          className="flex items-center justify-between py-3 px-3 rounded-xl"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <div>
                            <p className="text-sm text-white/90">Realtime Translation</p>
                            <p className="text-xs text-white/45 mt-0.5">
                              {tf.flag} {mf.flag}
                            </p>
                          </div>
                          <p className="text-xs text-white/40 text-right">
                            {d.toLocaleDateString()}
                            <br />
                            {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 relative">
              <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    stopRealtime();
                    setPhase("setup");
                    setFlowStatus("idle");
                  }}
                  className="p-2 text-white/70 text-lg leading-none"
                  aria-label="뒤로"
                >
                  ←
                </button>
                <span className="text-sm font-medium text-white/90">실시간 번역</span>
                <button
                  type="button"
                  onClick={closeAll}
                  className="p-2 rounded-full hover:bg-white/10 text-white/80"
                  aria-label="닫기"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {errorMsg ? (
                <div className="shrink-0 px-3 py-2 text-center text-sm text-red-300">{errorMsg}</div>
              ) : null}

              {layoutMode === "single" && (
                <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
                  {inputMode === "realtime" && interim ? (
                    <p className="text-base text-white/70 mb-2 whitespace-pre-wrap break-words border border-white/10 rounded-xl px-3 py-2 bg-white/5">
                      {interim}
                      <span className="inline-block w-0.5 h-4 ml-0.5 bg-white/50 animate-pulse align-middle" />
                    </p>
                  ) : null}
                  {history.map((e) => renderEntryPair(e))}
                </div>
              )}

              {layoutMode === "face" && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div
                    className="min-h-0 flex-1 overflow-y-auto px-3 py-3 flex flex-col justify-end"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      transform: "rotate(180deg)",
                    }}
                  >
                    {myEntriesFace.map((e) => (
                      <div
                        key={e.id}
                        className="mb-3 max-w-[92%] mx-auto rounded-2xl px-3 py-3 text-center"
                        style={{
                          background: "rgba(255,255,255,0.08)",
                          transform: "rotate(180deg)",
                          borderRadius: 16,
                        }}
                      >
                        <p className="text-white font-semibold leading-snug" style={{ fontSize: transPx + 4 }}>
                          {e.translated}
                        </p>
                        <button
                          type="button"
                          onClick={() => void playTtsAudio(e.translated, e.toLang)}
                          className="mt-2 text-sm opacity-70"
                        >
                          🔊
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="shrink-0 border-y border-white/10 bg-[#0a0a0f]">{controlBar}</div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 flex flex-col justify-start">
                    {theirEntriesFace.map((e) => (
                      <div
                        key={e.id}
                        className="mb-3 max-w-[92%] rounded-2xl px-3 py-3"
                        style={{ background: "rgba(255,255,255,0.08)", borderRadius: 16 }}
                      >
                        <p className="text-white font-semibold leading-snug" style={{ fontSize: transPx + 2 }}>
                          {e.translated}
                        </p>
                        <button
                          type="button"
                          onClick={() => void playTtsAudio(e.translated, e.toLang)}
                          className="mt-2 text-sm opacity-70"
                        >
                          🔊
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {layoutMode === "side" && (
                <div className="flex-1 min-h-0 flex flex-row relative pb-[120px]">
                  <div className="flex-1 min-w-0 overflow-y-auto px-2 py-2 border-r border-white/10">
                    <p className="text-[11px] text-white/40 text-center mb-2">내 언어</p>
                    {history.map((e) => {
                      const primary = e.speaker === "me" ? e.original : e.translated;
                      const sub = e.speaker === "me" ? e.translated : e.original;
                      return (
                        <div
                          key={e.id + "L"}
                          className="mb-3 rounded-2xl px-3 py-2"
                          style={{ background: "rgba(255,255,255,0.08)" }}
                        >
                          <p className="text-[12px] text-white/45 whitespace-pre-wrap">{sub}</p>
                          <p
                            className="text-white font-medium mt-1 whitespace-pre-wrap"
                            style={{ fontSize: transPx }}
                          >
                            {primary}
                          </p>
                          <button
                            type="button"
                            onClick={() => void playTtsAudio(primary, myLang)}
                            className="mt-1 text-xs opacity-70"
                          >
                            🔊
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex-1 min-w-0 overflow-y-auto px-2 py-2">
                    <p className="text-[11px] text-white/40 text-center mb-2">상대 언어</p>
                    {history.map((e) => {
                      const primary = e.speaker === "me" ? e.translated : e.original;
                      const sub = e.speaker === "me" ? e.original : e.translated;
                      return (
                        <div
                          key={e.id + "R"}
                          className="mb-3 rounded-2xl px-3 py-2"
                          style={{ background: "rgba(255,255,255,0.08)" }}
                        >
                          <p className="text-[12px] text-white/45 whitespace-pre-wrap">{sub}</p>
                          <p
                            className="text-white font-medium mt-1 whitespace-pre-wrap"
                            style={{ fontSize: transPx }}
                          >
                            {primary}
                          </p>
                          <button
                            type="button"
                            onClick={() => void playTtsAudio(primary, theirLang)}
                            className="mt-1 text-xs opacity-70"
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
                  className="fixed left-0 right-0 bottom-0 z-[1101] mx-auto max-w-[430px] px-4 py-4 rounded-t-[20px]"
                  style={{ background: "#1a1a2e" }}
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                >
                  <p className="text-white font-medium mb-3">기록</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPastSessions([]);
                      saveSessions([]);
                      setSetupMenuOpen(false);
                    }}
                    className="w-full py-3 rounded-xl bg-white/10 text-white text-sm"
                  >
                    대화 기록 전체 삭제
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
