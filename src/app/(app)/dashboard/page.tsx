import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Flame,
  History,
  Lightbulb,
  Moon,
  Play,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Target,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays, diffDays, eachDay, localHour, startOfWeek, weekday } from "@/lib/domain/dates";
import { isScheduled } from "@/lib/domain/habits";
import { compare, describeChange, formatDuration, isActiveDay, totals, type Comparison } from "@/lib/domain/stats";
import { GOAL_METRIC_LABEL } from "@/lib/domain/goals";
import { formatLongDate, formatShortDate, greeting, WEEKDAY_SHORT } from "@/lib/format";
import { getDaily, getGoalsWithProgress, getRecommendations, getStreak } from "@/lib/data/stats";
import { getAccountStart } from "@/lib/data/analytics";
import { getProgress } from "@/lib/data/gamification";
import { getDayPlan } from "@/lib/data/planner";
import { getQuickToday, isQuickReady } from "@/lib/data/quick";
import { QuickTasksCard } from "@/components/microtasks/quick-tasks-card";
import { CalendarHeatmap } from "@/components/charts/calendar-heatmap";
import type { Habit, HabitLog, Task } from "@/lib/types";
import type { Tone } from "@/lib/sections";
import { buttonClass } from "@/components/ui/button";
import { Badge, Card, CardTitle, EmptyState, PageHeader, ProgressBar, StatTile } from "@/components/ui/card";
import { BarChart } from "@/components/charts/bar-chart";
import { TaskCheckbox } from "@/components/tasks/task-item";
import { HabitToggle, RestDayButton } from "@/components/dashboard/widgets";
import { RecommendationList } from "@/components/dashboard/recommendations";
import { ActivityRings } from "@/components/fx/activity-rings";
import { CountUp } from "@/components/fx/count-up";
import { cn } from "@/lib/cn";
import { getDiscipline } from "@/lib/data/discipline";
import { hoursText, rankFor, summarize, vsYesterday } from "@/lib/domain/discipline";
import { quoteOfDay } from "@/lib/domain/quotes";
import { getFavoriteQuoteIds } from "@/lib/data/discipline";
import { RankBadge, TodayPanel, type LiveSession } from "@/components/discipline/today-panel";
import { QuoteCard } from "@/components/discipline/quote-card";
import { DisciplineSetupNotice, SelfCompare } from "@/components/discipline/summary-cards";
import type { FocusSession } from "@/lib/types";

export const metadata: Metadata = { title: "Inicio" };

/** Enlace de cabecera de tarjeta: pastilla con el color de la tarjeta. */
const cardLink =
  "press inline-flex items-center gap-1 rounded-full bg-tone-soft px-2.5 py-1 text-xs font-semibold text-tone-ink transition-[filter] hover:brightness-95 dark:hover:brightness-125";

/** Comparación para StatTile: solo se marca en verde la mejora; el resto se muestra neutro (sin culpas). */
function deltaOf(c: Comparison, label: string): { delta: string; trend?: "up" } {
  return { delta: describeChange(c, label), trend: c.trend === "up" && c.pct !== null ? "up" : undefined };
}

function Delta({ c, label }: { c: Comparison; label: string }) {
  const Icon = c.trend === "up" ? ArrowUpRight : c.trend === "down" ? ArrowDownRight : ArrowRight;
  const good = c.trend === "up" && c.pct !== null;
  return (
    <p className={cn("mt-2.5 flex items-start gap-1 text-xs leading-snug", good ? "font-medium text-success" : "text-muted")}>
      {c.pct !== null && <Icon size={13} className="mt-px shrink-0" aria-hidden />}
      {describeChange(c, label)}
    </p>
  );
}

/** Separador de grupo: etiqueta del tono y una línea que se desvanece. */
function SectionLabel({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 pt-4" data-reveal>
      <span className="tone-chip-soft h-7 w-7 rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5" aria-hidden>
        {icon}
      </span>
      <p className="eyebrow shrink-0">{children}</p>
      <span className="h-px flex-1 bg-gradient-to-r from-[color:color-mix(in_srgb,var(--tone)_35%,transparent)] to-transparent" aria-hidden />
    </div>
  );
}

function RingLegend({ tone, label, ratio, children }: { tone: Tone; label: string; ratio: number; children: React.ReactNode }) {
  return (
    <li data-tone={tone} className="flex items-center gap-3 rounded-2xl bg-surface-2/50 px-3.5 py-2.5 transition-colors hover:bg-surface-2/80">
      <span className="h-9 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-tone to-tone-2 shadow-[0_0_12px_-2px_var(--tone)]" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-tone-ink">{label}</span>
        <span className="block font-display text-lg font-semibold leading-tight tabular">{children}</span>
      </span>
      <span className="shrink-0 rounded-full bg-tone-soft px-2 py-0.5 text-xs font-bold text-tone-ink tabular">{Math.round(Math.min(1, ratio) * 100)} %</span>
    </li>
  );
}

/** Mini tarjeta del bloque "Ayer · Hoy · Esta semana". */
function MiniCard({ tone, icon, label, testId, children }: { tone: Tone; icon: React.ReactNode; label: string; testId: string; children: React.ReactNode }) {
  return (
    <div data-tone={tone} className="card-glass spotlight relative min-w-0 overflow-hidden rounded-[24px] p-5" data-testid={testId}>
      <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-tone opacity-[0.12] blur-2xl" aria-hidden />
      <div className="relative flex items-center gap-2.5">
        <span className="tone-chip h-8 w-8 rounded-xl [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
          {icon}
        </span>
        <p className="eyebrow">{label}</p>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

/** Pastilla del saludo: un dato de hoy con el color de su sección. */
function HelloChip({ tone, icon, children }: { tone: Tone; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span data-tone={tone} className="inline-flex items-center gap-1.5 rounded-full bg-tone-soft px-3 py-1 text-[13px] font-semibold text-tone-ink [&_svg]:h-3.5 [&_svg]:w-3.5">
      {icon}
      {children}
    </span>
  );
}

export default async function DashboardPage() {
  const { supabase, profile, today, user } = await requireUser();
  const weekStart = startOfWeek(today, profile.week_starts_on);
  const elapsedInWeek = eachDay(weekStart, today).length;
  const prevWeekStart = addDays(weekStart, -7);
  const heatStart = addDays(weekStart, -7 * 15);

  const disciplineFrom = addDays(today, -400);
  const quickReady = await isQuickReady(supabase);
  const [daily, streak, goals, recs, tasksRes, habitsRes, logsRes, accountStart, progress, plan, discipline, activeRes, quick] = await Promise.all([
    getDaily(supabase, heatStart, today),
    getStreak(supabase, today),
    getGoalsWithProgress(supabase, today, profile.week_starts_on),
    getRecommendations(supabase, today, profile.timezone, profile.week_starts_on),
    (() => {
      let q = supabase.from("tasks").select("*").is("parent_id", null).in("status", ["todo", "in_progress"]);
      // Las tareas rápidas tienen su propia lista arriba.
      if (quickReady) q = q.eq("quick", false);
      return q.or(`due_date.lte.${today},status.eq.in_progress`).order("priority", { ascending: false }).order("due_date").limit(8);
    })(),
    supabase.from("habits").select("*").is("archived_at", null).order("position"),
    supabase.from("habit_logs").select("habit_id, log_date, status").eq("log_date", today),
    getAccountStart(supabase, profile.timezone),
    getProgress(supabase, profile.timezone, today, profile.week_starts_on),
    getDayPlan(supabase, profile, today),
    getDiscipline(supabase, profile, disciplineFrom, today),
    supabase.from("focus_sessions").select("*").in("status", ["running", "paused"]).maybeSingle<FocusSession>(),
    getQuickToday(supabase, profile, today),
  ]);
  const favorites = await getFavoriteQuoteIds(supabase, discipline.ready);
  const summary = summarize({ days: discipline.days, today, weekStart, goalMinutes: discipline.goalMinutes, restDays: discipline.restDays });
  // La actividad en curso suma en vivo si su categoría cuenta como desarrollo.
  const activeRow = activeRes.data;
  const activeCategory = activeRow?.category_id ?? null;
  const live: LiveSession | null =
    activeRow && activeRow.kind !== "break"
      ? { ...activeRow, counts: !activeCategory || discipline.categories.find((c) => c.id === activeCategory)?.counts !== false }
      : null;
  const quote = quoteOfDay(today, summary.goalReached ? "suficiencia" : undefined);
  const nextUp = plan.items[0];
  const { level } = progress;
  const todayXp = progress.xp.byDay.get(today) ?? 0;
  const newAchievements = progress.achievements.filter((a) => a.unlockedAt && diffDays(today, a.unlockedAt) <= 2);
  // Calendario de las últimas 16 semanas, sin mostrar semanas anteriores a la cuenta.
  const heatFrom = accountStart && accountStart > heatStart ? accountStart : heatStart;

  const byDay = new Map(daily.map((d) => [d.day, d]));
  const todayStat = byDay.get(today)!;
  const yesterday = byDay.get(addDays(today, -1));
  const thisWeek = totals(daily.filter((d) => d.day >= weekStart));
  const lastWeekSameDays = totals(daily.filter((d) => d.day >= prevWeekStart && d.day < addDays(prevWeekStart, elapsedInWeek)));

  const focusVsYesterday = compare(todayStat.focus_seconds, yesterday?.focus_seconds ?? 0);
  const tasksVsYesterday = compare(todayStat.tasks_completed, yesterday?.tasks_completed ?? 0);
  const weekFocus = compare(thisWeek.focus_seconds, lastWeekSameDays.focus_seconds);
  const weekTasks = compare(thisWeek.tasks_completed, lastWeekSameDays.tasks_completed);
  const goalSeconds = profile.weekly_focus_goal_minutes * 60;

  const habits = ((habitsRes.data ?? []) as Habit[]).filter((h) => isScheduled(h, today));
  const doneHabitIds = new Set(((logsRes.data ?? []) as HabitLog[]).filter((l) => l.status === "done").map((l) => l.habit_id));
  const tasks = (tasksRes.data ?? []) as Task[];
  const hour = localHour(new Date(), profile.timezone);
  const name = profile.display_name ?? user.email?.split("@")[0] ?? "";

  const weekDays = eachDay(weekStart, addDays(weekStart, 6));
  const habitsDone = habits.filter((h) => doneHabitIds.has(h.id)).length;
  // Metas de los anillos: tu objetivo diario de disciplina y las tareas de hoy.
  const focusTarget = discipline.goalMinutes * 60;
  const tasksTarget = todayStat.tasks_completed + tasks.length;
  const ringFocus = focusTarget ? summary.todaySeconds / focusTarget : 0;
  const ringTasks = tasksTarget ? todayStat.tasks_completed / tasksTarget : 0;
  const ringHabits = habits.length ? habitsDone / habits.length : 0;

  // Saludo según la hora del día.
  const GreetIcon = hour < 6 ? Moon : hour < 12 ? Sunrise : hour < 17 ? Sun : hour < 20 ? Sunset : Moon;
  const habitsLeft = habits.length - habitsDone;
  const goalsDone = goals.filter((g) => g.progress.achieved).length;
  // Resumen del calendario de constancia.
  const heatDays = eachDay(heatFrom, today).length;
  const activeInHeat = daily.filter((d) => d.day >= heatFrom && isActiveDay(d)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={name ? `${greeting(hour)}, ${name}` : greeting(hour)}
        eyebrow={formatLongDate(today)}
        icon={<GreetIcon />}
        subtitle={
          <span className="mt-1 flex flex-wrap gap-2">
            <HelloChip tone="blue" icon={<CheckSquare />}>
              {tasks.length ? `${tasks.length} ${tasks.length === 1 ? "tarea" : "tareas"} para hoy` : "Sin tareas urgentes"}
            </HelloChip>
            {habits.length > 0 && (
              <HelloChip tone="orange" icon={<Flame />}>
                {habitsLeft ? `${habitsLeft} ${habitsLeft === 1 ? "hábito" : "hábitos"} por hacer` : "Hábitos al día"}
              </HelloChip>
            )}
            {todayXp > 0 && (
              <HelloChip tone="gold" icon={<Sparkles />}>
                +{todayXp} XP hoy
              </HelloChip>
            )}
          </span>
        }
      />

      {!discipline.ready && <DisciplineSetupNotice />}

      <div className="stagger space-y-5">
        <TodayPanel baseSeconds={summary.todaySeconds} goalMinutes={discipline.goalMinutes} active={live} today={today} />

        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Cifras de hoy">
          <StatTile
            tone="coral"
            icon={<Timer />}
            label="Concentración registrada hoy"
            value={<CountUp value={todayStat.focus_seconds} kind="duration" />}
            {...deltaOf(focusVsYesterday, "ayer")}
            footnote={
              todayStat.focus_seconds - summary.todaySeconds >= 60
                ? `${hoursText(todayStat.focus_seconds - summary.todaySeconds)} no cuentan como desarrollo`
                : undefined
            }
          />
          <StatTile
            tone="blue"
            icon={<CheckCircle2 />}
            label="Tareas completadas"
            value={<CountUp value={todayStat.tasks_completed} />}
            {...deltaOf(tasksVsYesterday, "ayer")}
          />
          <StatTile
            tone="orange"
            icon={<Flame />}
            label="Hábitos hoy"
            value={
              <>
                <CountUp value={habitsDone} />
                <span className="text-lg font-medium text-muted">/{habits.length}</span>
              </>
            }
            footnote={habits.length ? "programados para hoy" : "ninguno programado"}
          >
            {habits.length > 0 && <ProgressBar value={ringHabits} size="sm" className="mt-3" label="Hábitos completados hoy" />}
          </StatTile>
          <StatTile
            tone="gold"
            icon={<CalendarCheck />}
            label="Racha de constancia"
            value={
              profile.streaks_enabled ? (
                <>
                  <CountUp value={streak.current} /> <span className="text-lg font-medium text-muted">{streak.current === 1 ? "día" : "días"}</span>
                </>
              ) : (
                "—"
              )
            }
            footnote={profile.streaks_enabled ? undefined : "Rachas desactivadas en ajustes."}
          >
            {profile.streaks_enabled && (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted">
                {streak.pendingToday && !streak.restToday && <span>Haz algo hoy para mantenerla.</span>}
                {streak.longest > streak.current && <span>Récord: {streak.longest}</span>}
                <RestDayButton today={today} isRest={streak.restToday} />
              </div>
            )}
          </StatTile>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <Card className="overflow-hidden">
            <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-[var(--ring-focus)] opacity-[0.07] blur-3xl" aria-hidden />
            <CardTitle icon={<Activity />} subtitle="Desarrollo, tareas y hábitos de hoy">
              Tus anillos de hoy
            </CardTitle>
            <div className="relative grid items-center gap-6 sm:grid-cols-[auto_1fr]">
              <div className="relative mx-auto w-[188px] sm:w-[200px]">
                <div className="pointer-events-none absolute inset-6 rounded-full bg-surface-2/60 blur-xl" aria-hidden />
                <ActivityRings
                  size={200}
                  stroke={20}
                  gap={6}
                  className="relative h-auto w-full"
                  rings={[
                    { label: "Desarrollo", value: ringFocus, tone: "coral" },
                    { label: "Tareas", value: ringTasks, tone: "blue" },
                    { label: "Hábitos", value: ringHabits, tone: "orange" },
                  ]}
                />
              </div>
              <ul className="space-y-2" aria-label="Anillos de hoy">
                <RingLegend tone="coral" label="Desarrollo" ratio={ringFocus}>
                  {hoursText(summary.todaySeconds)}
                  <span className="font-sans text-sm font-medium text-muted"> / {hoursText(focusTarget)}</span>
                </RingLegend>
                <RingLegend tone="blue" label="Tareas" ratio={ringTasks}>
                  <CountUp value={todayStat.tasks_completed} />
                  <span className="font-sans text-sm font-medium text-muted"> / {tasksTarget}</span>
                </RingLegend>
                <RingLegend tone="orange" label="Hábitos" ratio={ringHabits}>
                  <CountUp value={habitsDone} />
                  <span className="font-sans text-sm font-medium text-muted"> / {habits.length}</span>
                </RingLegend>
              </ul>
            </div>
            <div className="relative mt-5 flex flex-wrap gap-2 border-t border-border/60 pt-5">
              <Link href="/focus" className={buttonClass("secondary", "md")}>
                <Play size={16} /> Empezar a concentrarme
              </Link>
              <Link href="/focus?just=2" className={buttonClass("ghost", "md")} title="Solo 2 minutos">
                <Zap size={16} /> Just Start
              </Link>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Link href="/plan" data-tone="indigo" className="card-tint lift group relative flex min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-[26px] p-5 sm:p-6">
              <div className="pointer-events-none absolute -bottom-12 -right-10 h-36 w-36 rounded-full bg-tone opacity-[0.14] blur-2xl" aria-hidden />
              <span className="relative flex items-center gap-3.5">
                <span className="tone-chip h-12 w-12 rounded-[16px] transition-transform duration-300 group-hover:-rotate-6" aria-hidden>
                  <CalendarClock size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="eyebrow block">Qué hacer ahora</span>
                  <span className="block font-display text-[19px] font-semibold leading-tight">Tu plan de hoy</span>
                </span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tone-soft text-tone-ink transition-transform duration-300 group-hover:translate-x-1" aria-hidden>
                  <ArrowRight size={17} />
                </span>
              </span>
              <span className="relative block space-y-3">
                {nextUp ? (
                  <span className="block">
                    <span className="block truncate text-sm font-medium">Empieza por &quot;{nextUp.task.title}&quot;</span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="tone">
                        {plan.items.length} {plan.items.length === 1 ? "tarea" : "tareas"}
                      </Badge>
                      <Badge variant="neutral">
                        <Clock size={11} aria-hidden /> ≈ {formatDuration(plan.plannedMinutes * 60)}
                      </Badge>
                    </span>
                  </span>
                ) : (
                  <span className="block text-sm text-muted">{plan.headline}</span>
                )}
                {plan.capacityMinutes > 0 && (
                  <span className="block">
                    <span className="flex items-baseline justify-between gap-2 text-xs tabular">
                      <span className="text-muted">Tu ritmo de hoy</span>
                      <span className="font-semibold text-tone-ink">
                        {formatDuration(plan.doneMinutes * 60)} / {formatDuration(plan.capacityMinutes * 60)}
                      </span>
                    </span>
                    <ProgressBar value={plan.doneMinutes / plan.capacityMinutes} size="sm" className="mt-1.5" label="Concentración de hoy frente a tu ritmo habitual" />
                  </span>
                )}
              </span>
            </Link>

            <Link
              href="/progress"
              data-tone="gold"
              className="card-tint lift group relative flex min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-[26px] p-5 sm:p-6"
              aria-label={`Nivel ${level.level}, ${level.title}. Ver progreso`}
            >
              <div className="pointer-events-none absolute -bottom-12 -right-10 h-36 w-36 rounded-full bg-tone opacity-[0.16] blur-2xl" aria-hidden />
              <span className="relative flex items-center gap-3.5">
                <span className="tone-chip h-12 w-12 rounded-[16px] font-display text-lg font-bold tabular transition-transform duration-300 group-hover:scale-105">
                  {level.level}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="eyebrow block">Nivel {level.level}</span>
                  <span className="block truncate font-display text-[19px] font-semibold leading-tight">{level.title}</span>
                </span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tone-soft text-tone-ink transition-transform duration-300 group-hover:translate-x-1" aria-hidden>
                  <ArrowRight size={17} />
                </span>
              </span>
              <span className="relative block">
                <span className="flex items-baseline justify-between gap-2 text-xs tabular">
                  <span className="text-muted">
                    {level.into}/{level.needed} XP
                  </span>
                  {todayXp > 0 && <span className="font-semibold text-tone-ink">+{todayXp} hoy</span>}
                </span>
                <ProgressBar value={level.ratio} className="mt-2" label={`Progreso hacia el nivel ${level.level + 1}`} />
                {newAchievements.length > 0 && (
                  <Badge variant="solid" className="mt-3">
                    <Trophy size={12} aria-hidden />{" "}
                    {newAchievements.length === 1 ? `Logro nuevo: ${newAchievements[0].title}` : `${newAchievements.length} logros nuevos`}
                  </Badge>
                )}
              </span>
            </Link>
          </div>
        </div>
      </div>

      <SectionLabel icon={<CheckSquare />}>Hoy toca</SectionLabel>

      <div data-reveal>
        <QuickTasksCard quick={quick} today={today} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]" data-reveal>
        <Card tone="blue">
          <CardTitle
            icon={<CheckSquare />}
            subtitle={tasks.length ? `${tasks.length} ${tasks.length === 1 ? "pendiente" : "pendientes"}` : "Todo en orden"}
            action={
              <Link href="/tasks" className={cardLink}>
                Todas las tareas <ArrowRight size={12} aria-hidden />
              </Link>
            }
          >
            Para hoy
          </CardTitle>
          {tasks.length === 0 ? (
            <EmptyState icon={<CheckSquare />} title="Nada urgente para hoy">
              <Link href="/tasks" className="font-semibold text-tone-ink hover:underline">
                Planifica una tarea pequeña
              </Link>{" "}
              o dedica una sesión a un proyecto.
            </EmptyState>
          ) : (
            <ul className="-mx-2 space-y-1">
              {tasks.map((t) => {
                const overdue = !!t.due_date && t.due_date < today;
                const meta = overdue || t.status === "in_progress" || !!t.estimated_minutes;
                return (
                  <li key={t.id} className="group flex items-center gap-3 rounded-2xl px-2.5 py-2.5 transition-colors hover:bg-surface-2/60">
                    <TaskCheckbox task={t} size={22} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{t.title}</span>
                      {meta && (
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          {overdue && <Badge variant="danger">vencida</Badge>}
                          {t.status === "in_progress" && <Badge variant="tone">En curso</Badge>}
                          {!!t.estimated_minutes && (
                            <Badge variant="neutral">
                              <Clock size={10} aria-hidden /> {formatDuration(t.estimated_minutes * 60)}
                            </Badge>
                          )}
                        </span>
                      )}
                    </span>
                    <Link
                      href={`/focus?task=${t.id}`}
                      className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-tone-soft text-tone-ink transition-[background-color,color,box-shadow] hover:bg-tone hover:text-white hover:shadow-[0_8px_18px_-8px_var(--tone)]"
                      aria-label={`Concentrarme en ${t.title}`}
                    >
                      <Play size={14} fill="currentColor" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card tone="orange">
          <CardTitle
            icon={<Flame />}
            subtitle={habits.length ? (habitsLeft ? `${habitsDone} de ${habits.length} hechos` : "¡Todos hechos hoy!") : undefined}
            action={
              <Link href="/habits" className={cardLink}>
                Hábitos <ArrowRight size={12} aria-hidden />
              </Link>
            }
          >
            Hábitos de hoy
          </CardTitle>
          {habits.length === 0 ? (
            <EmptyState icon={<Flame />} title="Nada programado hoy">
              <Link href="/habits" className="font-semibold text-tone-ink hover:underline">
                Crea un hábito
              </Link>
            </EmptyState>
          ) : (
            <>
              <ProgressBar value={ringHabits} size="sm" className="-mt-1 mb-4" label="Hábitos completados hoy" />
              <div className="space-y-2">
                {habits.map((h) => (
                  <HabitToggle key={h.id} id={h.id} name={h.name} color={h.color} done={doneHabitIds.has(h.id)} today={today} value={h.target_value} />
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <SectionLabel icon={<History />}>Tú contra ti mismo</SectionLabel>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Tu progreso frente a ti mismo" data-reveal>
        <MiniCard tone="indigo" icon={<History />} label="Ayer" testId="yesterday">
          <p className="mt-4 flex flex-wrap items-center gap-2">
            <span className="num-xl text-tone-gradient text-[34px]">{hoursText(summary.yesterday.seconds)}</span>
            {summary.yesterday.rank.id !== "inicio" && <RankBadge rank={summary.yesterday.rank} className="text-xs" />}
          </p>
          <p className="mt-2 text-[15px] font-medium leading-snug">{summary.yesterday.text}</p>
        </MiniCard>
        <MiniCard tone="violet" icon={<Zap />} label="Hoy" testId="today-vs">
          <p className="num-xl text-tone-gradient mt-4 text-[34px]">{hoursText(summary.todaySeconds)}</p>
          <p className="mt-2 text-[15px] font-medium leading-snug">{vsYesterday(summary.todaySeconds, summary.yesterday.seconds)}</p>
        </MiniCard>
        <MiniCard tone="gold" icon={<CalendarCheck />} label="Esta semana" testId="week-goal">
          <div className="mt-4 grid grid-cols-7 gap-1.5" aria-hidden>
            {weekDays.map((d) => {
              const secs = d === today ? summary.todaySeconds : (discipline.days.get(d)?.productive ?? 0);
              const hit = d <= today && secs >= discipline.goalMinutes * 60;
              const rest = d <= today && !hit && discipline.restDays.has(d);
              return (
                <span key={d} className="flex flex-col items-center gap-1.5">
                  <span
                    data-tone={rest ? "teal" : undefined}
                    className={cn(
                      "grid h-9 w-full place-items-center rounded-xl transition-transform hover:scale-105",
                      hit
                        ? "bg-gradient-to-b from-[var(--gold-2)] to-[var(--gold)] text-white shadow-[0_6px_14px_-6px_var(--gold)]"
                        : rest
                          ? "bg-tone-soft text-tone-ink"
                          : d > today
                            ? "border border-dashed border-border-strong"
                            : "bg-surface-2",
                      d === today && "ring-2 ring-[var(--gold)] ring-offset-2 ring-offset-surface",
                    )}
                    title={`${formatLongDate(d)}: ${hoursText(secs)}`}
                  >
                    {hit ? <Check size={14} strokeWidth={3} /> : rest ? <Moon size={13} /> : null}
                  </span>
                  <span className={cn("text-[10px] font-medium text-muted", d === today && "font-bold text-text")}>{WEEKDAY_SHORT[weekday(d)]}</span>
                </span>
              );
            })}
          </div>
          <p className="mt-3 text-[15px] font-medium leading-snug">{summary.week.text}</p>
        </MiniCard>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]" data-reveal>
        <QuoteCard quote={quote} favorite={favorites.includes(quote.id)} ready={discipline.ready} />
        <SelfCompare
          best={summary.best ? { ...summary.best, label: formatShortDate(summary.best.day), rank: rankFor(summary.best.seconds) } : null}
          avg30={summary.avg30}
          todaySeconds={summary.todaySeconds}
          goalStreak={summary.goalStreak}
        />
      </div>

      <SectionLabel icon={<BarChart3 />}>Tu semana</SectionLabel>

      <div className="grid gap-5 lg:grid-cols-[1.75fr_1fr]" data-reveal>
        <Card>
          <CardTitle
            icon={<BarChart3 />}
            subtitle="Concentración por día"
            action={
              <Link href="/stats" className={cardLink}>
                Ver estadísticas <ArrowRight size={12} aria-hidden />
              </Link>
            }
          >
            Esta semana
          </CardTitle>
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <div data-tone="coral" className="rounded-2xl bg-surface-2/50 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-medium text-muted">
                  <Timer size={14} className="text-tone-ink" aria-hidden /> Concentración
                </p>
                <p className="text-sm tabular">
                  <span className="font-display text-lg font-semibold">{formatDuration(thisWeek.focus_seconds)}</span>
                  {goalSeconds > 0 && <span className="text-muted"> / {formatDuration(goalSeconds)}</span>}
                </p>
              </div>
              {goalSeconds > 0 && <ProgressBar value={thisWeek.focus_seconds / goalSeconds} className="mt-2.5" label="Objetivo semanal de concentración" />}
              <Delta c={weekFocus} label="los mismos días de la semana pasada" />
            </div>
            <div data-tone="blue" className="rounded-2xl bg-surface-2/50 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-medium text-muted">
                  <CheckCircle2 size={14} className="text-tone-ink" aria-hidden /> Tareas completadas
                </p>
                <p className="font-display text-lg font-semibold tabular">{thisWeek.tasks_completed}</p>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="flex gap-1" aria-hidden>
                  {Array.from({ length: elapsedInWeek }, (_, i) => (
                    <span key={i} className={cn("h-2 w-4 rounded-full", i < thisWeek.active_days ? "bg-gradient-to-r from-tone to-tone-2" : "bg-surface-3")} />
                  ))}
                </span>
                <p className="text-xs text-muted">
                  {thisWeek.active_days} de {elapsedInWeek} días activos
                </p>
              </div>
              <Delta c={weekTasks} label="los mismos días de la semana pasada" />
            </div>
          </div>
          <BarChart
            height={160}
            color="var(--tone)"
            bars={weekDays.map((d) => {
              const s = byDay.get(d);
              return {
                key: d,
                label: WEEKDAY_SHORT[weekday(d)],
                value: d > today ? 0 : Math.round((s?.focus_seconds ?? 0) / 60),
                tooltip: `${formatLongDate(d)}: ${formatDuration(s?.focus_seconds ?? 0)} · ${s?.tasks_completed ?? 0} tareas`,
                highlight: d === today,
              };
            })}
            emptyText="Aún no hay sesiones esta semana. La primera es la que más cuesta."
          />
        </Card>

        <Card tone="green">
          <CardTitle
            icon={<Target />}
            subtitle={goals.length ? `${goalsDone} de ${goals.length} cumplidos` : undefined}
            action={
              <Link href="/goals" className={cardLink}>
                Gestionar <ArrowRight size={12} aria-hidden />
              </Link>
            }
          >
            Objetivos activos
          </CardTitle>
          {goals.length === 0 ? (
            <EmptyState icon={<Target />} title="Sin objetivos">
              <Link href="/goals" className="font-semibold text-tone-ink hover:underline">
                Crea uno realista
              </Link>{" "}
              para esta semana.
            </EmptyState>
          ) : (
            <ul className="-mx-1 space-y-2">
              {goals.slice(0, 4).map((g) => (
                <li key={g.id} className="rounded-2xl bg-surface-2/40 p-3 transition-colors hover:bg-surface-2/70">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{g.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted">{GOAL_METRIC_LABEL[g.metric]}</p>
                    </div>
                    {g.progress.achieved ? (
                      <Badge variant="success" className="shrink-0 tabular">
                        <Check size={11} strokeWidth={3} aria-hidden /> {g.progress.value}/{g.progress.target}
                      </Badge>
                    ) : (
                      <span className="shrink-0 text-xs font-semibold text-muted tabular">
                        {g.progress.value}/{g.progress.target}
                      </span>
                    )}
                  </div>
                  <ProgressBar value={g.progress.ratio} color={g.progress.achieved ? "var(--success)" : undefined} label={g.title} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.75fr_1fr]" data-reveal>
        <Card tone="amber">
          <CardTitle icon={<Lightbulb />} subtitle="Patrones reales de tus sesiones, tareas y hábitos">
            Sugerencias basadas en tus datos
          </CardTitle>
          <RecommendationList items={recs} limit={3} />
        </Card>
        <Card>
          <CardTitle
            icon={<CalendarDays />}
            subtitle="Días con actividad"
            action={
              <Link href="/stats/trends" className={cardLink}>
                Ver tendencias <ArrowRight size={12} aria-hidden />
              </Link>
            }
          >
            Tu constancia
          </CardTitle>
          <CalendarHeatmap days={daily} from={heatFrom} to={today} weekStartsOn={profile.week_starts_on} metrics={["active"]} compact />
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-surface-2/50 p-3.5">
              <p className="text-xs font-medium text-muted">Días activos</p>
              <p className="mt-1 font-display text-xl font-semibold tabular">
                {activeInHeat}
                <span className="font-sans text-sm font-medium text-muted"> / {heatDays}</span>
              </p>
              <ProgressBar value={heatDays ? activeInHeat / heatDays : 0} size="sm" className="mt-2" label="Días activos en el calendario" />
            </div>
            <div data-tone="gold" className="rounded-2xl bg-surface-2/50 p-3.5">
              <p className="text-xs font-medium text-muted">Racha más larga</p>
              <p className="mt-1 flex items-center gap-1.5 font-display text-xl font-semibold tabular">
                <Trophy size={16} className="text-tone-ink" aria-hidden />
                {streak.longest}
                <span className="font-sans text-sm font-medium text-muted">{streak.longest === 1 ? "día" : "días"}</span>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
