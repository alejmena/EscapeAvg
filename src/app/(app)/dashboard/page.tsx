import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, CheckCircle2, Flame, Medal, Play, Target, Trophy, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays, diffDays, eachDay, localHour, startOfWeek, weekday } from "@/lib/domain/dates";
import { isScheduled } from "@/lib/domain/habits";
import { compare, describeChange, formatDuration, totals, type Comparison } from "@/lib/domain/stats";
import { GOAL_METRIC_LABEL } from "@/lib/domain/goals";
import { formatLongDate, formatShortDate, greeting, WEEKDAY_SHORT } from "@/lib/format";
import { getDaily, getGoalsWithProgress, getRecommendations, getStreak } from "@/lib/data/stats";
import { getAccountStart } from "@/lib/data/analytics";
import { getProgress } from "@/lib/data/gamification";
import { getDayPlan } from "@/lib/data/planner";
import { CalendarHeatmap } from "@/components/charts/calendar-heatmap";
import type { Habit, HabitLog, Task } from "@/lib/types";
import { buttonClass } from "@/components/ui/button";
import { Card, CardTitle, EmptyState, ProgressBar } from "@/components/ui/card";
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

function Delta({ c, label }: { c: Comparison; label: string }) {
  const Icon = c.trend === "up" ? ArrowUpRight : c.trend === "down" ? ArrowDownRight : ArrowRight;
  return (
    <p className={cn("mt-1 flex items-center gap-1 text-xs", c.trend === "up" && c.pct !== null ? "text-success" : "text-muted")}>
      {c.pct !== null && <Icon size={12} />}
      {describeChange(c, label)}
    </p>
  );
}

function RingLegend({ color, label, children }: { color: string; label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} aria-hidden />
      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-wider" style={{ color }}>
          {label}
        </span>
        <span className="block text-lg font-semibold tabular">{children}</span>
      </span>
    </li>
  );
}

function StatTile({ icon, tone, label, children }: { icon: React.ReactNode; tone: string; label: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-float", tone)}>{icon}</span>
        <p className="text-xs font-medium leading-tight text-muted">{label}</p>
      </div>
      {children}
    </Card>
  );
}

export default async function DashboardPage() {
  const { supabase, profile, today, user } = await requireUser();
  const weekStart = startOfWeek(today, profile.week_starts_on);
  const elapsedInWeek = eachDay(weekStart, today).length;
  const prevWeekStart = addDays(weekStart, -7);
  const heatStart = addDays(weekStart, -7 * 15);

  const disciplineFrom = addDays(today, -400);
  const [daily, streak, goals, recs, tasksRes, habitsRes, logsRes, accountStart, progress, plan, discipline, activeRes] = await Promise.all([
    getDaily(supabase, heatStart, today),
    getStreak(supabase, today),
    getGoalsWithProgress(supabase, today, profile.week_starts_on),
    getRecommendations(supabase, today, profile.timezone, profile.week_starts_on),
    supabase
      .from("tasks")
      .select("*")
      .is("parent_id", null)
      .in("status", ["todo", "in_progress"])
      .or(`due_date.lte.${today},status.eq.in_progress`)
      .order("priority", { ascending: false })
      .order("due_date")
      .limit(8),
    supabase.from("habits").select("*").is("archived_at", null).order("position"),
    supabase.from("habit_logs").select("habit_id, log_date, status").eq("log_date", today),
    getAccountStart(supabase, profile.timezone),
    getProgress(supabase, profile.timezone, today, profile.week_starts_on),
    getDayPlan(supabase, profile, today),
    getDiscipline(supabase, profile, disciplineFrom, today),
    supabase.from("focus_sessions").select("*").in("status", ["running", "paused"]).maybeSingle<FocusSession>(),
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

  return (
    <div className="stagger space-y-6">
      {!discipline.ready && <DisciplineSetupNotice />}

      <TodayPanel
        baseSeconds={summary.todaySeconds}
        goalMinutes={discipline.goalMinutes}
        active={live}
        today={today}
        dateLabel={formatLongDate(today)}
        hello={`Hola${name ? `, ${name}` : ""}. ${greeting(hour)}`}
      />

      <section className="grid gap-3 md:grid-cols-3" aria-label="Tu progreso frente a ti mismo">
        <div className="card-glass rounded-[24px] p-5" data-testid="yesterday">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Ayer</p>
          {summary.yesterday.rank.id !== "inicio" && <RankBadge rank={summary.yesterday.rank} className="mt-3 text-xs" />}
          <p className="mt-3 text-[15px] font-medium leading-snug">{summary.yesterday.text}</p>
        </div>
        <div className="card-glass rounded-[24px] p-5" data-testid="today-vs">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Hoy</p>
          <p className="num-xl mt-3 text-[28px]">{hoursText(summary.todaySeconds)}</p>
          <p className="mt-2 text-[15px] font-medium leading-snug">{vsYesterday(summary.todaySeconds, summary.yesterday.seconds)}</p>
        </div>
        <div className="card-glass rounded-[24px] p-5" data-testid="week-goal">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Esta semana</p>
          <div className="mt-3 flex gap-1.5" aria-hidden>
            {eachDay(weekStart, addDays(weekStart, 6)).map((d) => {
              const secs = d === today ? summary.todaySeconds : (discipline.days.get(d)?.productive ?? 0);
              const hit = d <= today && secs >= discipline.goalMinutes * 60;
              const rest = d <= today && !hit && discipline.restDays.has(d);
              return (
                <span key={d} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className={cn(
                      "h-7 w-full rounded-lg",
                      hit ? "bg-gradient-to-b from-[var(--gold-2)] to-[var(--gold)]" : rest ? "bg-ring-habits/30" : d > today ? "bg-surface-2/50" : "bg-surface-2",
                    )}
                    title={`${formatLongDate(d)}: ${hoursText(secs)}`}
                  />
                  <span className="text-[10px] text-muted">{WEEKDAY_SHORT[weekday(d)]}</span>
                </span>
              );
            })}
          </div>
          <p className="mt-2 text-[15px] font-medium leading-snug">{summary.week.text}</p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <QuoteCard quote={quote} favorite={favorites.includes(quote.id)} ready={discipline.ready} />
        <SelfCompare
          best={summary.best ? { ...summary.best, label: formatShortDate(summary.best.day), rank: rankFor(summary.best.seconds) } : null}
          avg30={summary.avg30}
          todaySeconds={summary.todaySeconds}
          goalStreak={summary.goalStreak}
        />
      </div>

      <section className="card-glass relative overflow-hidden rounded-[28px] p-6">
        <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
          <ActivityRings
            size={176}
            rings={[
              { label: "Desarrollo", value: focusTarget ? summary.todaySeconds / focusTarget : 0, color: "var(--ring-focus)", color2: "var(--ring-focus-2)" },
              { label: "Tareas", value: tasksTarget ? todayStat.tasks_completed / tasksTarget : 0, color: "var(--ring-tasks)", color2: "var(--ring-tasks-2)" },
              { label: "Hábitos", value: habits.length ? habitsDone / habits.length : 0, color: "var(--ring-habits)", color2: "var(--ring-habits-2)" },
            ]}
          />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Tus anillos de hoy</p>
            <ul className="mt-3 grid gap-3 text-sm sm:grid-cols-3" aria-label="Anillos de hoy">
              <RingLegend color="var(--ring-focus)" label="Desarrollo">
                {hoursText(summary.todaySeconds)}
                <span className="text-muted"> / {hoursText(focusTarget)}</span>
              </RingLegend>
              <RingLegend color="var(--ring-tasks)" label="Tareas">
                <CountUp value={todayStat.tasks_completed} />
                <span className="text-muted"> / {tasksTarget}</span>
              </RingLegend>
              <RingLegend color="var(--ring-habits)" label="Hábitos">
                <CountUp value={habitsDone} />
                <span className="text-muted"> / {habits.length}</span>
              </RingLegend>
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/focus" className={buttonClass("secondary", "md")}>
                <Play size={16} /> Empezar a concentrarme
              </Link>
              <Link href="/focus?just=2" className={buttonClass("ghost", "md")} title="Solo 2 minutos">
                <Zap size={16} /> Just Start
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="contents">
          <Link href="/plan" className="lift card-glass group flex min-w-0 items-center gap-4 rounded-[24px] p-5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-accent-fg shadow-float">
              <CalendarClock size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">Tu plan de hoy</span>
              <span className="block truncate text-sm text-muted">
                {nextUp
                  ? `Empieza por "${nextUp.task.title}" · ${plan.items.length} ${plan.items.length === 1 ? "tarea" : "tareas"}, ≈ ${formatDuration(plan.plannedMinutes * 60)}`
                  : plan.headline}
              </span>
            </span>
            <ArrowRight size={18} className="shrink-0 text-accent transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/progress"
            className="lift card-glass flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-[24px] p-5"
            aria-label={`Nivel ${level.level}, ${level.title}. Ver progreso`}
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-warning to-ring-focus text-lg font-bold text-white shadow-float tabular">
              {level.level}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-[15px] font-semibold">{level.title}</span>
                <span className="text-xs text-muted tabular">
                  {level.into}/{level.needed} XP{todayXp > 0 ? ` · +${todayXp} hoy` : ""}
                </span>
              </span>
              <ProgressBar value={level.ratio} className="mt-2" label={`Progreso hacia el nivel ${level.level + 1}`} />
            </span>
            {newAchievements.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning">
                <Trophy size={13} /> {newAchievements.length === 1 ? `Logro nuevo: ${newAchievements[0].title}` : `${newAchievements.length} logros nuevos`}
              </span>
            )}
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<Medal size={18} />} tone="from-[var(--gold)] to-[var(--gold-2)]" label="Concentración registrada hoy">
          <p className="num-xl mt-3 text-[22px] sm:text-[28px]">
            <CountUp value={todayStat.focus_seconds} kind="duration" />
          </p>
          <Delta c={focusVsYesterday} label="ayer" />
          {todayStat.focus_seconds - summary.todaySeconds >= 60 && (
            <p className="mt-1 text-xs text-muted">{hoursText(todayStat.focus_seconds - summary.todaySeconds)} no cuentan como desarrollo</p>
          )}
        </StatTile>
        <StatTile icon={<CheckCircle2 size={18} />} tone="from-ring-tasks to-[var(--ring-tasks-2)]" label="Tareas completadas">
          <p className="num-xl mt-3 text-[22px] sm:text-[28px]">
            <CountUp value={todayStat.tasks_completed} />
          </p>
          <Delta c={tasksVsYesterday} label="ayer" />
        </StatTile>
        <StatTile icon={<Flame size={18} />} tone="from-ring-habits to-[var(--ring-habits-2)]" label="Hábitos hoy">
          <p className="num-xl mt-3 text-[22px] sm:text-[28px]">
            <CountUp value={habitsDone} />
            <span className="text-lg font-medium text-muted">/{habits.length}</span>
          </p>
          <p className="mt-1 text-xs text-muted">{habits.length ? "programados para hoy" : "ninguno programado"}</p>
        </StatTile>
        <StatTile icon={<Flame size={18} />} tone="from-warning to-ring-focus" label="Racha de constancia">
          {profile.streaks_enabled ? (
            <>
              <p className="num-xl mt-3 text-[22px] sm:text-[28px]">
                <CountUp value={streak.current} /> <span className="text-lg font-medium text-muted">{streak.current === 1 ? "día" : "días"}</span>
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                {streak.pendingToday && !streak.restToday && <span>Haz algo hoy para mantenerla.</span>}
                {streak.longest > streak.current && <span>Récord: {streak.longest}</span>}
                <RestDayButton today={today} isRest={streak.restToday} />
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">Rachas desactivadas en ajustes.</p>
          )}
        </StatTile>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle action={<Link href="/stats" className="text-xs text-accent hover:underline">Ver estadísticas</Link>}>Esta semana</CardTitle>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-muted">Concentración</p>
                <p className="text-sm tabular">
                  {formatDuration(thisWeek.focus_seconds)}
                  {goalSeconds > 0 && <span className="text-muted"> / {formatDuration(goalSeconds)}</span>}
                </p>
              </div>
              {goalSeconds > 0 && <ProgressBar value={thisWeek.focus_seconds / goalSeconds} className="mt-2" label="Objetivo semanal de concentración" />}
              <Delta c={weekFocus} label="los mismos días de la semana pasada" />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-muted">Tareas completadas</p>
                <p className="text-sm tabular">{thisWeek.tasks_completed}</p>
              </div>
              <p className="mt-2 text-xs text-muted">
                {thisWeek.active_days} de {elapsedInWeek} días activos
              </p>
              <Delta c={weekTasks} label="los mismos días de la semana pasada" />
            </div>
          </div>
          <BarChart
            height={120}
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

        <Card>
          <CardTitle icon={<Target size={15} />} action={<Link href="/goals" className="text-xs text-accent hover:underline">Gestionar</Link>}>
            Objetivos activos
          </CardTitle>
          {goals.length === 0 ? (
            <EmptyState title="Sin objetivos">
              <Link href="/goals" className="text-accent">
                Crea uno realista
              </Link>{" "}
              para esta semana.
            </EmptyState>
          ) : (
            <ul className="space-y-4">
              {goals.slice(0, 4).map((g) => (
                <li key={g.id}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="truncate">{g.title}</span>
                    <span className="tabular text-muted">
                      {g.progress.value}/{g.progress.target}
                    </span>
                  </div>
                  <ProgressBar value={g.progress.ratio} color={g.progress.achieved ? "var(--success)" : undefined} label={g.title} />
                  <p className="mt-1 text-[11px] text-muted">{GOAL_METRIC_LABEL[g.metric]}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle action={<Link href="/tasks" className="text-xs text-accent hover:underline">Todas las tareas</Link>}>Para hoy</CardTitle>
          {tasks.length === 0 ? (
            <EmptyState title="Nada urgente para hoy">
              <Link href="/tasks" className="text-accent">
                Planifica una tarea pequeña
              </Link>{" "}
              o dedica una sesión a un proyecto.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <TaskCheckbox task={t} />
                  <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                  {t.due_date && t.due_date < today && <span className="text-xs text-danger">vencida</span>}
                  <Link href={`/focus?task=${t.id}`} className="rounded-lg p-1.5 text-accent hover:bg-accent-soft" aria-label={`Concentrarme en ${t.title}`}>
                    <Play size={15} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle action={<Link href="/habits" className="text-xs text-accent hover:underline">Hábitos</Link>}>Hábitos de hoy</CardTitle>
          {habits.length === 0 ? (
            <EmptyState title="Nada programado hoy">
              <Link href="/habits" className="text-accent">
                Crea un hábito
              </Link>
            </EmptyState>
          ) : (
            <div className="space-y-2">
              {habits.map((h) => (
                <HabitToggle key={h.id} id={h.id} name={h.name} color={h.color} done={doneHabitIds.has(h.id)} today={today} value={h.target_value} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Sugerencias basadas en tus datos</CardTitle>
          <RecommendationList items={recs} limit={3} />
        </Card>
        <Card>
          <CardTitle action={<Link href="/stats/trends" className="text-xs text-accent hover:underline">Ver tendencias</Link>}>Tu constancia</CardTitle>
          <CalendarHeatmap days={daily} from={heatFrom} to={today} weekStartsOn={profile.week_starts_on} metrics={["active"]} compact />
        </Card>
      </div>
    </div>
  );
}
