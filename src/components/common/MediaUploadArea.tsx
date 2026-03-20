"use client";

import type { RefObject } from "react";
import { Camera, Plus, X } from "lucide-react";

export type MediaItem = { file: File; preview: string };

function isVideoFile(f: File) {
  return f.type.startsWith("video/");
}

type Props = {
  mediaItems: MediaItem[];
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (idx: number) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  accept: string;
  /** 하단 텍스트: "업로드 중... (2/5)" */
  uploadProgress: string | null;
  /** 현재 업로드 중인 인덱스 (오버레이+스피너) */
  uploadingIndex: number | null;
  maxFiles?: number;
  /** 비디오 프리뷰 (post만 true 권장) */
  allowVideoPreview?: boolean;
};

export function MediaUploadArea({
  mediaItems,
  onPick,
  onRemove,
  fileInputRef,
  accept,
  uploadProgress,
  uploadingIndex,
  maxFiles = 5,
  allowVideoPreview = false,
}: Props) {
  const openPicker = () => fileInputRef.current?.click();
  const canAddMore = mediaItems.length < maxFiles;
  const isBusy = uploadProgress != null;

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={onPick}
      />

      {mediaItems.length === 0 ? (
        <button
          type="button"
          onClick={openPicker}
          className="w-full rounded-2xl flex flex-col items-center justify-center gap-1.5 px-4 py-6 bg-white/50 transition-colors hover:bg-white/80 active:scale-[0.99]"
          style={{
            height: 120,
            border: "2px dashed rgba(108, 92, 231, 0.3)",
          }}
        >
          <Camera className="w-8 h-8 text-[#a78bfa]" strokeWidth={1.5} />
          <span className="text-[13px] text-black/45">사진/영상을 추가해보세요</span>
          <span className="text-[11px] text-black/35">최대 5개, 10MB 이하</span>
        </button>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin items-center" style={{ minHeight: 100 }}>
            {mediaItems.map((m, idx) => (
              <div
                key={m.preview + idx}
                className="relative w-[100px] h-[100px] flex-shrink-0 rounded-xl overflow-hidden bg-black/10"
              >
                {allowVideoPreview && isVideoFile(m.file) ? (
                  <video src={m.preview} className="w-full h-full object-cover" muted playsInline />
                ) : (
                  <img src={m.preview} alt="" className="w-full h-full object-cover" />
                )}
                {uploadingIndex !== null && (
                  <div
                    className={`absolute inset-0 flex items-center justify-center ${
                      uploadingIndex === idx ? "bg-black/45" : "bg-black/25"
                    }`}
                  >
                    {uploadingIndex === idx && (
                      <div className="w-7 h-7 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    )}
                  </div>
                )}
                {!isBusy && (
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md"
                    aria-label="삭제"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {canAddMore && !isBusy && (
              <button
                type="button"
                onClick={openPicker}
                className="w-[100px] h-[100px] flex-shrink-0 rounded-xl flex items-center justify-center border-2 border-dashed border-[rgba(108,92,231,0.35)] bg-white/40 text-[#a78bfa] hover:bg-white/70"
                aria-label="추가"
              >
                <Plus className="w-8 h-8" strokeWidth={1.5} />
              </button>
            )}
          </div>
          <p className="text-xs text-black/45 mt-1.5">
            {mediaItems.length}/{maxFiles}
          </p>
        </>
      )}

      {uploadProgress && (
        <p className="text-[13px] text-accent mt-2 font-medium">{uploadProgress}</p>
      )}
    </div>
  );
}
