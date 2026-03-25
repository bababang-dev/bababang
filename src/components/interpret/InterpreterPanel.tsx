"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/stores/useStore";
import { useModalBodyLock } from "@/lib/useModalBodyLock";

export interface InterpretEntry {
  speaker: "me" | "them";
  original: string;
  translated: string;
  timestamp: Date;
}

const LANG_OPTIONS: { code: string; flag: string; label: string }[] = [
  { code: "zh", flag: "🇨🇳", label: "중국어" },
  { code: "en", flag: "🇺🇸", label: "영어" },
  { code: "ko", flag: "🇰🇷", label: "한국어" },
  { code: "ja", flag: "🇯🇵", label: "일본어" },
  { code: "hi", flag: "🇮🇳", label: "힌디어" },
  { code: "es", flag: "🇪🇸", label: "스페인어" },
  { code: "ar", flag: "🇸🇦", label: "아랍어" },
  { code: "fr", flag: "🇫🇷", label: "프랑스어" },
  { code: "id", flag: "🇮🇩", label: "인도네시아어" },
  { code: "pt", flag: "🇧🇷", label: "포르투갈어" },
  { code: "ru", flag: "🇷🇺", label: "러시아어" },
  { code: "de", flag: "🇩🇪", label: "독일어" },
  { code: "it", flag: "🇮🇹", label: "이탈리아어" },
  { code: "th", flag: "🇹🇭", label: "태국어" },
  { code: "pl", flag: "🇵🇱", label: "폴란드어" },
  { code: "ms", flag: "🇲🇾", label: "말레이시아어" },
  { code: "el", flag: "🇬🇷", label: "그리스어" },
  { code: "nl", flag: "🇳🇱", label: "네덜란드어" },
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

type LayoutMode = "single" | "face" | "side";
type InputMode = "realtime" | "push";

function LangGrid({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <div className="w-full max-w-[360px] mx-auto">
      <p className="text-center text-sm text-white/70 mb-2">{title}</p>
      <div className="grid grid-cols-3 gap-2">
        {LANG_OPTIONS.map((L) => {
          const sel = L.code === value;
          return (
            <button
              key={L.code}
              type="button"
              onClick={() => onChange(L.code)}
              className="rounded-xl px-2 py-2 text-left text-xs transition-colors"
              style={{
                border: sel ? "2px solid #6c5ce7" : "1px solid rgba(255,255,255,0.12)",
                background: sel ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.06)",
                color: sel ? "#e9d5ff" : "rgba(255,255,255,0.85)",
              }}
            >
              <span className="mr-1">{L.flag}</span>
              {L.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  const [speakerTurn, setSpeakerTurn] = useState<"me" | "them">("me");
  const [history, setHistory] = useState<InterpretEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [interim, setInterim] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
  }, [setInterpreterOpen]);

  const playTts = useCallback(async (text: string, langCode: string) => {
    if (!text.trim()) return;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: langCode }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = url;
        void audioRef.current.play();
      } else {
        const a = new Audio(url);
        void a.play();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const runPipeline = useCallback(
    async (original: string, from: string, to: string, speaker: "me" | "them") => {
      const trimmed = original.trim();
      if (!trimmed) return;
      setProcessing(true);
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
          speaker,
          original: trimmed,
          translated,
          timestamp: new Date(),
        };
        setHistory((h) => [...h, entry]);
        void playTts(translated, to);
        setSpeakerTurn((s) => (s === "me" ? "them" : "me"));
      } finally {
        setProcessing(false);
        setInterim("");
      }
    },
    [currentUserId, playTts]
  );

  const runPipelineRef = useRef(runPipeline);
  runPipelineRef.current = runPipeline;

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
        void runPipelineRef.current(ft, from, to, turn).finally(() => {
          busy = false;
        });
      }
    };
    rec.onerror = () => stopRealtime();
    rec.onend = () => {
      recognitionRef.current = null;
    };
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      setErrorMsg("음성인식을 시작할 수 없어요.");
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
  ]);

  const ensureMic = async () => {
    if (mediaStreamRef.current) return mediaStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;
    return stream;
  };

  const startPushRecord = async () => {
    if (processing || mediaRecorderRef.current) return;
    const turn = speakerTurn;
    const my = myLang;
    const their = theirLang;
    setErrorMsg("");
    try {
      const stream = await ensureMic();
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      recChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) recChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        void (async () => {
          const blob = new Blob(recChunksRef.current, { type: mime });
          if (blob.size < 100) {
            setProcessing(false);
            mediaRecorderRef.current = null;
            return;
          }
          const from = turn === "me" ? my : their;
          const to = turn === "me" ? their : my;
          const fd = new FormData();
          fd.append("audio", blob, "audio.webm");
          fd.append("lang", from);
          setProcessing(true);
          try {
            const wr = await fetch("/api/whisper", { method: "POST", body: fd });
            const wd = (await wr.json()) as { text?: string; error?: string };
            if (!wr.ok || !wd.text?.trim()) {
              setErrorMsg(wd.error || "음성 인식 실패");
              return;
            }
            await runPipeline(wd.text.trim(), from, to, turn);
          } finally {
            setProcessing(false);
            mediaRecorderRef.current = null;
          }
        })();
      };
      mediaRecorderRef.current = mr;
      mr.start();
    } catch {
      setErrorMsg("마이크 권한이 필요해요.");
    }
  };

  const stopPushRecord = () => {
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    mediaRecorderRef.current = null;
  };

  const myEntries = history.filter((e) => e.speaker === "me");
  const theirEntries = history.filter((e) => e.speaker === "them");

  const renderEntry = (e: InterpretEntry, accent: "me" | "them") => (
    <div
      key={e.timestamp.getTime() + e.original.slice(0, 8)}
      className="rounded-xl p-3 mb-2"
      style={{
        background:
          accent === "me" ? "rgba(108,92,231,0.12)" : "rgba(239,68,68,0.1)",
        border:
          accent === "me"
            ? "1px solid rgba(108,92,231,0.25)"
            : "1px solid rgba(239,68,68,0.2)",
      }}
    >
      <p className="text-[13px] text-white/55 whitespace-pre-wrap break-words">{e.original}</p>
      <div className="flex items-start gap-2 mt-1">
        <p
          className="flex-1 text-[20px] font-semibold leading-snug whitespace-pre-wrap break-words"
          style={{ color: accent === "me" ? "#a78bfa" : "#fb923c" }}
        >
          {e.translated}
        </p>
        <button
          type="button"
          onClick={() => void playTts(e.translated, accent === "me" ? theirLang : myLang)}
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-lg"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
          aria-label="재생"
        >
          🔊
        </button>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {interpreterOpen ? (
      <motion.div
        key="interpreter-panel"
        className="fixed inset-0 z-[1000] flex flex-col"
        style={{ background: "#0a0a0f" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <audio ref={audioRef} className="hidden" />

        {phase === "setup" ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-4 py-4">
            <div className="flex items-center justify-between shrink-0 mb-4">
              <h1 className="text-lg font-bold text-white" style={{ fontFamily: "Outfit, sans-serif" }}>
                🎙️ 동시통역
              </h1>
              <button
                type="button"
                onClick={closeAll}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white/80 bg-white/10"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-6 py-4">
              <LangGrid title="상대방 언어" value={theirLang} onChange={setTheirLang} />
              <LangGrid title="내 언어" value={myLang} onChange={setMyLang} />

              <div className="w-full max-w-[360px] mx-auto">
                <p className="text-center text-sm text-white/70 mb-2">스타일</p>
                <div className="flex gap-2">
                  {(
                    [
                      ["single", "단일"],
                      ["face", "대면"],
                      ["side", "나란히"],
                    ] as const
                  ).map(([k, lab]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setLayoutMode(k)}
                      className="flex-1 py-2 rounded-xl text-xs font-medium"
                      style={{
                        border:
                          layoutMode === k ? "2px solid #6c5ce7" : "1px solid rgba(255,255,255,0.12)",
                        background:
                          layoutMode === k ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.06)",
                        color: layoutMode === k ? "#e9d5ff" : "rgba(255,255,255,0.75)",
                      }}
                    >
                      {lab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full max-w-[360px] mx-auto">
                <p className="text-center text-sm text-white/70 mb-2">입력 모드</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInputMode("realtime")}
                    className="flex-1 py-3 rounded-xl text-sm font-medium"
                    style={{
                      border:
                        inputMode === "realtime"
                          ? "2px solid #6c5ce7"
                          : "1px solid rgba(255,255,255,0.12)",
                      background:
                        inputMode === "realtime"
                          ? "rgba(108,92,231,0.2)"
                          : "rgba(255,255,255,0.06)",
                      color: inputMode === "realtime" ? "#e9d5ff" : "rgba(255,255,255,0.75)",
                    }}
                  >
                    실시간
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode("push")}
                    className="flex-1 py-3 rounded-xl text-sm font-medium"
                    style={{
                      border:
                        inputMode === "push" ? "2px solid #6c5ce7" : "1px solid rgba(255,255,255,0.12)",
                      background:
                        inputMode === "push" ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.06)",
                      color: inputMode === "push" ? "#e9d5ff" : "rgba(255,255,255,0.75)",
                    }}
                  >
                    누르고 말하기
                  </button>
                </div>
              </div>

              <motion.button
                type="button"
                onClick={() => setPhase("live")}
                className="w-full max-w-[360px] mx-auto py-4 rounded-2xl text-white text-lg font-bold"
                style={{
                  background: "linear-gradient(135deg, #6c5ce7 0%, #8b5cf6 100%)",
                  boxShadow: "0 8px 32px rgba(108, 92, 231, 0.4)",
                }}
                whileTap={{ scale: 0.98 }}
              >
                대화 시작
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/10">
              <button
                type="button"
                onClick={() => {
                  stopRealtime();
                  setPhase("setup");
                }}
                className="text-sm text-white/60"
              >
                ← 설정
              </button>
              <span className="text-sm text-white/80 font-medium">동시통역</span>
              <button
                type="button"
                onClick={closeAll}
                className="w-9 h-9 rounded-full bg-white/10 text-white/90"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {errorMsg ? (
              <div className="shrink-0 px-3 py-2 text-center text-sm text-red-300">{errorMsg}</div>
            ) : null}

            <div
              className="flex-1 min-h-0 flex flex-col"
              style={
                layoutMode === "side"
                  ? { flexDirection: "row" }
                  : { flexDirection: "column" }
              }
            >
              {layoutMode === "single" && (
                <>
                  <div
                    className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
                    style={{ background: "rgba(108,92,231,0.05)" }}
                  >
                    <p className="text-xs text-white/45 mb-2 text-center">내 쪽 (말하면 상대방 언어로)</p>
                    {inputMode === "realtime" && speakerTurn === "me" && interim ? (
                      <p className="text-sm text-white/50 italic mb-2">{interim}</p>
                    ) : null}
                    {myEntries.map((e) => renderEntry(e, "me"))}
                  </div>
                  <div className="shrink-0 py-2 text-center text-xs text-white/50 border-y border-white/10">
                    {speakerTurn === "me" ? "🎤 내 차례" : "👂 상대방 차례"}
                    <button
                      type="button"
                      onClick={() => setSpeakerTurn((s) => (s === "me" ? "them" : "me"))}
                      className="ml-3 text-[#a78bfa] underline text-xs"
                    >
                      수동 전환
                    </button>
                  </div>
                  <div
                    className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
                    style={{ background: "rgba(239,68,68,0.05)" }}
                  >
                    <p className="text-xs text-white/45 mb-2 text-center">상대방 쪽</p>
                    {inputMode === "realtime" && speakerTurn === "them" && interim ? (
                      <p className="text-sm text-white/50 italic mb-2">{interim}</p>
                    ) : null}
                    {theirEntries.map((e) => renderEntry(e, "them"))}
                  </div>
                </>
              )}

              {layoutMode === "face" && (
                <>
                  <div
                    className="min-h-0 flex-1 overflow-y-auto px-3 py-2 flex flex-col justify-center"
                    style={{
                      background: "rgba(108,92,231,0.08)",
                      transform: "rotate(180deg)",
                    }}
                  >
                    <p
                      className="text-center text-xs text-white/45 mb-2"
                      style={{ transform: "rotate(180deg)" }}
                    >
                      상대방이 보는 화면 (내 말 → 번역)
                    </p>
                    {myEntries.slice(-3).map((e) => (
                      <div key={e.timestamp.getTime()} className="mb-2 text-center" style={{ transform: "rotate(180deg)" }}>
                        <p className="text-[22px] font-bold" style={{ color: "#a78bfa" }}>
                          {e.translated}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="shrink-0 py-2 text-center text-xs text-white/50 border-y border-white/10">
                    {speakerTurn === "me" ? "내 차례" : "상대방 차례"}
                    <button
                      type="button"
                      onClick={() => setSpeakerTurn((s) => (s === "me" ? "them" : "me"))}
                      className="ml-3 text-[#a78bfa] underline text-xs"
                    >
                      수동 전환
                    </button>
                  </div>
                  <div
                    className="min-h-0 flex-1 overflow-y-auto px-3 py-2 flex flex-col justify-center"
                    style={{ background: "rgba(239,68,68,0.06)" }}
                  >
                    <p className="text-center text-xs text-white/45 mb-2">내가 보는 화면</p>
                    {theirEntries.slice(-5).map((e) => (
                      <div key={e.timestamp.getTime()} className="mb-3">
                        <p className="text-[13px] text-white/50">{e.original}</p>
                        <p className="text-[20px] font-semibold" style={{ color: "#fb923c" }}>
                          {e.translated}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {layoutMode === "side" && (
                <>
                  <div
                    className="min-h-0 flex-1 overflow-y-auto px-2 py-2 border-r border-white/10"
                    style={{ background: "rgba(108,92,231,0.06)" }}
                  >
                    <p className="text-xs text-center text-white/45 mb-2">내 언어 영역</p>
                    {history.map((e) => (
                      <div key={e.timestamp.getTime() + e.speaker} className="mb-2 text-sm">
                        {e.speaker === "me" ? (
                          <>
                            <span className="text-white/40 text-[11px]">나 </span>
                            <span className="text-white/90">{e.original}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-white/40 text-[11px]">상대→나 </span>
                            <span style={{ color: "#fb923c" }}>{e.translated}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <div
                    className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
                    style={{ background: "rgba(239,68,68,0.06)" }}
                  >
                    <p className="text-xs text-center text-white/45 mb-2">상대방 언어 영역</p>
                    {history.map((e) => (
                      <div key={e.timestamp.getTime() + e.speaker + "r"} className="mb-2 text-sm">
                        {e.speaker === "them" ? (
                          <>
                            <span className="text-white/40 text-[11px]">상대 </span>
                            <span className="text-white/90">{e.original}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-white/40 text-[11px]">나→상대 </span>
                            <span style={{ color: "#a78bfa" }}>{e.translated}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {inputMode === "push" ? (
              <div
                className="shrink-0 flex flex-col items-center py-4 pb-[max(1rem,env(safe-area-inset-bottom))] gap-2 border-t border-white/10"
              >
                <p className="text-xs text-white/50">
                  {speakerTurn === "me" ? "내 차례 — 길게 눌러 말하기" : "상대방 차례 — 길게 눌러 말하기"}
                </p>
                <button
                  type="button"
                  disabled={processing}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    void startPushRecord();
                  }}
                  onPointerUp={() => stopPushRecord()}
                  onPointerLeave={() => stopPushRecord()}
                  className="w-20 h-20 rounded-full flex items-center justify-center text-3xl text-white disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #6c5ce7 0%, #a78bfa 100%)",
                    touchAction: "none",
                  }}
                >
                  🎤
                </button>
              </div>
            ) : (
              <div className="shrink-0 py-3 text-center text-xs text-white/45 border-t border-white/10">
                실시간 인식 중 · 차례는 발화 후 자동 전환됩니다
              </div>
            )}
          </div>
        )}
      </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
