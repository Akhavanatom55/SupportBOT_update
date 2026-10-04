import { db } from "@/db";
import { geminiKeys } from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { env } from "@/lib/env";

export type ChatTurn = { role: "user" | "model"; text: string };

export type GeminiResult =
  | { ok: true; text: string; keyLabel: string }
  | { ok: false; quotaExhausted: boolean; message: string };

const QUOTA_ERROR_HINTS = [
  "quota",
  "resource_exhausted",
  "rate limit",
  "429",
  "too many requests",
];

function isQuotaError(statusCode: number, bodyText: string): boolean {
  if (statusCode === 429) return true;
  const lower = bodyText.toLowerCase();
  return QUOTA_ERROR_HINTS.some((hint) => lower.includes(hint));
}

async function callGeminiOnce(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: ChatTurn[],
): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    generationConfig: {
      maxOutputTokens: 500,
      temperature: 0.6,
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, body: text };
    }
    const json = JSON.parse(text) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const replyText = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
    if (!replyText.trim()) {
      return { ok: false, status: 200, body: "پاسخ خالی از مدل دریافت شد" };
    }
    return { ok: true, text: replyText.trim() };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: error instanceof Error ? error.message : "خطای شبکه در ارتباط با Gemini",
    };
  }
}

/**
 * Tries every configured, non-exhausted Gemini key (ordered by priority) until
 * one succeeds. Exhausted/quota-limited keys are marked in the DB so future
 * requests skip them until the next daily reset. Returns quotaExhausted=true
 * only when every key failed because of quota/rate issues, which the caller
 * should use to silently fall back to canned replies for end-users while
 * still alerting admins.
 */
export async function generateAiReply(
  systemPrompt: string,
  history: ChatTurn[],
  modelOverride?: string,
): Promise<GeminiResult & { errorsForAdmins?: string[] }> {
  await resetExpiredExhaustedKeys();

  const keys = await db
    .select()
    .from(geminiKeys)
    .where(and(eq(geminiKeys.isActive, true), eq(geminiKeys.isExhausted, false)))
    .orderBy(asc(geminiKeys.priority), asc(geminiKeys.id));

  const fallbackEnvKey = env.geminiApiKey;
  const candidateKeys = keys.length > 0
    ? keys
    : fallbackEnvKey
      ? [{ id: -1, label: "ENV_DEFAULT", apiKey: fallbackEnvKey } as unknown as typeof keys[number]]
      : [];

  if (candidateKeys.length === 0) {
    return {
      ok: false,
      quotaExhausted: true,
      message: "هیچ کلید Gemini فعالی تنظیم نشده است.",
      errorsForAdmins: ["⚠️ هیچ کلید Gemini فعالی در پنل ادمین تنظیم نشده است."],
    };
  }

  const model = modelOverride || env.geminiModel;
  const errorsForAdmins: string[] = [];

  for (const key of candidateKeys) {
    const result = await callGeminiOnce(key.apiKey, model, systemPrompt, history);
    if (result.ok) {
      if (key.id !== -1) {
        await db
          .update(geminiKeys)
          .set({ lastUsedAt: new Date(), successCount: sql`${geminiKeys.successCount} + 1` })
          .where(eq(geminiKeys.id, key.id));
      }
      return { ok: true, text: result.text, keyLabel: key.label };
    }

    const quota = isQuotaError(result.status, result.body);
    if (key.id !== -1) {
      await db
        .update(geminiKeys)
        .set({
          lastErrorAt: new Date(),
          lastErrorMessage: result.body.slice(0, 500),
          isExhausted: quota ? true : undefined,
          errorCount: sql`${geminiKeys.errorCount} + 1`,
        })
        .where(eq(geminiKeys.id, key.id));
    }

    if (quota) {
      errorsForAdmins.push(
        `⛔️ کلید Gemini «${key.label}» به محدودیت (Quota/Rate limit) خورد و موقتاً غیرفعال شد.`,
      );
    } else {
      errorsForAdmins.push(
        `❌ خطا در فراخوانی Gemini با کلید «${key.label}»: ${result.body.slice(0, 300)}`,
      );
      // Non-quota errors (bad key, network) shouldn't block trying the next key either.
    }
  }

  return {
    ok: false,
    quotaExhausted: true,
    message: "تمام کلیدهای Gemini در دسترس ناموفق بودند.",
    errorsForAdmins,
  };
}

async function resetExpiredExhaustedKeys() {
  const exhausted = await db.select().from(geminiKeys).where(eq(geminiKeys.isExhausted, true));
  const now = new Date();
  for (const key of exhausted) {
    const lastError = key.lastErrorAt ? new Date(key.lastErrorAt) : null;
    const isDifferentUtcDay =
      !lastError ||
      lastError.getUTCFullYear() !== now.getUTCFullYear() ||
      lastError.getUTCMonth() !== now.getUTCMonth() ||
      lastError.getUTCDate() !== now.getUTCDate();
    // Gemini free tier daily quotas reset at midnight Pacific; being lenient
    // and resetting once a UTC day has passed avoids keys staying stuck.
    if (isDifferentUtcDay) {
      await db.update(geminiKeys).set({ isExhausted: false }).where(eq(geminiKeys.id, key.id));
    }
  }
}
