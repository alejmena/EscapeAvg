import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Flame, Lightbulb, NotebookPen, Play, Sparkles, ThumbsUp, TrendingUp, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays } from "@/lib/domain/dates";
import { formatDuration } from "@/lib/domain/stats";
import { getDayPlan, getWeeklyReview, type ReviewWeek } from "@/lib/data/planner";
import { formatShortDate } from "@/lib/format";
import type { Task } from "@/lib/types";
import { Badge, Card, CardTitle, PageHeader, ProgressBar } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { TaskCheckbox } from "@/components/tasks/task-item";
import { MoveTaskButton } from "@/components/plan/move-button";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { supabase, profile, today } = await requireUser();
  const which: ReviewWeek = (await searchParams).week === "current" ? "current" : "last";
  const [plan, { review, from, to }] = await Promise.all([getDayPlan(supabase, profile, today), getWeeklyReview(supabase, profile, today, which)]);
  const tomorrow = addDays(today, 1);
  const fill = plan.capacityMinutes ? (plan.doneMinutes + plan.plannedMinutes) / plan.capacityMinutes : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Plan" subtitle="Un plan realista para hoy y un resumen de tu semana, calculados con tus propios datos." />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="space-y-5">
          <CardTitle icon={<CalendarClock size={16} />}>Tu plan de hoy</CardTitle>
          <p className="text-sm" data-testid="plan-headline">
            {plan.headline}
          </p>

          <div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>
                Hecho {formatDuration(plan.doneMinutes * 60)} · plan {formatDuration(plan.plannedMinutes * 60)}
              </span>
              <span>
                Tu ritmo: {formatDuration(plan.capacityMinutes * 60)}
                {plan.capacitySource === "weekday" ? " (según este día de la semana)" : plan.capacitySource === "default" ? " (estimación inicial)" : ""}
              </span>
            </div>
            <ProgressBar value={fill} label="Plan del día frente a tu ritmo habitual" />
          </div>

          {plan.items.length > 0 && (
            <ol className="space-y-2" aria-label="Plan de hoy">
              {plan.items.map((item, i) => (
                <li key={item.task.id} className={cn("flex items-start gap-3 rounded-xl border border-border p-3", i === 0 && "border-accent")}>
                  <TaskCheckbox task={item.task as Task} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {i === 0 && <span className="block text-[11px] font-semibold uppercase tracking-wide text-accent">Empieza aquí</span>}
                      {item.task.title}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span className="tabular">≈ {formatDuration(item.minutes * 60)}</span>
                      {item.reasons.map((r) => (
                        <Badge key={r}>{r}</Badge>
                      ))}
                    </p>
                  </div>
                  <Link
                    href={item.justStart ? `/focus?task=${item.task.id}&just=2` : `/focus?task=${item.task.id}`}
                    className={buttonClass(i === 0 ? "primary" : "secondary", "sm", "shrink-0")}
                    title={item.justStart ? "Solo 2 minutos para arrancar" : "Empezar a concentrarme"}
                  >
                    {item.justStart ? <Zap size={14} /> : <Play size={14} />}
                    {item.justStart ? "2 min" : "Empezar"}
                  </Link>
                </li>
              ))}
            </ol>
          )}

          {plan.deferred.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-medium text-muted">No caben hoy (mejor moverlas a propósito)</h3>
              <ul className="space-y-1">
                {plan.deferred.map((item) => (
                  <li key={item.task.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      {item.task.title} <span className="text-xs text-muted">· ≈ {formatDuration(item.minutes * 60)}</span>
                    </span>
                    <MoveTaskButton id={item.task.id} to={tomorrow} label="Mover a mañana" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.pendingHabits.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 text-sm">
              <Flame size={15} className="text-warning" />
              <span className="text-muted">Hábitos de hoy:</span>
              {plan.pendingHabits.map((h) => (
                <Badge key={h.id}>{h.name}</Badge>
              ))}
              <Link href="/habits" className="text-xs text-accent hover:underline">
                Marcar
              </Link>
            </p>
          )}

          {plan.tips.length > 0 && (
            <ul className="space-y-1.5 border-t border-border pt-4">
              {plan.tips.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-muted">
                  <Lightbulb size={14} className="mt-0.5 shrink-0 text-warning" />
                  {t}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted">
            El plan se recalcula cada vez que entras: urgencia, prioridad, lo que has pospuesto, tu ritmo real y lo que sueles tardar frente a lo que estimas.
          </p>
        </Card>

        <Card className="space-y-4">
          <CardTitle icon={<NotebookPen size={16} />}>Resumen semanal</CardTitle>
          <nav className="flex gap-1 text-xs" aria-label="Semana del resumen">
            <Link href="/plan" className={cn("rounded-md px-2 py-1", which === "last" ? "bg-accent-soft text-accent" : "text-muted hover:text-text")}>
              Semana pasada
            </Link>
            <Link href="/plan?week=current" className={cn("rounded-md px-2 py-1", which === "current" ? "bg-accent-soft text-accent" : "text-muted hover:text-text")}>
              Esta semana
            </Link>
          </nav>
          <p className="text-xs text-muted">
            {formatShortDate(from)} – {formatShortDate(to)}
          </p>
          <p className="text-sm font-medium" data-testid="review-headline">
            {review.headline}
          </p>
          <ReviewList title="Lo que salió bien" icon={<ThumbsUp size={14} className="text-success" />} items={review.wins} />
          <ReviewList title="Para mejorar" icon={<TrendingUp size={14} className="text-warning" />} items={review.improve} />
          <ReviewList title={which === "last" ? "Para esta semana" : "Para lo que queda"} icon={<Sparkles size={14} className="text-accent" />} items={review.nextWeek} />
        </Card>
      </div>
    </div>
  );
}

function ReviewList({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {icon}
        {title}
      </h3>
      <ul className="space-y-1.5 text-sm">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}
