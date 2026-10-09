import { z } from "zod";
import { isISODate } from "@/lib/domain/dates";

const uuid = z.string().uuid();
const optionalUuid = uuid.nullable().optional();
const isoDate = z.string().refine(isISODate, "Fecha inválida");
const trimmed = (max: number) => z.string().trim().min(1, "Obligatorio").max(max, `Máximo ${max} caracteres`);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));
export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido");

export const recurrenceSchema = z
  .object({
    freq: z.enum(["daily", "weekly", "monthly"]),
    interval: z.number().int().min(1).max(365),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  })
  .nullable()
  .optional();

export const taskInput = z
  .object({
    title: trimmed(200),
    notes: optionalText(10000),
    priority: z.number().int().min(0).max(3).default(0),
    due_date: isoDate.nullable().optional(),
    category_id: optionalUuid,
    project_id: optionalUuid,
    parent_id: optionalUuid,
    estimated_minutes: z.number().int().min(1).max(10000).nullable().optional(),
    progress_target: z.number().int().min(1).max(100000).nullable().optional(),
    progress_current: z.number().int().min(0).max(100000).optional(),
    progress_unit: optionalText(30),
    recurrence: recurrenceSchema,
  })
  .strict();
export type TaskInput = z.input<typeof taskInput>;

// parent_id no se puede cambiar después de crear (evita ciclos de subtareas).
export const taskUpdate = taskInput.partial().omit({ parent_id: true }).extend({ status: z.enum(["todo", "in_progress", "done", "archived"]).optional() });
export type TaskUpdate = z.input<typeof taskUpdate>;

export const projectInput = z
  .object({
    name: trimmed(80),
    description: optionalText(5000),
    category_id: optionalUuid,
    target_date: isoDate.nullable().optional(),
  })
  .strict();

export const categoryInput = z.object({ name: trimmed(40), color: hexColor }).strict();

export const startSessionInput = z
  .object({
    kind: z.enum(["pomodoro", "stopwatch", "just_start", "break"]),
    task_id: optionalUuid,
    planned_seconds: z.number().int().min(60).max(14400).nullable().optional(),
  })
  .strict()
  .refine((v) => v.kind === "stopwatch" || v.planned_seconds, { message: "Duración obligatoria" });

export const manualSessionInput = z
  .object({
    task_id: optionalUuid,
    minutes: z.number().int().min(1).max(720),
    ended_at: z.string().datetime({ offset: true }).optional(),
    note: optionalText(1000),
  })
  .strict();

export const interruptionInput = z
  .object({ session_id: uuid, kind: z.enum(["internal", "external"]), note: optionalText(280) })
  .strict();

export const habitInput = z
  .object({
    name: trimmed(60),
    description: optionalText(500),
    category_id: optionalUuid,
    color: hexColor,
    frequency: z.enum(["daily", "weekly", "specific_days"]),
    times_per_week: z.number().int().min(1).max(7).nullable().optional(),
    days_of_week: z.array(z.number().int().min(0).max(6)).max(7).nullable().optional(),
    target_value: z.number().positive().max(100000).nullable().optional(),
    unit: optionalText(20),
    streaks_enabled: z.boolean().default(true),
  })
  .strict()
  .refine((v) => v.frequency !== "weekly" || v.times_per_week, { message: "Indica cuántas veces por semana", path: ["times_per_week"] })
  .refine((v) => v.frequency !== "specific_days" || (v.days_of_week && v.days_of_week.length > 0), {
    message: "Elige al menos un día",
    path: ["days_of_week"],
  });
export type HabitInput = z.input<typeof habitInput>;

export const habitLogInput = z
  .object({
    habit_id: uuid,
    log_date: isoDate,
    status: z.enum(["done", "skipped", "rest"]).nullable(), // null = borrar el registro
    value: z.number().min(0).max(100000).nullable().optional(),
  })
  .strict();

export const goalInput = z
  .object({
    title: trimmed(120),
    description: optionalText(1000),
    metric: z.enum(["focus_minutes", "tasks_completed", "habit_completions", "manual"]),
    period: z.enum(["weekly", "monthly", "custom"]),
    start_date: isoDate.nullable().optional(),
    end_date: isoDate.nullable().optional(),
    target_value: z.number().positive().max(1000000),
    category_id: optionalUuid,
  })
  .strict()
  .refine((v) => v.period !== "custom" || (v.start_date && v.end_date && v.end_date >= v.start_date), {
    message: "Indica un rango válido",
    path: ["end_date"],
  });

export const socialProfileInput = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_]{3,24}$/, "De 3 a 24 caracteres: letras sin acentos, números o _")
      .nullable(),
    share_stats: z.boolean(),
  })
  .strict();

export const usernameInput = z.string().trim().toLowerCase().min(1, "Escribe un nombre de usuario").max(24, "Máximo 24 caracteres");

export const groupInput = z
  .object({
    name: trimmed(60),
    description: optionalText(300),
  })
  .strict();

export const inviteCodeInput = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]{6,32}$/, "Código no válido");

export const sharedChallengeInput = z
  .object({
    group_id: uuid,
    title: trimmed(80),
    metric: z.enum(["focus_minutes", "tasks_completed", "habit_completions", "active_days"]),
    target_value: z.number().int().min(1, "La meta debe ser al menos 1").max(100000),
    start_date: isoDate,
    end_date: isoDate,
  })
  .strict()
  .refine((v) => v.end_date >= v.start_date, { message: "La fecha final debe ser posterior", path: ["end_date"] })
  .refine((v) => (Date.parse(v.end_date) - Date.parse(v.start_date)) / 86400000 <= 92, {
    message: "Máximo 3 meses",
    path: ["end_date"],
  });

export const noteColors = ["yellow", "pink", "blue", "green", "purple", "orange", "gray"] as const;

export const notePatch = z
  .object({
    content: z.string().max(5000).optional(),
    color: z.enum(noteColors).optional(),
    x: z.number().int().min(0).max(20000).optional(),
    y: z.number().int().min(0).max(20000).optional(),
    width: z.number().int().min(140).max(800).optional(),
    height: z.number().int().min(100).max(800).optional(),
    z_index: z.number().int().min(0).max(1_000_000).optional(),
    group_label: optionalText(40),
  })
  .strict();

export const profileInput = z
  .object({
    display_name: optionalText(60),
    timezone: z.string().refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Zona horaria inválida"),
    week_starts_on: z.number().int().min(0).max(6),
    weekly_focus_goal_minutes: z.number().int().min(0).max(10080),
    streaks_enabled: z.boolean(),
    pomodoro_settings: z
      .object({
        focus_minutes: z.number().int().min(1).max(180),
        short_break_minutes: z.number().int().min(1).max(60),
        long_break_minutes: z.number().int().min(1).max(90),
        sessions_before_long_break: z.number().int().min(1).max(12),
      })
      .strict(),
  })
  .strict();

export const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido").max(254),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72, "Máximo 72 caracteres"),
});

export const signupInput = credentials.extend({
  display_name: z.string().trim().max(60).optional(),
  timezone: z.string().max(64).optional(),
});

/** Primer mensaje de error legible de un ZodError. */
export function firstError(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue?.message ?? "Datos inválidos";
}
