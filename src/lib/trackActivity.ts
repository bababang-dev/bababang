import { useStore } from "@/stores/useStore";

export type ActivityType =
  | "view_post"
  | "view_place"
  | "search"
  | "ask_ai"
  | "bookmark"
  | "click_category";

/** 숫자-only id가 아니면 target_id 생략 */
function parseTargetId(id: string | number | undefined): number | undefined {
  if (id == null) return undefined;
  const n = typeof id === "number" ? id : parseInt(String(id).replace(/\D/g, "") || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function trackActivity(
  activityType: ActivityType,
  category?: string,
  keyword?: string,
  targetId?: string | number
) {
  try {
    const userId = useStore.getState().currentUserId ?? 1;
    await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        activityType,
        category: category ?? null,
        keyword: keyword ?? null,
        targetId: parseTargetId(targetId),
      }),
    });
  } catch {
    /* ignore */
  }
}
