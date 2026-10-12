import type { Metadata } from "next";
import Link from "next/link";
import {
  AlarmClock,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  Check,
  Clock,
  Flag,
  Flame,
  Hourglass,
  Lightbulb,
  ListOrdered,
  NotebookPen,
  Play,
  PlayCircle,
  Quote,
  RefreshCw,
  Repeat,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays } from "@/lib/domain/dates";
import { formatDuration } from "@/lib/domain/stats";
import { getDayPlan, getWeeklyReview, type ReviewWeek } from "@/lib/data/planner";
import { formatLongDate, formatShortDate, PRIORITY_COLOR } from "@/lib/format";
import type { Task } from "@/lib/types";
import type { Tone } from "@/lib/sections";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { TaskCheckbox } from "@/components/tasks/task-item";
import { MoveTaskButton } from "@/components/plan/move-button";
import { PlanStep } from "@/components/plan/plan-step";
import { DayGauge } from "@/components/plan/day-gauge";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { supabase, profile, today } = await requireUser();
  const which: ReviewWeek = (await searchParams).week === "current" ? "current" : "last";
  const [plan, { review, from, to }] = await Promise.all([
    getDayPlan(supabase, profile, today, { ai: true }),
    getWeeklyReview(supabase, profile, today, which, { ai: true }),
  ]);
  const tomorrow = addDays(today, 1);
  const capacityNote = plan.capacitySource === "weekday" ? "(según este día de la semana)" : plan.capacitySource === "default" ? "(estimación inicial)" : null;

  return (
    <div className="stagger space-y-6">
      <PageHeader
        title="Plan"
        subtitle="Un plan realista para hoy y un resumen de tu semana, calculados con tus propios datos."
        action={
          <span className="card-glass inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold">
            <CalendarDays size={15} className="text-tone" aria-hidden />
            {formatLongDate(today)}
          </span>
        }
      />

      {/* Protagonista: el titular del día y el medidor frente a tu ritmo */}
      <Card variant="feature" className="p-6 sm:p-8">
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-[var(--tone-2)] opacity-40 blur-3xl" aria-hidden />
        <div className="relative grid items-center gap-x-10 gap-y-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-[13px] font-semibold ring-1 ring-inset ring-border">
                <CalendarClock size={15} aria-hidden />
                Tu plan de hoy
              </h2>
              {plan.source === "ai" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset ring-border">
                  <Sparkles size={12} aria-hidden /> Con IA
                </span>
              )}
            </div>
            <p className="mt-4 max-w-xl text-balance font-display text-[22px] font-semibold leading-[1.22] tracking-tight sm:text-[28px]" data-testid="plan-headline">
              {plan.headline}
            </p>
          </div>
          <div className="md:col-start-2 md:row-span-2 md:row-start-1">
            <DayGauge done={plan.doneMinutes} planned={plan.plannedMinutes} capacity={plan.capacityMinutes} label="Plan del día frente a tu ritmo habitual" />
          </div>
          <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Metric dot="bg-[var(--text)]" label="Hecho" value={formatDuration(plan.doneMinutes * 60)} />
            <Metric dot="bg-[var(--faint)]" label="Plan" value={formatDuration(plan.plannedMinutes * 60)} />
            <Metric
              dot="border-2 border-[var(--muted)]"
              label="Tu ritmo"
              value={formatDuration(plan.capacityMinutes * 60)}
              note={capacityNote}
              className="col-span-2 sm:col-span-1"
            />
          </dl>
        </div>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {/* Itinerario: pasos conectados, el primero destacado */}
          <Card className="space-y-6">
            <CardTitle
              icon={<ListOrdered size={16} />}
              subtitle="Lo urgente primero; después, lo que cabe en tu ritmo."
              action={
                plan.items.length > 0 && (
                  <Badge variant="tone" className="px-2.5 py-1">
                    <Clock size={12} aria-hidden /> ≈ {formatDuration(plan.plannedMinutes * 60)}
                  </Badge>
                )
              }
            >
              Itinerario
            </CardTitle>

            {plan.items.length > 0 ? (
              <div>
                <ol className="space-y-3.5" aria-label="Plan de hoy">
                  {plan.items.map((item, i) => {
                    const first = i === 0;
                    return (
                      <PlanStep key={item.task.id} index={i} first={first}>
                        <div
                          className={cn(
                            "flex flex-wrap items-start gap-3 rounded-2xl transition-colors duration-300",
                            first ? "card-tint p-4 shadow-[0_22px_44px_-28px_var(--tone)] sm:p-5" : "px-3.5 py-3 hover:bg-surface-2/60",
                            "group-data-[done]/step:bg-success-soft",
                          )}
                        >
                          {/* Las casillas sin prioridad se ven poco en oscuro: borde algo más marcado */}
                          <div className={cn("[&_button[aria-checked=false]]:border-faint", first ? "pt-1" : "pt-0.5")}>
                            <TaskCheckbox task={item.task as Task} size={first ? 22 : 20} />
                          </div>
                          <div className="min-w-0 flex-1 basis-40">
                            {first && (
                              <p className="eyebrow mb-1.5 flex items-center gap-2">
                                <span className="live-dot" aria-hidden />
                                Empieza aquí
                              </p>
                            )}
                            <p
                              className={cn(
                                "break-words transition-colors group-data-[done]/step:text-muted group-data-[done]/step:line-through",
                                first ? "font-display text-[18px] font-semibold leading-snug sm:text-[19px]" : "text-[15px] font-medium leading-snug",
                              )}
                            >
                              {item.task.title}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold tabular text-text">
                                <Clock size={11} aria-hidden /> ≈ {formatDuration(item.minutes * 60)}
                              </span>
                              {item.reasons.map((r) => (
                                <ReasonBadge key={r} reason={r} />
                              ))}
                            </div>
                          </div>
                          <Link
                            data-tone="coral"
                            href={item.justStart ? `/focus?task=${item.task.id}&just=2` : `/focus?task=${item.task.id}`}
                            className={
                              first
                                ? buttonClass("tone", "md", "shrink-0 max-sm:w-full sm:self-center")
                                : buttonClass("secondary", "sm", "shrink-0 hover:border-tone/50 max-sm:ml-8 [&_svg]:text-tone")
                            }
                            title={item.justStart ? "Solo 2 minutos para arrancar" : "Empezar a concentrarme"}
                          >
                            {item.justStart ? <Zap size={first ? 16 : 14} /> : <Play size={first ? 16 : 14} />}
                            {item.justStart ? "2 min" : "Empezar"}
                          </Link>
                        </div>
                      </PlanStep>
                    );
                  })}
                </ol>
                {/* Meta del itinerario */}
                <div className="relative mt-3.5 flex min-h-9 items-center pl-12 sm:pl-14">
                  <span className="absolute left-0 top-0 grid h-9 w-9 place-items-center rounded-full border-2 border-dashed border-tone/45 bg-surface text-tone-ink" aria-hidden>
                    <Flag size={15} />
                  </span>
                  <p className="text-sm">
                    <span className="font-semibold">Fin del plan</span>
                    <span className="text-muted"> · ≈ {formatDuration(plan.plannedMinutes * 60)} en total</span>
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<CalendarClock />}
                title="Sin pasos para hoy"
                action={
                  <Link href="/tasks" className={buttonClass("tone", "sm")}>
                    Ver mis tareas <ArrowRight size={14} />
                  </Link>
                }
              >
                Cuando tengas tareas pendientes, aquí verás en qué orden hacerlas.
              </EmptyState>
            )}

            {plan.deferred.length > 0 && (
              <section data-tone="amber" className="rounded-2xl border border-dashed border-tone/45 bg-tone-soft/45 p-3.5 sm:p-4">
                <h3 className="mb-3 flex items-center gap-2.5 text-[13px] font-semibold text-tone-ink">
                  <span className="tone-chip h-7 w-7 rounded-lg" aria-hidden>
                    <CalendarX2 size={14} />
                  </span>
                  No caben hoy (mejor moverlas a propósito)
                </h3>
                <ul className="space-y-1.5">
                  {plan.deferred.map((item) => (
                    <li key={item.task.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-surface/75 px-3 py-2.5 transition-colors hover:bg-surface">
                      <span className="min-w-0 basis-full break-words text-sm font-medium sm:flex-1 sm:basis-40 sm:truncate">{item.task.title}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold tabular text-muted">
                        <Clock size={11} aria-hidden /> ≈ {formatDuration(item.minutes * 60)}
                      </span>
                      <div className="ml-auto">
                        <MoveTaskButton id={item.task.id} to={tomorrow} label="Mover a mañana" />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="flex items-start gap-2 border-t border-border/70 pt-4 text-xs leading-relaxed text-muted">
              <RefreshCw size={13} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                El plan se recalcula cada vez que entras: urgencia, prioridad, lo que has pospuesto, tu ritmo real y lo que sueles tardar frente a lo que estimas.
                {plan.source === "ai" && " Lo ordena y redacta Claude (IA) con esos mismos datos; tu ritmo y lo que vence se calculan sin IA."}
              </span>
            </p>
          </Card>

          {(plan.tips.length > 0 || plan.pendingHabits.length > 0) && (
            <Card variant="tint" tone="amber" className="space-y-4" data-reveal>
              <CardTitle icon={<Lightbulb size={16} />} subtitle="Pequeños ajustes que marcan la diferencia.">
                Para que salga bien
              </CardTitle>
              {plan.pendingHabits.length > 0 && (
                <div data-tone="orange" className="rounded-2xl bg-tone-soft/80 p-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="tone-chip h-7 w-7 rounded-lg" aria-hidden>
                      <Flame size={14} />
                    </span>
                    <span className="text-sm font-semibold text-tone-ink">Hábitos de hoy:</span>
                    <Link href="/habits" className="press ml-auto inline-flex items-center gap-1 rounded-full bg-surface/80 px-3 py-1 text-xs font-semibold text-tone-ink hover:bg-surface">
                      Marcar
                      <ArrowRight size={12} aria-hidden />
                    </Link>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5 sm:pl-[38px]">
                    {plan.pendingHabits.map((h) => (
                      <Badge key={h.id} className="bg-surface/85 px-2.5 py-1 text-text ring-1 ring-inset ring-tone/20">
                        {h.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {plan.tips.length > 0 && (
                <ul className="space-y-2">
                  {plan.tips.map((t) => (
                    <li key={t} className="flex items-start gap-3 rounded-2xl bg-surface/60 px-3.5 py-3 text-sm leading-relaxed">
                      <span className="tone-chip-soft mt-0.5 h-7 w-7 rounded-lg" aria-hidden>
                        <Lightbulb size={14} />
                      </span>
                      <span className="min-w-0">{t}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        {/* Resumen semanal: titular y secciones con su color */}
        <Card className="space-y-4 lg:sticky lg:top-6">
          <CardTitle
            icon={<NotebookPen size={16} />}
            subtitle={
              <span className="tabular">
                {formatShortDate(from)} – {formatShortDate(to)}
              </span>
            }
          >
            Resumen semanal
          </CardTitle>
          <nav className="seg flex w-full" aria-label="Semana del resumen">
            <Link href="/plan" aria-current={which === "last" ? "page" : undefined} className="flex-1 justify-center">
              Semana pasada
            </Link>
            <Link href="/plan?week=current" aria-current={which === "current" ? "page" : undefined} className="flex-1 justify-center">
              Esta semana
            </Link>
          </nav>
          <div className="relative rounded-2xl bg-surface-2/60 py-4 pl-5 pr-4">
            <span className="absolute bottom-4 left-0 top-4 w-1 rounded-full bg-gradient-to-b from-tone to-tone-2" aria-hidden />
            <p className="eyebrow mb-1.5 flex items-center gap-1.5">
              <Quote size={11} aria-hidden /> En una frase
            </p>
            <p className="text-balance font-display text-[18px] font-semibold leading-snug" data-testid="review-headline">
              {review.headline}
            </p>
          </div>
          <ReviewList tone="green" title="Lo que salió bien" icon={<ThumbsUp />} items={review.wins} kind="wins" />
          <ReviewList tone="amber" title="Para mejorar" icon={<TrendingUp />} items={review.improve} kind="improve" />
          <ReviewList title={which === "last" ? "Para esta semana" : "Para lo que queda"} icon={<Sparkles />} items={review.nextWeek} kind="next" />
          {review.source === "ai" && (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Sparkles size={12} className="text-tone" aria-hidden />
              Redactado por Claude (IA) a partir de tus totales de la semana.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Cifra del día dentro de la tarjeta destacada. */
function Metric({ dot, label, value, note, className }: { dot: string; label: string; value: string; note?: string | null; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-2xl bg-surface px-3.5 py-2.5 ring-1 ring-inset ring-border", className)}>
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} aria-hidden />
        {label}
      </dt>
      <dd className="mt-0.5 font-display text-[19px] font-semibold tabular leading-tight">
        {value}
        {note && <span className="block font-sans text-[11px] font-medium text-muted">{note}</span>}
      </dd>
    </div>
  );
}

type ReasonStyle = { variant: "neutral" | "tone" | "success" | "warning" | "danger"; icon: React.ReactNode; color?: string };

/** Color e icono de cada motivo del plan (los que redacta la IA quedan en neutro). */
function reasonStyle(reason: string): ReasonStyle {
  if (/^Venci/.test(reason)) return { variant: "danger", icon: <AlarmClock size={11} aria-hidden /> };
  if (reason === "Vence hoy") return { variant: "warning", icon: <AlarmClock size={11} aria-hidden /> };
  if (reason.startsWith("Vence")) return { variant: "tone", icon: <CalendarDays size={11} aria-hidden /> };
  if (reason === "Prioridad alta") return { variant: "neutral", icon: <Flag size={11} aria-hidden />, color: PRIORITY_COLOR[3] };
  if (reason === "Ya la empezaste") return { variant: "success", icon: <PlayCircle size={11} aria-hidden /> };
  if (reason.startsWith("Pospuesta")) return { variant: "warning", icon: <Repeat size={11} aria-hidden /> };
  if (reason.startsWith("Creada")) return { variant: "neutral", icon: <Hourglass size={11} aria-hidden /> };
  return { variant: "neutral", icon: null };
}

function ReasonBadge({ reason }: { reason: string }) {
  const s = reasonStyle(reason);
  return (
    <Badge variant={s.variant} color={s.color}>
      {s.icon}
      {reason}
    </Badge>
  );
}

// Logros que merecen oro: objetivos, récords y mejores marcas.
const GOLD = /objetivo|récord|mejor/i;

function ReviewList({
  title,
  icon,
  items,
  tone,
  kind,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  tone?: Tone;
  kind: "wins" | "improve" | "next";
}) {
  if (items.length === 0) return null;
  return (
    <section data-tone={tone} className="rounded-2xl bg-tone-soft/55 p-4 ring-1 ring-inset ring-tone/15">
      <h3 className="mb-3 flex items-center gap-2.5 text-[11.5px] font-bold uppercase tracking-[0.1em] text-tone-ink">
        <span className="tone-chip h-7 w-7 rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5" aria-hidden>
          {icon}
        </span>
        {title}
        <span className="ml-auto rounded-full bg-surface/80 px-2 py-0.5 text-[11px] tabular tracking-normal" aria-hidden>
          {items.length}
        </span>
      </h3>
      <ul className="space-y-2.5 text-sm leading-relaxed">
        {items.map((t, i) => {
          const gold = kind === "wins" && GOLD.test(t);
          return (
            <li key={t} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10.5px] font-bold",
                  gold ? "bg-[var(--gold)] text-white dark:text-bg" : kind === "next" ? "bg-tone text-white dark:text-bg" : "bg-surface text-tone-ink ring-1 ring-inset ring-tone/25",
                )}
              >
                {gold ? <Trophy size={11} /> : kind === "wins" ? <Check size={12} strokeWidth={3} /> : kind === "improve" ? <ArrowUpRight size={12} strokeWidth={2.5} /> : i + 1}
              </span>
              <span className="min-w-0">{t}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
