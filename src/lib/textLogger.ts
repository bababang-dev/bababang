import pool from "@/lib/db";

export type TextLogType =
  | "chat"
  | "translate_text"
  | "translate_photo"
  | "translate_voice"
  | "interpret"
  | "ai_write"
  | "community_post"
  | "community_comment";

export async function logText(params: {
  userId?: number;
  type: TextLogType;
  inputText: string;
  outputText: string;
  inputLang?: string;
  outputLang?: string;
  tokensUsed?: number;
  costEstimate?: number;
}) {
  try {
    await pool.query(
      "INSERT INTO text_logs (user_id, type, input_text, output_text, input_lang, output_lang, tokens_used, cost_estimate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        params.userId || null,
        params.type,
        (params.inputText || "").slice(0, 5000),
        (params.outputText || "").slice(0, 5000),
        params.inputLang || null,
        params.outputLang || null,
        params.tokensUsed || 0,
        params.costEstimate || 0,
      ]
    );
  } catch (e) {
    console.log("=== 텍스트 로그 저장 실패 ===", e);
  }
}
