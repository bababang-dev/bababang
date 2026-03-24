"use client";

import { useEffect } from "react";

let lockCount = 0;

/** 모달이 열릴 때 html/body 스크롤 잠금 (여러 모달 중첩 시 ref-count) */
export function useModalBodyLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockCount += 1;
    if (lockCount === 1) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.documentElement.style.overflow = "";
        document.body.style.overflow = "";
      }
    };
  }, [active]);
}
