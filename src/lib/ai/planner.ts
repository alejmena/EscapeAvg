import "server-only";
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { planDay as rulePlanDay, weeklyReview as ruleWeeklyReview, type DayPlan, type PlanInput, type PlannerProvider, type ReviewInput, type WeeklyReview } from "@/lib/domain/planner";
import { AI_PLAN_SCHEMA, AI_REVIEW_SCHEMA, PLAN_SYSTEM, REVIEW_SYSTEM, mergeAiPlan, mergeAiReview, planPrompt, reviewPrompt } from "@/lib/domain/planner-ai";

/**
 * Proveedor de planificación con Claude. Se activa solo si hay ANTHROPIC_API_KEY en el entorno; ante cualquier
 * fallo (red, tiempo de espera, rechazo o respuesta que no encaja con tus datos) devuelve el plan por reglas.
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
// La página espera la respuesta: mejor caer pronto a las reglas que dejarte mirando un esqueleto.
const TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 200;

export function aiPlannerEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 0 });
  return client;
}

// Misma entrada, misma respuesta: evita pagar otra llamada al recargar la página si tus datos no cambiaron.
const cache = new Map<string, { at: number; value: unknown }>();

function cached<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function remember(key: string, value: unknown) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
}

async function ask<S extends z.ZodType>(system: string, prompt: string, schema: S): Promise<z.infer<S> | null> {
  const key = createHash("sha256").update(`${MODEL}\n${system}\n${prompt}`).digest("hex");
  const hit = cached<z.infer<S>>(key);
  if (hit) return hit;
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens" || !response.parsed_output) return null;
  remember(key, response.parsed_output);
  return response.parsed_output;
}

async function planDay(input: PlanInput): Promise<DayPlan> {
  const base: DayPlan = { ...rulePlanDay(input), source: "rules" };
  if (input.tasks.length === 0) return base;
  try {
    const ai = await ask(PLAN_SYSTEM, planPrompt(input, base), AI_PLAN_SCHEMA);
    return (ai && mergeAiPlan(input, base, ai)) ?? base;
  } catch (error) {
    console.error("Plan con IA no disponible, se usan las reglas:", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
    return base;
  }
}

async function weeklyReview(input: ReviewInput): Promise<WeeklyReview> {
  const base: WeeklyReview = { ...ruleWeeklyReview(input), source: "rules" };
  // Sin actividad no hay nada que interpretar: el mensaje por reglas basta.
  if (!input.daily.some((d) => d.focus_seconds >= 60 || d.tasks_completed > 0 || d.habits_done > 0)) return base;
  try {
    const ai = await ask(REVIEW_SYSTEM, reviewPrompt(input, base), AI_REVIEW_SCHEMA);
    return (ai && mergeAiReview(base, ai)) ?? base;
  } catch (error) {
    console.error("Resumen con IA no disponible, se usan las reglas:", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
    return base;
  }
}

export const claudePlanner: PlannerProvider = { planDay, weeklyReview };
