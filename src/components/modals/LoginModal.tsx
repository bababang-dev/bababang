"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, Camera, Loader2 } from "lucide-react";
import { useStore, type LoginUserPayload } from "@/stores/useStore";
import { useModalBodyLock } from "@/lib/useModalBodyLock";
import type { Lang } from "@/types";

type Step = "main" | "phone" | "otp" | "profile";

function WeChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="white"
        d="M8.5 10.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zm7 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM4 16.2c.8-2.4 3-4.1 5.6-4.1.4 0 .8 0 1.2.1-.2-.6-.3-1.2-.3-1.8 0-3.5 3.4-6.4 7.5-6.4 3.8 0 7 2.5 7.5 5.8-2.2-1.2-4.7-1.9-7.5-1.9-3.4 0-6.5 1.2-8.8 3.2l.8-1.9z"
      />
      <path
        fill="white"
        opacity="0.9"
        d="M3 19.5c2.5-2.8 6.3-4.5 10.5-4.5 1.2 0 2.4.1 3.5.4-.5-3.2-3.8-5.7-7.8-5.7-3.2 0-6 1.6-7.5 4l1.3 2.8z"
      />
    </svg>
  );
}

function AlipayIcon() {
  return (
    <div className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center text-white text-sm font-bold">
      支
    </div>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.25 1.6-1.8 4.7-5.5 4.7-3.3 0-6-2.7-6-6s2.7-6 6-6c1.7 0 2.8.7 3.4 1.3l2.3-2.2C16.9 3.7 14.7 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-1.5H12z"
      />
      <path fill="#4285F4" d="M3.5 7.1l3.3 2.4c.9-2.4 3.4-4.1 5.2-4.1 1.7 0 2.8.7 3.4 1.3l2.3-2.2C16.9 3.7 14.7 2.5 12 2.5 8 2.5 4.7 4.5 3.5 7.1z" />
      <path fill="#FBBC05" d="M12 21.5c2.6 0 4.8-.9 6.4-2.4l-3-2.3c-.8.5-1.9.9-3.4.9-2.6 0-4.8-1.7-5.6-4.1l-3.1 2.4c1.5 3 4.6 5.5 8.7 5.5z" />
      <path fill="#34A853" d="M21.3 12.2c0-.8-.1-1.5-.3-2.2H12v4.3h5.3c-.3 1.6-1.1 2.8-2.3 3.6l3 2.3c1.8-1.7 2.8-4.1 2.8-7z" />
    </svg>
  );
}

export function LoginModal() {
  const loginModalOpen = useStore((s) => s.loginModalOpen);
  const closeLoginModal = useStore((s) => s.closeLoginModal);
  const login = useStore((s) => s.login);
  const lang = useStore((s) => s.lang);

  useModalBodyLock(loginModalOpen);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("main");
  const [toast, setToast] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState("+86");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(60);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(() => {
    if (!loginModalOpen) return;
    setStep("main");
    setCountryCode("+86");
    setPhoneDigits("");
    setOtp("");
    setTimer(60);
    setAvatarUrl(null);
    setNickname("");
    setSendingCode(false);
    setVerifyingOtp(false);
    setAiLoading(false);
    setUploading(false);
  }, [loginModalOpen]);

  useEffect(() => {
    if (step !== "otp" || timer <= 0) return;
    const t = window.setInterval(() => setTimer((s) => s - 1), 1000);
    return () => window.clearInterval(t);
  }, [step, timer]);

  const fullPhone = `${countryCode}${phoneDigits.replace(/\D/g, "")}`;
  const maskedHint =
    phoneDigits.length >= 4
      ? `${countryCode} ${phoneDigits.slice(0, 3)}****${phoneDigits.slice(-4)}`
      : fullPhone;

  const persistAndLogin = useCallback(
    (u: {
      id: number;
      nickname: string;
      avatar: string;
      plan: string;
      tokens: number;
      language: string;
    }) => {
      const language: Lang = u.language === "zh" ? "zh" : "ko";
      const plan: LoginUserPayload["plan"] =
        u.plan === "premium" || u.plan === "pro" ? "premium" : "free";
      const payload: LoginUserPayload = {
        id: u.id,
        nickname: u.nickname,
        avatar: u.avatar,
        phone: fullPhone,
        plan,
        tokens: u.tokens,
        language,
      };
      localStorage.setItem(
        "bababang-user",
        JSON.stringify({
          id: u.id,
          nickname: u.nickname,
          avatar: u.avatar,
          lang: u.language ?? language,
          phone: fullPhone,
        })
      );
      login(payload);
    },
    [login, fullPhone]
  );

  const onPhoneSubmit = async () => {
    const d = phoneDigits.replace(/\D/g, "");
    if (d.length < 6) {
      showToast("폰번호를 확인해주세요");
      return;
    }
    setSendingCode(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        showToast(data.error ?? "인증번호 발송에 실패했어요");
        return;
      }
      setOtp("");
      setTimer(60);
      setStep("otp");
    } catch {
      showToast("네트워크 오류가 났어요");
    } finally {
      setSendingCode(false);
    }
  };

  const resendCode = async () => {
    setSendingCode(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        showToast(data.error ?? "재발송에 실패했어요");
        return;
      }
      setTimer(60);
      showToast("인증번호를 다시 보냈어요");
    } catch {
      showToast("네트워크 오류가 났어요");
    } finally {
      setSendingCode(false);
    }
  };

  const onOtpSubmit = async () => {
    if (otp.length !== 6) {
      showToast("인증번호 6자리를 입력해주세요");
      return;
    }
    setVerifyingOtp(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, code: otp }),
      });
      const data = (await res.json()) as {
        error?: string;
        isNewUser?: boolean;
        user?: {
          id: number;
          nickname: string;
          avatar: string;
          plan: string;
          tokens: number;
          language: string;
        };
        phone?: string;
      };
      if (!res.ok) {
        showToast(data.error ?? "인증에 실패했어요");
        return;
      }
      if (data.isNewUser) {
        setStep("profile");
        return;
      }
      if (data.user) {
        persistAndLogin(data.user);
      }
    } catch {
      showToast("네트워크 오류가 났어요");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) {
        setAvatarUrl(data.url);
      } else {
        showToast(data.error ?? "업로드에 실패했어요");
      }
    } catch {
      showToast("업로드에 실패했어요");
    } finally {
      setUploading(false);
    }
  };

  const handleAIAvatar = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoUrl: avatarUrl && avatarUrl.startsWith("http") ? avatarUrl : undefined,
        }),
      });
      const data = (await res.json()) as { success?: boolean; url?: string; error?: string };
      if (data.url) {
        setAvatarUrl(data.url);
      } else {
        alert(data.error || "생성에 실패했어요. 다시 시도해주세요");
      }
    } catch {
      alert("생성에 실패했어요. 다시 시도해주세요");
    } finally {
      setAiLoading(false);
    }
  };

  const hasPhotoForAi = Boolean(avatarUrl && avatarUrl.startsWith("http"));

  const onFinish = async () => {
    const nick = nickname.trim();
    if (!nick) {
      showToast("닉네임을 입력해주세요");
      return;
    }
    const avatar = avatarUrl?.trim() ? avatarUrl.trim() : "👤";
    const language: Lang = lang === "zh" ? "zh" : "ko";
    console.log("[LoginModal] register body avatar:", avatar, "| avatarUrl state:", avatarUrl);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: fullPhone,
          nickname: nick,
          avatar,
          language,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        user?: LoginUserPayload & { language?: string };
      };
      if (!res.ok || !data.user) {
        showToast(data.error ?? "가입에 실패했어요");
        return;
      }
      const u = data.user;
      console.log("[LoginModal] register response user.avatar:", u.avatar);
      const payload: LoginUserPayload = {
        id: u.id,
        nickname: u.nickname,
        avatar: u.avatar,
        phone: fullPhone,
        plan: u.plan,
        tokens: u.tokens,
        language: (u.language === "zh" ? "zh" : "ko") as Lang,
      };
      localStorage.setItem(
        "bababang-user",
        JSON.stringify({
          id: u.id,
          nickname: u.nickname,
          avatar: u.avatar,
          lang: u.language ?? language,
          phone: fullPhone,
        })
      );
      console.log("[LoginModal] login() payload.avatar:", payload.avatar);
      login(payload);
    } catch {
      showToast("네트워크 오류가 났어요");
    }
  };

  const socialComingSoon = (name: string) => {
    showToast(`🔜 ${name} 로그인은 준비 중이에요. 곧 오픈할게요!`);
  };

  if (!loginModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[210] flex flex-col justify-end pointer-events-none">
      <AnimatePresence>
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/55 backdrop-blur-sm pointer-events-auto"
          onClick={closeLoginModal}
        />
      </AnimatePresence>

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="relative z-10 w-full max-w-[430px] mx-auto pointer-events-auto rounded-t-[24px] glass-dark border border-white/10 border-b-0 px-5 pt-4 pb-8 max-h-[90vh] overflow-y-auto scrollbar-thin"
      >
        {step === "main" && (
          <>
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <h2 className="text-lg font-bold text-white">로그인이 필요해요</h2>
                <p className="text-[13px] text-white/50 mt-1">
                  BabaBang의 모든 기능을 이용해보세요
                </p>
              </div>
              <button
                type="button"
                onClick={closeLoginModal}
                className="p-2 rounded-full hover:bg-white/10 -mr-1"
                aria-label="닫기"
              >
                <X className="w-5 h-5 text-white/80" />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => setStep("phone")}
                className="w-full h-[52px] rounded-xl text-white font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
                style={{
                  background: "linear-gradient(135deg, #6c5ce7 0%, #8b5cf6 100%)",
                }}
              >
                <span>📱</span> 폰번호로 시작하기
              </button>

              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-white/15" />
                <span className="text-xs text-white/45 shrink-0">또는 간편 로그인</span>
                <div className="flex-1 h-px bg-white/15" />
              </div>

              <button
                type="button"
                onClick={() => socialComingSoon("위챗")}
                className="w-full h-12 rounded-xl text-white font-medium text-sm flex items-center gap-3 px-4 active:scale-[0.99]"
                style={{ background: "#07C160" }}
              >
                <WeChatIcon />
                <span className="flex-1 text-left">위챗으로 로그인</span>
              </button>
              <button
                type="button"
                onClick={() => socialComingSoon("알리페이")}
                className="w-full h-12 rounded-xl text-white font-medium text-sm flex items-center gap-3 px-4 active:scale-[0.99]"
                style={{ background: "#1677FF" }}
              >
                <AlipayIcon />
                <span className="flex-1 text-left">알리페이로 로그인</span>
              </button>
              <button
                type="button"
                onClick={() => socialComingSoon("Apple")}
                className="w-full h-12 rounded-xl text-white font-medium text-sm flex items-center gap-3 px-4 bg-black active:scale-[0.99]"
              >
                <AppleIcon />
                <span className="flex-1 text-left">Apple로 로그인</span>
              </button>
              <button
                type="button"
                onClick={() => socialComingSoon("Google")}
                className="w-full h-12 rounded-xl font-medium text-sm flex items-center gap-3 px-4 bg-white text-black border border-[#ddd] active:scale-[0.99]"
              >
                <GoogleIcon />
                <span className="flex-1 text-left">Google로 로그인</span>
              </button>
            </div>

            <button
              type="button"
              onClick={closeLoginModal}
              className="w-full mt-6 py-2 text-sm text-white/45"
            >
              둘러보기
            </button>
          </>
        )}

        {step === "phone" && (
          <>
            <button
              type="button"
              onClick={() => setStep("main")}
              className="flex items-center gap-1 text-white/70 text-sm mb-4 -ml-1"
            >
              <ChevronLeft className="w-5 h-5" />
              뒤로
            </button>
            <h2 className="text-lg font-bold text-white">폰번호로 시작하기</h2>
            <div className="mt-4 flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="rounded-xl bg-white/10 border border-white/10 px-3 py-3 text-sm text-white outline-none"
              >
                <option value="+86">+86</option>
                <option value="+82">+82</option>
              </select>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="폰번호를 입력해주세요"
                value={phoneDigits}
                onChange={(e) => setPhoneDigits(e.target.value.replace(/[^\d]/g, "").slice(0, 15))}
                className="flex-1 rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none"
              />
            </div>
            <button
              type="button"
              disabled={sendingCode}
              onClick={() => void onPhoneSubmit()}
              className="w-full mt-6 h-12 rounded-xl text-white font-semibold disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #6c5ce7 0%, #8b5cf6 100%)" }}
            >
              {sendingCode ? "발송 중…" : "인증번호 받기"}
            </button>
          </>
        )}

        {step === "otp" && (
          <>
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="flex items-center gap-1 text-white/70 text-sm mb-4 -ml-1"
            >
              <ChevronLeft className="w-5 h-5" />
              뒤로
            </button>
            <h2 className="text-lg font-bold text-white">인증번호를 입력해주세요</h2>
            <p className="text-[13px] text-white/50 mt-1">{maskedHint}로 발송했어요</p>
            <div className="relative mt-6 flex gap-2 justify-center min-h-[48px]">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="absolute inset-0 z-10 w-full h-12 opacity-0 cursor-text"
                aria-label="인증번호 6자리"
              />
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`pointer-events-none w-10 h-12 rounded-lg border text-lg font-semibold text-white flex items-center justify-center ${
                    otp[i] ? "border-accent bg-white/10" : "border-white/20 bg-white/5"
                  }`}
                >
                  {otp[i] ?? ""}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-white/50">
                {timer > 0 ? `${timer}초` : "시간 만료"}
              </span>
              <button
                type="button"
                disabled={sendingCode}
                onClick={() => void resendCode()}
                className="text-sm text-accent disabled:opacity-50"
              >
                재발송
              </button>
            </div>
            <button
              type="button"
              disabled={verifyingOtp}
              onClick={() => void onOtpSubmit()}
              className="w-full mt-6 h-12 rounded-xl text-white font-semibold disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #6c5ce7 0%, #8b5cf6 100%)" }}
            >
              {verifyingOtp ? "확인 중…" : "확인"}
            </button>
          </>
        )}

        {step === "profile" && (
          <>
            <button
              type="button"
              onClick={() => setStep("otp")}
              className="flex items-center gap-1 text-white/70 text-sm mb-4 -ml-1"
            >
              <ChevronLeft className="w-5 h-5" />
              뒤로
            </button>
            <h2 className="text-lg font-bold text-white text-center">프로필을 설정해주세요</h2>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />

            <div className="flex flex-col items-center mt-6">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="relative w-[120px] h-[120px] rounded-full overflow-hidden flex items-center justify-center shrink-0 disabled:opacity-60"
                style={{
                  border: "2px solid var(--accent, #8b5cf6)",
                  background: avatarUrl ? undefined : "rgba(255,255,255,0.08)",
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="프로필" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-white/45">
                    <Camera className="w-10 h-10" strokeWidth={1.5} />
                    <span className="text-[11px]">사진 추가</span>
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                  </div>
                )}
              </button>

              {aiLoading && (
                <p className="text-sm text-white/70 mt-4 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  🎨 캐릭터를 그리고 있어요... (10~15초)
                </p>
              )}

              <button
                type="button"
                disabled={aiLoading}
                onClick={() => void handleAIAvatar()}
                className="mt-4 text-sm font-medium disabled:opacity-60"
                style={{ color: "var(--accent, #a78bfa)" }}
              >
                {aiLoading
                  ? "🎨 캐릭터를 그리고 있어요... (10~15초)"
                  : hasPhotoForAi
                    ? "✨ 내 사진으로 캐릭터 만들기"
                    : "✨ 랜덤 캐릭터 생성"}
              </button>
            </div>

            <input
              type="text"
              placeholder="닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={50}
              className="w-full mt-6 rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none"
            />
            <button
              type="button"
              onClick={() => void onFinish()}
              className="w-full mt-6 h-[52px] rounded-xl text-white font-semibold"
              style={{ background: "linear-gradient(135deg, #6c5ce7 0%, #8b5cf6 100%)" }}
            >
              시작하기
            </button>
          </>
        )}
      </motion.div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed top-10 left-1/2 -translate-x-1/2 z-[220] glass-dark px-5 py-3 rounded-2xl text-sm text-white/95 max-w-[90%] text-center pointer-events-none shadow-lg border border-white/10"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
