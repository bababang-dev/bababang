"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/stores/useStore";
import { showMapOptions } from "@/lib/deeplinks";

export function MapActionSheet() {
  const mapActionSheet = useStore((s) => s.mapActionSheet);
  const closeMapActionSheet = useStore((s) => s.closeMapActionSheet);

  const open = mapActionSheet != null && mapActionSheet.open;
  const destLat = mapActionSheet?.destLat ?? "";
  const destLng = mapActionSheet?.destLng ?? "";
  const destName = mapActionSheet?.destName ?? "";
  const destAddress = mapActionSheet?.destAddress ?? "";
  const koreanName = mapActionSheet?.koreanName ?? "";

  const options = destName ? showMapOptions(destLat, destLng, destName) : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="map-action-sheet"
          className="fixed inset-0 z-[95] flex flex-col justify-end pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label="닫기"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => closeMapActionSheet()}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-[430px] mx-auto rounded-t-2xl border border-white/10 px-4 pt-3 pointer-events-auto"
            style={{
              paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
              background: "rgba(18, 18, 24, 0.85)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="mb-4 px-1">
              {koreanName ? (
                <>
                  <p className="text-lg font-semibold text-white">{koreanName}</p>
                  <p className="mt-0.5 text-sm text-white/50">{destName}</p>
                </>
              ) : (
                <p className="text-lg font-semibold text-white">{destName}</p>
              )}
              {destAddress ? (
                <p className="mt-2 text-sm text-white/60">{destAddress}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 pb-2">
              {options.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    opt.action();
                    closeMapActionSheet();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-left text-sm text-white/95 hover:bg-white/15"
                >
                  <span className="text-lg" aria-hidden>
                    {opt.icon}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => closeMapActionSheet()}
              className="mb-2 w-full rounded-xl border border-white/15 py-3 text-sm text-white/80"
            >
              닫기
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
