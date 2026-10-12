import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BarChart3, CalendarRange, CheckCircle2, Crown, Flame, RefreshCw, ShieldCheck, Sparkles, Swords, Trophy, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays, diffDays, startOfWeek } from "@/lib/domain/dates";
import { compare } from "@/lib/domain/stats";
import { suggestChallenges, sumXp, XP_RULES, XP_SOURCE_LABEL, xpBySource, type XpSource } from "@/lib/domain/gamification";
import { getProgress } from "@/lib/data/gamification";
import { getGoalsWithProgress } from "@/lib/data/stats";
import { formatShortDate } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { Card, CardTitle, EmptyState, PageHeader, ProgressBar, ProgressRing, StatTile } from "@/components/ui/card";
import { BarChart } from "@/components/charts/bar-chart";
import { CountUp } from "@/components/fx/count-up";
import { ChallengeSuggestions } from "@/components/progress/challenge-suggestions";
import { AchievementsGrid, type AchievementItem } from "@/components/progress/achievements-grid";
import { XpSources } from "@/components/progress/xp-sources";
import { METRIC_META, SOURCE_META } from "@/components/progress/meta";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Progreso" };

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
  const weekChange = compare(weekXp, prevXp);

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
  const medals: AchievementItem[] = [...unlocked, ...locked].map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    icon: a.icon,
    tier: a.tier,
    current: a.current,
    target: a.target,
    unlocked: a.unlockedAt ? formatShortDate(a.unlockedAt) : null,
    recent: recent.has(a.id),
  }));

  const sourceItems = (Object.keys(weekBySource) as XpSource[])
    .filter((k) => weekBySource[k] > 0)
    .sort((a, b) => weekBySource[b] - weekBySource[a])
    .map((k) => ({ key: k, label: XP_SOURCE_LABEL[k], value: weekBySource[k] }));

  // XP de los últimos 7 días (mini gráfica de la tarjeta de fuentes).
  const lastDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6);
    return { day: d, xp: xp.byDay.get(d) ?? 0 };
  });

  // Comparación compacta para la cifra de la semana.
  const weekDelta =
    weekChange.pct === null
      ? undefined
      : weekChange.trend === "flat"
        ? "Igual"
        : `${weekChange.trend === "up" ? "+" : "−"}${Math.abs(Math.round(weekChange.pct * 100))} %`;

  return (
    <div className="space-y-6">
      <PageHeader title="Progreso" subtitle="Tu nivel, XP y logros, calculados solo con lo que registras." />

      {/* Protagonista: el nivel como insignia dorada. */}
      <Card variant="feature" className="p-6 sm:p-8">
        <Trophy className="pointer-events-none absolute -bottom-12 -right-8 h-64 w-64 rotate-12 text-white/[0.08]" aria-hidden />
        <div className="relative flex flex-col items-center gap-6 text-center [text-shadow:0_1px_2px_rgb(0_0_0/0.14)] sm:flex-row sm:items-center sm:gap-8 sm:text-left">
          <div className="relative shrink-0">
            <div className="animate-glow absolute inset-2 rounded-full bg-white/35 blur-2xl" aria-hidden />
            <Sparkles size={18} className="animate-float absolute -right-1 top-2 text-white/80" aria-hidden />
            <Sparkles size={12} className="animate-float absolute -left-2 bottom-6 text-white/70 [animation-delay:1.5s]" aria-hidden />
            <ProgressRing value={level.ratio} size={152} stroke={10} color="#fff">
              <div className="grid h-[114px] w-[114px] place-items-center rounded-full bg-gradient-to-br from-white/35 to-white/5 shadow-[inset_0_2px_0_rgb(255_255_255/0.45),0_14px_30px_-12px_rgb(0_0_0/0.35)] ring-1 ring-white/40">
                <div className="leading-none">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">Nivel</p>
                  <p className="num-xl mt-1 text-[54px] drop-shadow-[0_2px_8px_rgb(0_0_0/0.18)]">{level.level}</p>
                </div>
              </div>
            </ProgressRing>
          </div>

          <div className="w-full min-w-0 flex-1">
            <p className="eyebrow">Tu título actual</p>
            <h2 className="mt-1.5 text-[36px] font-bold leading-none sm:text-[46px]">{level.title}</h2>
            <p className="mt-3 text-balance text-sm text-muted">
              <span className="font-semibold text-text tabular">{level.total.toLocaleString("es")} XP en total</span> · faltan{" "}
              {(level.needed - level.into).toLocaleString("es")} XP para el nivel {level.level + 1}
            </p>
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between gap-2 text-[11.5px] font-semibold tabular text-muted">
                <span>
                  {level.into.toLocaleString("es")} / {level.needed.toLocaleString("es")} XP
                </span>
                <span>Nivel {level.level + 1}</span>
              </div>
              <ProgressBar value={level.ratio} size="lg" color="rgb(255 255 255 / 0.95)" label={`Progreso hacia el nivel ${level.level + 1}`} />
            </div>
            {level.nextTitle && (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold backdrop-blur">
                <Crown size={13} aria-hidden />
                Nivel {level.nextTitle.level}: «{level.nextTitle.title}»
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          icon={<Zap />}
          label="Hoy"
          value={
            <>
              +<CountUp value={todayXp} />
              <span className="ml-1 font-sans text-sm font-semibold tracking-normal text-muted">XP</span>
            </>
          }
          footnote={bestDay ? `Récord diario: ${bestDay[1]} XP` : "Una sesión de 2 minutos ya suma"}
        />
        <StatTile
          icon={<CalendarRange />}
          label="Esta semana"
          value={
            <>
              +<CountUp value={weekXp} />
              <span className="ml-1 font-sans text-sm font-semibold tracking-normal text-muted">XP</span>
            </>
          }
          delta={weekDelta}
          trend={weekChange.trend}
          footnote={weekDelta ? "vs. los mismos días de la semana pasada" : "Sin datos de la semana pasada para comparar"}
        />
        <StatTile
          icon={<Trophy />}
          label="Logros"
          value={
            <>
              {unlocked.length}
              <span className="font-sans text-base font-semibold tracking-normal text-muted">/{achievements.length}</span>
            </>
          }
          footnote={recent.size > 0 ? `${recent.size} ${recent.size === 1 ? "nuevo" : "nuevos"} estos días` : "Sigue sumando para la siguiente medalla"}
        />
        <StatTile
          icon={<Crown />}
          label="Mejor semana"
          value={
            bestWeek ? (
              <>
                {bestWeek[1].toLocaleString("es")}
                <span className="ml-1 font-sans text-sm font-semibold tracking-normal text-muted">XP</span>
              </>
            ) : (
              "—"
            )
          }
          footnote={bestWeek ? `Semana del ${formatShortDate(bestWeek[0])}` : "Aún sin datos"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardTitle icon={<Flame />} subtitle="De dónde sale tu XP de los últimos días">
            XP de esta semana por fuente
          </CardTitle>
          {sourceItems.length === 0 ? (
            <EmptyState
              icon={<Zap />}
              title="Aún no hay XP esta semana"
              action={
                <Link href="/focus" className={buttonClass("tone", "sm")}>
                  Empezar una sesión
                </Link>
              }
            >
              Una sesión de 2 minutos ya suma.
            </EmptyState>
          ) : (
            <XpSources items={sourceItems} />
          )}
          {lastDays.some((d) => d.xp > 0) && <LastDays days={lastDays} today={today} />}
        </Card>

        <Card>
          <CardTitle icon={<Sparkles />} subtitle="Reglas claras, sin trampas">
            Cómo se gana XP
          </CardTitle>
          <ul className="space-y-1 text-sm leading-relaxed">
            <Rule source="focus">
              <strong>{XP_RULES.focusPerMinute} XP por minuto</strong> de concentración medida (máx. {XP_RULES.focusSessionCapMinutes} min por sesión y {XP_RULES.focusDailyCap} XP al día; el registro manual cuenta la mitad).
            </Rule>
            <Rule source="just_start">
              <strong>+{XP_RULES.justStartBonus}</strong> por cada Just Start completado (hasta {XP_RULES.justStartDailyMax} al día).
            </Rule>
            <Rule source="tasks">
              <strong>+{XP_RULES.task}</strong> por tarea y <strong>+{XP_RULES.subtask}</strong> por paso, si no se crearon y cerraron al momento (máx. {XP_RULES.tasksDailyMax} tareas al día).
            </Rule>
            <Rule source="habits">
              <strong>+{XP_RULES.habit}</strong> por hábito cumplido y <strong>+{XP_RULES.activeDay}</strong> por día con actividad.
            </Rule>
            <Rule source="consistency">
              <strong>+{XP_RULES.consistentWeek}</strong> por semana con {XP_RULES.consistentWeekDays} días activos (cada día de descanso reduce lo exigido).
            </Rule>
            <Rule source="goals">
              <strong>+{XP_RULES.goalWeekly}</strong> por objetivo semanal, <strong>+{XP_RULES.goalMonthly}</strong> mensual y hasta <strong>+{XP_RULES.goalCustomMax}</strong> por desafío (máx. {XP_RULES.goalsPerWeekMax} por semana; los manuales no dan XP).
            </Rule>
          </ul>
          <p className="mt-4 flex gap-2.5 rounded-2xl bg-tone-soft/70 p-3.5 text-xs leading-relaxed text-tone-ink">
            <ShieldCheck size={16} className="mt-px shrink-0" aria-hidden />
            Recompensamos la constancia, no la cantidad: crear tareas vacías o inflar registros no sube de nivel.
          </p>
        </Card>
      </div>

      <Card data-reveal>
        <CardTitle icon={<Swords />} subtitle="Retos de 7 días que se miden solos con tus datos">
          Desafíos personales
        </CardTitle>
        {challenges.length > 0 && (
          <ul className="mb-6 grid gap-3 md:grid-cols-2">
            {challenges.map((c) => {
              const meta = METRIC_META[c.metric as keyof typeof METRIC_META];
              const Icon = meta.icon;
              const done = c.progress.achieved;
              return (
                <li
                  key={c.id}
                  data-tone={done ? "green" : meta.tone}
                  className="relative flex items-center gap-4 overflow-hidden rounded-[22px] border border-border bg-surface/60 p-4"
                >
                  <div className="pointer-events-none absolute -left-10 -top-10 h-28 w-28 rounded-full bg-tone opacity-[0.12] blur-2xl" aria-hidden />
                  <ProgressRing value={c.progress.ratio} size={64} stroke={6}>
                    {done ? <CheckCircle2 size={22} className="text-tone" aria-hidden /> : <Icon size={20} className="text-tone" aria-hidden />}
                  </ProgressRing>
                  <div className="relative min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold">{c.title}</p>
                      <span className="shrink-0 text-sm font-semibold tabular">
                        {c.progress.value}
                        <span className="font-normal text-muted">/{c.progress.target}</span>
                      </span>
                    </div>
                    <ProgressBar value={c.progress.ratio} size="sm" className="mt-2" label={c.title} />
                    <p className={cn("mt-1.5 text-[11.5px]", done ? "font-semibold text-tone-ink" : "text-muted")}>
                      {done ? "¡Desafío superado!" : `Hasta el ${formatShortDate(c.end_date!)} · quedan ${diffDays(c.end_date!, today) + 1} días`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mb-3 flex items-start gap-2">
          <Sparkles size={15} className="mt-0.5 shrink-0 text-tone" aria-hidden />
          <p className="text-xs leading-relaxed text-muted">
            Sugeridos para ti: un poco por encima de tu media de las últimas 4 semanas, para que sean retadores pero alcanzables.
          </p>
        </div>
        <ChallengeSuggestions items={suggestions} today={today} />
      </Card>

      <Card data-reveal>
        <CardTitle
          icon={<BarChart3 />}
          subtitle="Últimas 12 semanas"
          action={
            <span className="hidden items-center gap-1.5 rounded-full bg-tone-soft px-2.5 py-1 text-xs font-semibold text-tone-ink tabular sm:inline-flex">
              <span className="live-dot" aria-hidden />
              {weekXp} XP esta semana
            </span>
          }
        >
          XP por semana
        </CardTitle>
        <BarChart
          height={180}
          unit="count"
          average
          bars={weeks.map((w) => {
            const v = sumXp(xp.byDay, w, addDays(w, 6));
            return { key: w, label: formatShortDate(w), value: v, tooltip: `Semana del ${formatShortDate(w)}: ${v} XP`, highlight: w === weekStart };
          })}
          emptyText="Tu XP semanal aparecerá aquí."
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5 font-semibold text-text">
              <Trophy size={14} className="text-tone" aria-hidden />
              Récords
            </span>
            {bestDay ? (
              <span>
                Mejor día <strong className="text-text tabular">{bestDay[1]} XP</strong> ({formatShortDate(bestDay[0])})
              </span>
            ) : (
              <span>Aún sin datos</span>
            )}
            {bestWeek && (
              <span>
                Mejor semana <strong className="text-text tabular">{bestWeek[1]} XP</strong> (del {formatShortDate(bestWeek[0])})
              </span>
            )}
          </p>
          <Link href="/stats/trends" className="press inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-tone-ink hover:bg-surface-3">
            Ver récords de concentración
            <ArrowUpRight size={13} aria-hidden />
          </Link>
        </div>
      </Card>

      <Card data-reveal>
        <CardTitle icon={<Trophy />} subtitle={`${unlocked.length} de ${achievements.length} desbloqueados`}>
          Logros
        </CardTitle>
        <AchievementsGrid items={medals} />
      </Card>

      <p className="flex items-center justify-center gap-2 text-center text-xs text-muted">
        <RefreshCw size={12} className="shrink-0" aria-hidden />
        El XP se recalcula siempre a partir de tus datos: si borras una sesión o reabres una tarea, el XP se ajusta.
      </p>
    </div>
  );
}

/** Regla de XP con la ficha de color de su fuente. */
function Rule({ source, children }: { source: XpSource; children: React.ReactNode }) {
  const { tone, icon: Icon } = SOURCE_META[source];
  return (
    <li data-tone={tone} className="-mx-2 flex gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-surface-2/60 [&_strong]:font-semibold [&_strong]:text-tone-ink">
      <span className="tone-chip-soft mt-0.5 h-8 w-8 rounded-xl">
        <Icon size={15} aria-hidden />
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

const WEEKDAY = ["D", "L", "M", "X", "J", "V", "S"];

/** Mini gráfica de los últimos 7 días: una columna por día, hoy resaltado. */
function LastDays({ days, today }: { days: { day: string; xp: number }[]; today: string }) {
  const max = Math.max(1, ...days.map((d) => d.xp));
  const total = days.reduce((a, d) => a + d.xp, 0);
  return (
    <div className="mt-auto pt-5">
      <div className="rounded-[20px] bg-surface-2/50 p-3.5">
        <div className="mb-2.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="font-semibold">Últimos 7 días</span>
          <span className="text-muted tabular">{total.toLocaleString("es")} XP</span>
        </div>
        <div className="flex h-16 items-end gap-1.5" role="img" aria-label={days.map((d) => `${formatShortDate(d.day)}: ${d.xp} XP`).join("; ")}>
          {days.map((d, i) => (
            <div key={d.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <div
                className={cn(
                  "grow-up w-full max-w-7 rounded-t-md rounded-b-sm",
                  d.day === today ? "bg-gradient-to-t from-tone to-tone-2 shadow-[0_0_14px_-4px_var(--tone)]" : "bg-tone/35",
                )}
                style={{ height: d.xp ? `${Math.max(8, (d.xp / max) * 100)}%` : 3, animationDelay: `${i * 50}ms` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5" aria-hidden>
          {days.map((d) => (
            <span key={d.day} className={cn("flex-1 text-center text-[10px] font-semibold", d.day === today ? "text-tone-ink" : "text-faint")}>
              {WEEKDAY[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
