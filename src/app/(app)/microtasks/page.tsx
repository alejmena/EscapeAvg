import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BarChart3, Check, ChevronDown, Crown, Flame, History, Sparkles, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays, eachDay, weekday } from "@/lib/domain/dates";
import { groupHistory } from "@/lib/domain/quick";
import { formatLongDate, formatShortDate } from "@/lib/format";
import { getQuickHistory, getQuickToday } from "@/lib/data/quick";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { QuickSetupNotice } from "@/components/microtasks/quick-tasks-card";
import { QuickSettings } from "@/components/microtasks/quick-settings";
import { QuickTasks } from "@/components/microtasks/quick-tasks";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Tareas rápidas" };

const WEEK = [1, 2, 3, 4, 5, 6, 0];
const WEEK_SHORT = ["D", "L", "M", "X", "J", "V", "S"];
const WEEK_ABBR = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// Días del historial que se ven sin desplegar.
const HISTORY_OPEN = 7;

export default async function MicrotasksPage() {
  const { supabase, profile, today } = await requireUser();
  const quick = await getQuickToday(supabase, profile, today);
  const header = (
    <PageHeader
      title="Tareas rápidas"
      subtitle="Tu historial de pequeñas tareas, las plantillas de un clic y las que se repiten solas."
      action={
        <Link href="/dashboard" className={buttonClass("secondary", "sm")}>
          <ArrowLeft size={15} /> Volver al inicio
        </Link>
      }
    />
  );
  if (!quick.ready) {
    return (
      <div>
        {header}
        <QuickSetupNotice />
      </div>
    );
  }

  const history = await getQuickHistory(supabase, profile, today, 60);
  const byDay = groupHistory(history, profile.timezone);
  const counts = new Map(byDay.map((d) => [d.day, d.titles.length]));
  const last28 = eachDay(addDays(today, -27), today);
  const activeDays = last28.filter((d) => (counts.get(d) ?? 0) > 0).length;
  const max = Math.max(1, ...last28.map((d) => counts.get(d) ?? 0));
  const total28 = last28.reduce((a, d) => a + (counts.get(d) ?? 0), 0);

  // Racha: días seguidos con alguna tarea rápida (si hoy aún no hay, cuenta desde ayer).
  let streak = 0;
  for (let d = (counts.get(today) ?? 0) > 0 ? today : addDays(today, -1); (counts.get(d) ?? 0) > 0; d = addDays(d, -1)) streak++;
  const bestDay = last28.reduce((best, d) => ((counts.get(d) ?? 0) > (counts.get(best) ?? 0) ? d : best), last28[0]);
  const bestCount = counts.get(bestDay) ?? 0;
  const average = activeDays ? total28 / activeDays : 0;

  // Mapa alineado por semanas (lunes primero).
  const pad = (weekday(last28[0]) + 6) % 7;

  // Ritmo por día de la semana (media de las últimas 4 semanas).
  const rhythm = WEEK.map((wd) => last28.filter((d) => weekday(d) === wd).reduce((a, d) => a + (counts.get(d) ?? 0), 0) / 4);
  const rhythmMax = Math.max(0.0001, ...rhythm);
  const bestWeekday = rhythm.indexOf(Math.max(...rhythm));

  // Lo que más repites (últimos 60 días).
  const freq = new Map<string, number>();
  for (const d of byDay) for (const t of d.titles) freq.set(t, (freq.get(t) ?? 0) + 1);
  const classics = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const classicsMax = classics[0]?.[1] ?? 1;

  const days = byDay.slice(0, 30);
  const historyItem = (d: (typeof days)[number]) => {
    const isToday = d.day === today;
    return (
      <li key={d.day} className="relative flex gap-3">
        <span className={cn("relative z-10 h-11 w-11 flex-col rounded-[14px] leading-none", isToday ? "tone-chip" : "tone-chip-soft")} aria-hidden>
          <span className="text-[9px] font-bold uppercase tracking-wider">{WEEK_ABBR[weekday(d.day)]}</span>
          <span className="mt-0.5 font-display text-[16px] font-bold tabular">{Number(d.day.slice(8))}</span>
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="flex items-center justify-between gap-2 text-sm font-semibold">
            <span>{isToday ? "Hoy" : formatLongDate(d.day)}</span>
            <Badge variant={isToday ? "solid" : "tone"} className="tabular">
              {d.titles.length}
            </Badge>
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {d.titles.map((t, i) => (
              <li key={i} className="inline-flex items-center gap-1 rounded-full bg-surface-2/80 py-1 pl-1.5 pr-2.5 text-xs font-medium">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-success text-white dark:text-bg" aria-hidden>
                  <Check size={10} strokeWidth={3.5} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      {header}
      <div className="grid gap-5 [grid-template-areas:'list'_'feat'_'pat'_'hist'_'set'] lg:grid-cols-[minmax(0,1fr)_380px] lg:[grid-template-areas:'feat_list'_'pat_set'_'hist_set']">
        <QuickTasks tasks={quick.tasks} templates={quick.templates} today={today} showHistoryLink={false} className="[grid-area:list]" />

        {/* Protagonista: constancia de las últimas 4 semanas */}
        <Card variant="feature" className="flex flex-col p-5 [grid-area:feat] sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[var(--tone-2)] opacity-40 blur-3xl animate-glow" aria-hidden />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow flex items-center gap-1.5">
                <Sparkles size={13} aria-hidden /> Tu constancia
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold leading-tight">Constancia: últimos 28 días</h2>
            </div>
            {streak > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold shadow-[0_8px_20px_-10px_rgb(0_0_0/0.5)]" style={{ color: "var(--tone)" }}>
                <Flame size={14} aria-hidden /> Racha de {streak} {streak === 1 ? "día" : "días"}
              </span>
            )}
          </div>

          <div className="relative mt-5 grid flex-1 gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,300px)] sm:items-center">
            <div className="min-w-0">
              <p className="flex flex-wrap items-end gap-x-3 gap-y-1 text-sm text-muted">
                <span className="num-xl text-[60px] text-text tabular sm:text-[72px]">{activeDays}</span>
                <span className="max-w-[16rem] pb-2 leading-snug">
                  de 28 días con alguna tarea rápida hecha · <span className="font-semibold text-text tabular">{total28}</span> en total
                </span>
              </p>
              <dl className="mt-5 divide-y divide-border overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
                {[
                  { icon: <Flame size={14} />, label: "Racha actual", value: `${streak} ${streak === 1 ? "día" : "días"}` },
                  { icon: <Crown size={14} />, label: "Mejor día", value: bestCount ? `${bestCount} · ${formatShortDate(bestDay)}` : "—" },
                  { icon: <BarChart3 size={14} />, label: "Media por día activo", value: average ? average.toFixed(1).replace(".", ",") : "—" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <dt className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted">
                      <span aria-hidden>{s.icon}</span>
                      <span className="truncate">{s.label}</span>
                    </dt>
                    <dd className="shrink-0 font-display text-[15px] font-bold tabular">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="min-w-0">
              <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted" aria-hidden>
                {WEEK.map((wd) => (
                  <span key={wd}>{WEEK_SHORT[wd]}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5" aria-label="Tareas rápidas completadas por día" role="img">
                {Array.from({ length: pad }, (_, i) => (
                  <span key={`pad${i}`} aria-hidden />
                ))}
                {last28.map((d, i) => {
                  const n = counts.get(d) ?? 0;
                  const alpha = n ? 0.3 + (n / max) * 0.7 : 0;
                  return (
                    <div
                      key={d}
                      title={`${formatLongDate(d)}: ${n} ${n === 1 ? "tarea" : "tareas"}`}
                      className={cn(
                        "qt-cell grid aspect-square place-items-center rounded-[9px] text-[11px] font-bold tabular",
                        !n && "bg-surface text-muted",
                        d === today && "outline-2 outline-offset-2 outline-white",
                      )}
                      style={{
                        animationDelay: `${i * 18}ms`,
                        ...(n ? { background: `rgb(255 255 255 / ${alpha.toFixed(2)})`, color: alpha >= 0.6 ? "var(--tone)" : "#fff" } : {}),
                      }}
                    >
                      {n || ""}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2.5 flex items-center justify-end gap-1 text-[10px] font-semibold text-muted" aria-hidden>
                Menos
                {[0.16, 0.4, 0.65, 1].map((a) => (
                  <span key={a} className="h-2.5 w-2.5 rounded-[4px]" style={{ background: `rgb(255 255 255 / ${a})` }} />
                ))}
                Más
              </div>
            </div>
          </div>
          <p className="relative mt-5 text-xs text-muted">Las tareas rápidas cuentan como tareas completadas, pero no suman tiempo productivo: eso solo lo hace el tiempo que cronometras.</p>
        </Card>

        <div className="grid gap-5 [grid-area:pat] sm:grid-cols-2" data-reveal>
          <Card>
            <CardTitle icon={<BarChart3 />} subtitle="Media por día · últimas 4 semanas">
              Tu ritmo semanal
            </CardTitle>
            <div className="flex h-36 items-end gap-2" role="img" aria-label="Tareas rápidas por día de la semana">
              {rhythm.map((v, i) => {
                const best = i === bestWeekday && v > 0;
                return (
                  <div key={WEEK[i]} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <span className={cn("text-[11px] font-bold tabular", best ? "text-tone-ink" : "text-muted")}>{v ? v.toFixed(1).replace(".", ",") : ""}</span>
                    <div
                      className={cn(
                        "grow-up w-full max-w-9 rounded-t-xl rounded-b-md",
                        best ? "bg-gradient-to-t from-tone to-tone-2 shadow-[0_8px_20px_-8px_var(--tone)]" : "bg-gradient-to-t from-tone/35 to-tone-2/25",
                      )}
                      style={{ height: `${Math.max(v ? 8 : 3, (v / rhythmMax) * 78)}%`, animationDelay: `${i * 70}ms` }}
                    />
                    <span className={cn("text-[11px] font-semibold", best ? "text-text" : "text-muted")}>{WEEK_SHORT[WEEK[i]]}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardTitle icon={<Trophy />} subtitle="Últimos 60 días">
              Lo que más repites
            </CardTitle>
            {classics.length === 0 ? (
              <p className="text-sm text-muted">Cuando completes algunas, aquí verás tus clásicos.</p>
            ) : (
              <ol className="space-y-2.5">
                {classics.map(([t, n], i) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <span
                      className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold tabular", i === 0 ? "tone-chip" : "bg-surface-2 text-muted")}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-[13px]">
                        <span className="truncate font-medium">{t}</span>
                        <span className="shrink-0 text-xs font-semibold text-muted tabular">×{n}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="bar-in h-full rounded-full bg-gradient-to-r from-tone to-tone-2" style={{ width: `${(n / classicsMax) * 100}%`, animationDelay: `${i * 80}ms` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <Card className="[grid-area:hist]" data-reveal>
          <CardTitle icon={<History />} subtitle={byDay.length ? `${byDay.length} días con tareas rápidas` : undefined}>
            Historial
          </CardTitle>
          {byDay.length === 0 ? (
            <EmptyState icon={<History />} title="Aún no hay tareas rápidas completadas">
              Márcalas en el inicio y aparecerán aquí.
            </EmptyState>
          ) : (
            <ol
              className="relative space-y-4 before:absolute before:bottom-3 before:left-[21px] before:top-3 before:w-0.5 before:rounded-full before:bg-gradient-to-b before:from-tone/40 before:to-transparent"
              data-testid="quick-history"
            >
              {days.slice(0, HISTORY_OPEN).map(historyItem)}
              {days.length > HISTORY_OPEN && (
                <li>
                  <details className="group/more">
                    <summary className="press relative z-10 ml-[54px] inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-tone-soft px-3 py-1.5 text-xs font-semibold text-tone-ink hover:brightness-95 [&::-webkit-details-marker]:hidden">
                      <ChevronDown size={14} className="transition-transform duration-300 group-open/more:rotate-180" aria-hidden />
                      <span className="group-open/more:hidden">Ver {days.length - HISTORY_OPEN} días más</span>
                      <span className="hidden group-open/more:inline">Ver menos</span>
                    </summary>
                    <ol className="mt-4 space-y-4">{days.slice(HISTORY_OPEN).map(historyItem)}</ol>
                  </details>
                </li>
              )}
            </ol>
          )}
        </Card>

        <div className="min-w-0 self-start [grid-area:set]">
          <QuickSettings templates={quick.templates} carryOver={quick.carryOver} />
        </div>
      </div>
    </div>
  );
}
