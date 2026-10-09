import type { Metadata } from "next";
import Link from "next/link";
import { Brain, CalendarCheck, Check, Clock, Flame, Gauge, Lock, Moon, Play, Star, Sunrise, Swords, Target, Trophy, Undo2, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays, diffDays, startOfWeek } from "@/lib/domain/dates";
import { compare, describeChange } from "@/lib/domain/stats";
import { suggestChallenges, sumXp, XP_RULES, XP_SOURCE_LABEL, xpBySource, type Achievement, type XpSource } from "@/lib/domain/gamification";
import { getProgress } from "@/lib/data/gamification";
import { getGoalsWithProgress } from "@/lib/data/stats";
import { formatShortDate } from "@/lib/format";
import { Card, CardTitle, PageHeader, ProgressBar, ProgressRing } from "@/components/ui/card";
import { BarChart, HBar } from "@/components/charts/bar-chart";
import { ChallengeSuggestions } from "@/components/progress/challenge-suggestions";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Progreso" };

const ICONS: Record<Achievement["icon"], React.ComponentType<{ size?: number; className?: string }>> = {
  play: Play,
  zap: Zap,
  brain: Brain,
  clock: Clock,
  check: Check,
  flame: Flame,
  sunrise: Sunrise,
  moon: Moon,
  undo: Undo2,
  target: Target,
  gauge: Gauge,
  calendar: CalendarCheck,
  star: Star,
};
const TIER_COLOR = ["", "#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b"];
const SOURCE_COLOR: Record<XpSource, string> = {
  focus: "var(--accent)",
  just_start: "#f59e0b",
  tasks: "var(--success)",
  habits: "#ec4899",
  active_day: "#0ea5e9",
  consistency: "#8b5cf6",
  goals: "#f97316",
};

export default async function ProgressPage() {
  const { supabase, profile, today } = await requireUser();
  const ws = profile.week_starts_on;
  const [{ xp, level, achievements, sources }, goals] = await Promise.all([
    getProgress(supabase, profile.timezone, today, ws),
    getGoalsWithProgress(supabase, today, ws),
  ]);

  const weekStart = startOfWeek(today, ws);
  const elapsed = diffDays(today, weekStart);
  const prevStart = addDays(weekStart, -7);
  const weekXp = sumXp(xp.byDay, weekStart, today);
  const prevXp = sumXp(xp.byDay, prevStart, addDays(prevStart, elapsed));
  const todayXp = xp.byDay.get(today) ?? 0;
  const weekBySource = xpBySource(xp.entries, weekStart, today);
  const maxSource = Math.max(0, ...Object.values(weekBySource));

  const weeks = Array.from({ length: 12 }, (_, i) => addDays(weekStart, -7 * (11 - i)));
  const bestDay = [...xp.byDay].sort((a, b) => b[1] - a[1])[0];
  const weekTotals = new Map<string, number>();
  for (const [d, v] of xp.byDay) {
    const w = startOfWeek(d, ws);
    weekTotals.set(w, (weekTotals.get(w) ?? 0) + v);
  }
  const bestWeek = [...weekTotals].sort((a, b) => b[1] - a[1])[0];

  const challenges = goals.filter((g) => g.period === "custom" && g.end_date && g.end_date >= today && g.metric !== "manual");
  const hasHabits = Object.keys(sources.habitCategory).length > 0;
  const suggestions = suggestChallenges(xp.facts, today, hasHabits).filter((s) => !challenges.some((c) => c.metric === s.metric));

  const unlocked = achievements.filter((a) => a.unlockedAt).sort((a, b) => (a.unlockedAt! < b.unlockedAt! ? 1 : -1));
  const locked = achievements.filter((a) => !a.unlockedAt).sort((a, b) => b.current / b.target - a.current / a.target);
  const recent = new Set(unlocked.filter((a) => diffDays(today, a.unlockedAt!) <= 3).map((a) => a.id));

  return (
    <div className="space-y-6">
      <PageHeader title="Progreso" subtitle="Tu nivel, XP y logros, calculados solo con lo que registras." />

      <Card className="flex flex-wrap items-center gap-6">
        <ProgressRing value={level.ratio} size={112} stroke={9}>
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-wide text-muted">Nivel</p>
            <p className="text-3xl font-semibold tabular">{level.level}</p>
          </div>
        </ProgressRing>
        <div className="min-w-[220px] flex-1 space-y-2">
          <p className="text-xl font-semibold">{level.title}</p>
          <p className="text-sm text-muted">
            {level.total.toLocaleString("es")} XP en total · faltan {(level.needed - level.into).toLocaleString("es")} XP para el nivel {level.level + 1}
          </p>
          <ProgressBar value={level.ratio} label={`Progreso hacia el nivel ${level.level + 1}`} />
          {level.nextTitle && (
            <p className="text-xs text-muted">
              Nivel {level.nextTitle.level}: «{level.nextTitle.title}»
            </p>
          )}
        </div>
        <div className="grid min-w-[200px] grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-xs text-muted">Hoy</p>
            <p className="text-lg font-semibold tabular">+{todayXp} XP</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-xs text-muted">Esta semana</p>
            <p className="text-lg font-semibold tabular">+{weekXp} XP</p>
            <p className="text-[11px] text-muted">{describeChange(compare(weekXp, prevXp), "los mismos días de la semana pasada")}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>XP de esta semana por fuente</CardTitle>
          {maxSource === 0 ? (
            <p className="text-sm text-muted">Aún no hay XP esta semana. Una sesión de 2 minutos ya suma.</p>
          ) : (
            <div className="space-y-3">
              {(Object.keys(weekBySource) as XpSource[])
                .filter((k) => weekBySource[k] > 0)
                .sort((a, b) => weekBySource[b] - weekBySource[a])
                .map((k) => (
                  <HBar key={k} label={XP_SOURCE_LABEL[k]} value={weekBySource[k]} max={maxSource} color={SOURCE_COLOR[k]} right={`${weekBySource[k]} XP`} />
                ))}
            </div>
          )}
        </Card>
        <Card>
          <CardTitle>Cómo se gana XP</CardTitle>
          <ul className="space-y-1.5 text-sm">
            <li>
              <strong>{XP_RULES.focusPerMinute} XP por minuto</strong> de concentración medida (máx. {XP_RULES.focusSessionCapMinutes} min por sesión y {XP_RULES.focusDailyCap} XP al día; el registro manual cuenta la mitad).
            </li>
            <li>
              <strong>+{XP_RULES.justStartBonus}</strong> por cada Just Start completado (hasta {XP_RULES.justStartDailyMax} al día).
            </li>
            <li>
              <strong>+{XP_RULES.task}</strong> por tarea y <strong>+{XP_RULES.subtask}</strong> por paso, si no se crearon y cerraron al momento (máx. {XP_RULES.tasksDailyMax} tareas al día).
            </li>
            <li>
              <strong>+{XP_RULES.habit}</strong> por hábito cumplido y <strong>+{XP_RULES.activeDay}</strong> por día con actividad.
            </li>
            <li>
              <strong>+{XP_RULES.consistentWeek}</strong> por semana con {XP_RULES.consistentWeekDays} días activos (cada día de descanso reduce lo exigido).
            </li>
            <li>
              <strong>+{XP_RULES.goalWeekly}</strong> por objetivo semanal, <strong>+{XP_RULES.goalMonthly}</strong> mensual y hasta <strong>+{XP_RULES.goalCustomMax}</strong> por desafío (máx. {XP_RULES.goalsPerWeekMax} por semana; los manuales no dan XP).
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted">Recompensamos la constancia, no la cantidad: crear tareas vacías o inflar registros no sube de nivel.</p>
        </Card>
      </div>

      <Card>
        <CardTitle icon={<Swords size={16} />}>Desafíos personales</CardTitle>
        {challenges.length > 0 && (
          <ul className="mb-5 grid gap-3 md:grid-cols-2">
            {challenges.map((c) => (
              <li key={c.id} className="rounded-xl bg-surface-2 p-3">
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="font-medium">{c.title}</span>
                  <span className="tabular text-muted">
                    {c.progress.value}/{c.progress.target}
                  </span>
                </div>
                <ProgressBar value={c.progress.ratio} color={c.progress.achieved ? "var(--success)" : undefined} label={c.title} />
                <p className="mt-1 text-[11px] text-muted">
                  {c.progress.achieved ? "¡Desafío superado!" : `Hasta el ${formatShortDate(c.end_date!)} · quedan ${diffDays(c.end_date!, today) + 1} días`}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mb-3 text-xs text-muted">Sugeridos para ti: un poco por encima de tu media de las últimas 4 semanas, para que sean retadores pero alcanzables.</p>
        <ChallengeSuggestions items={suggestions} today={today} />
      </Card>

      <Card>
        <CardTitle>XP por semana</CardTitle>
        <BarChart
          bars={weeks.map((w) => {
            const v = sumXp(xp.byDay, w, addDays(w, 6));
            return { key: w, label: formatShortDate(w), value: v, tooltip: `Semana del ${formatShortDate(w)}: ${v} XP`, highlight: w === weekStart };
          })}
          emptyText="Tu XP semanal aparecerá aquí."
        />
        <p className="mt-3 text-xs text-muted">
          Récords: {bestDay ? `mejor día ${bestDay[1]} XP (${formatShortDate(bestDay[0])})` : "aún sin datos"}
          {bestWeek && ` · mejor semana ${bestWeek[1]} XP (del ${formatShortDate(bestWeek[0])})`}.{" "}
          <Link href="/stats/trends" className="text-accent hover:underline">
            Ver récords de concentración
          </Link>
        </p>
      </Card>

      <Card>
        <CardTitle icon={<Trophy size={16} />} action={<span className="text-xs text-muted">{unlocked.length} de {achievements.length}</span>}>
          Logros
        </CardTitle>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...unlocked, ...locked].map((a) => {
            const Icon = ICONS[a.icon];
            const done = !!a.unlockedAt;
            return (
              <li key={a.id} className={cn("flex gap-3 rounded-xl border p-3", done ? "border-border bg-surface" : "border-dashed border-border bg-transparent", recent.has(a.id) && "ring-2 ring-accent")}>
                <span
                  className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", !done && "bg-surface-2 text-muted")}
                  style={done ? { backgroundColor: `${TIER_COLOR[a.tier]}22`, color: TIER_COLOR[a.tier] } : undefined}
                >
                  {done ? <Icon size={18} /> : <Lock size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", !done && "text-muted")}>
                    {a.title}
                    {recent.has(a.id) && <span className="ml-1.5 rounded bg-accent-soft px-1 text-[10px] text-accent">Nuevo</span>}
                  </p>
                  <p className="text-xs text-muted">{a.description}</p>
                  {done ? (
                    <p className="mt-1 text-[11px] text-muted">Desbloqueado el {formatShortDate(a.unlockedAt!)}</p>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-2">
                      <ProgressBar value={a.current / a.target} className="h-1.5" label={`Progreso de ${a.title}`} />
                      <span className="shrink-0 text-[11px] tabular text-muted">
                        {a.current}/{a.target}
                      </span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      <p className="text-xs text-muted">El XP se recalcula siempre a partir de tus datos: si borras una sesión o reabres una tarea, el XP se ajusta.</p>
    </div>
  );
}
