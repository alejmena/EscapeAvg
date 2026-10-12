"use client";

import "./schedule.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, CalendarCheck2, CalendarPlus, Clock3, Coffee, Flame, Layers, Lightbulb, PieChart, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { WEEKDAY_NAME } from "@/lib/format";
import { formatTime, visibleRange, WEEK_ORDER, weeklyMinutes } from "@/lib/domain/schedule";
import { formatDuration } from "@/lib/domain/stats";
import type { ScheduleBlock } from "@/lib/types";
import { deleteScheduleBlock, updateScheduleBlock } from "@/app/(app)/schedule/actions";
import { useAction } from "@/components/tasks/use-action";
import { Modal } from "@/components/ui/modal";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge, Card, CardTitle, ProgressBar, StatTile } from "@/components/ui/card";
import { ErrorText, Field, Input, Select } from "@/components/ui/form";
import { BLOCK_COLORS, BlockForm, ColorSwatches, inkFor } from "./block-form";

const HOUR_PX = 56;

/** "Ahora" que avanza solo: parte del minuto que calculó el servidor (en tu zona horaria) y suma el tiempo pasado. */
function useLiveNow(weekday: number, minute: number) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 60_000)), 30_000);
    return () => clearInterval(id);
  }, []);
  const total = minute + elapsed;
  return { weekday: (weekday + Math.floor(total / 1440)) % 7, minute: total % 1440 };
}

/** "11,5 h" o "45 min": para listas donde cabe poco. */
function compactHours(minutes: number) {
  return minutes < 60 ? `${minutes} min` : `${(minutes / 60).toLocaleString("es-ES", { maximumFractionDigits: 1 })} h`;
}

/** Duración corta para cifras: "34 h 30" con las unidades más pequeñas. */
function Hours({ minutes }: { minutes: number }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return <>{m}<span className="ml-0.5 text-[0.55em] font-semibold text-muted">min</span></>;
  return (
    <>
      {h}
      <span className="ml-0.5 text-[0.55em] font-semibold text-muted">h</span>
      {m > 0 && (
        <>
          {" "}
          {m}
          <span className="ml-0.5 text-[0.55em] font-semibold text-muted">min</span>
        </>
      )}
    </>
  );
}

export function ScheduleView({ blocks, weekday, nowMinute }: { blocks: ScheduleBlock[]; weekday: number; nowMinute: number }) {
  const [adding, setAdding] = useState<number | null>(null);
  const [open, setOpen] = useState<ScheduleBlock | null>(null);
  const [day, setDay] = useState(weekday);
  const now = useLiveNow(weekday, nowMinute);
  const { from, to } = visibleRange(blocks);
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => from / 60 + i);

  const totals = new Map<string, { minutes: number; color: string; idea: string | null }>();
  for (const b of blocks) {
    const t = totals.get(b.title) ?? { minutes: 0, color: b.color, idea: b.idea_key };
    t.minutes += b.end_minute - b.start_minute;
    totals.set(b.title, t);
  }
  const summary = [...totals.entries()].sort((a, b) => b[1].minutes - a[1].minutes);
  const byDay = (d: number) => blocks.filter((b) => b.day_of_week === d).sort((a, b) => a.start_minute - b.start_minute);
  const dayBlocks = byDay(day);
  const weekly = weeklyMinutes(blocks);
  const perDay = WEEK_ORDER.map((d) => ({ d, minutes: weeklyMinutes(byDay(d)) }));
  const maxDay = Math.max(1, ...perDay.map((p) => p.minutes));
  const busiest = perDay.reduce((a, b) => (b.minutes > a.minutes ? b : a), perDay[0]);
  const lightest = perDay.reduce((a, b) => (b.minutes < a.minutes ? b : a), perDay[0]);
  const today = byDay(now.weekday);
  const todayMinutes = weeklyMinutes(today);
  const maxActivity = summary[0]?.[1].minutes ?? 1;

  return (
    <div className="space-y-6">
      {/* Protagonista: lo que toca ahora + cifras de la semana */}
      <div className={cn("grid gap-4", blocks.length > 0 && "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]")}>
        <NowCard blocks={blocks} today={today} now={now} onAdd={() => setAdding(day)} />
        {blocks.length > 0 && (
          <div className="stagger grid grid-cols-2 gap-3 sm:gap-4">
            <StatTile icon={<Clock3 />} label="A la semana" value={<Hours minutes={weekly} />} footnote={`${formatDuration(weekly * 60)} reservadas a la semana`} />
            <StatTile icon={<CalendarCheck2 />} tone="sky" label="Hoy" value={<Hours minutes={todayMinutes} />} footnote={`${today.length} ${today.length === 1 ? "bloque" : "bloques"} · ${WEEKDAY_NAME[now.weekday].toLowerCase()}`} />
            <StatTile icon={<Layers />} tone="violet" label="Actividades" value={totals.size} footnote={`${blocks.length} bloques en total`} />
            <StatTile icon={<Flame />} tone="coral" label="Día más cargado" value={<span className="text-[0.8em]">{WEEKDAY_NAME[busiest.d]}</span>} footnote={formatDuration(busiest.minutes * 60)} />
          </div>
        )}
      </div>

      {/* Móvil: un día cada vez */}
      <div className="md:hidden">
        <div className="seg mb-4 flex w-full" role="tablist" aria-label="Día">
          {WEEK_ORDER.map((d) => {
            const items = byDay(d);
            return (
              <button
                key={d}
                role="tab"
                aria-selected={day === d}
                onClick={() => setDay(d)}
                className={cn("press h-12! min-w-0 flex-1 flex-col justify-center gap-1! px-0!", d === now.weekday && day !== d && "text-tone-ink!")}
              >
                {WEEKDAY_NAME[d].slice(0, 3)}
                <span className="flex h-1.5 gap-0.5" aria-hidden>
                  {items.slice(0, 3).map((b) => (
                    <span key={b.id} className="h-1.5 w-1.5 rounded-full" style={{ background: b.color }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mb-3 flex items-center gap-2">
          <p className="font-display text-lg font-semibold">{WEEKDAY_NAME[day]}</p>
          {day === now.weekday && <Badge variant="solid">Hoy</Badge>}
          <span className="ml-auto text-xs text-muted tabular">
            {dayBlocks.length} {dayBlocks.length === 1 ? "bloque" : "bloques"} · {formatDuration(weeklyMinutes(dayBlocks) * 60)}
          </span>
        </div>
        <ul className="relative space-y-2.5" data-testid="schedule-day-list">
          {dayBlocks.length === 0 && (
            <li className="flex flex-col items-center gap-2 rounded-[22px] border border-dashed border-border-strong bg-surface/40 px-6 py-8 text-center text-sm text-muted">
              <span className="tone-chip-soft h-11 w-11 rounded-2xl">
                <Coffee size={20} aria-hidden />
              </span>
              Día libre. Toca «Añadir bloque» para ocuparlo.
            </li>
          )}
          {dayBlocks.map((b, i) => {
            const isNow = day === now.weekday && now.minute >= b.start_minute && now.minute < b.end_minute;
            const prev = dayBlocks[i - 1];
            const gap = prev ? b.start_minute - prev.end_minute : 0;
            return (
              <li key={b.id}>
                {gap >= 30 && (
                  <p className="mb-2.5 flex items-center gap-2 pl-[3.75rem] text-[11.5px] font-medium text-faint">
                    <span className="h-px flex-1 border-t border-dashed border-border-strong" aria-hidden />
                    Libre · {formatDuration(gap * 60)}
                    <span className="h-px flex-1 border-t border-dashed border-border-strong" aria-hidden />
                  </p>
                )}
                <div className="flex items-stretch gap-3">
                  <div className="w-12 shrink-0 pt-2.5 text-right leading-tight">
                    <p className="font-display text-[15px] font-bold tabular">{formatTime(b.start_minute)}</p>
                    <p className="text-[11px] text-muted tabular">{formatTime(b.end_minute)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(b)}
                    className={cn("sched-row lift relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-2xl border border-card-border py-3 pl-5 pr-3 text-left shadow-float", isNow && "ring-2 ring-tone")}
                    style={{ "--c": b.color } as React.CSSProperties}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{b.title}</span>
                      <span className="block truncate text-sm text-muted tabular">
                        {formatTime(b.start_minute)} – {formatTime(b.end_minute)} · {formatDuration((b.end_minute - b.start_minute) * 60)}
                      </span>
                    </span>
                    {b.idea_key && <Lightbulb size={15} className="shrink-0 text-muted" aria-label="Viene de Ideas" />}
                    {isNow && (
                      <Badge variant="solid" className="shrink-0">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden /> Ahora
                      </Badge>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Ordenador: semana completa tipo horario escolar */}
      <Card className="hidden overflow-x-auto p-3 md:block lg:p-4">
        <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `52px repeat(7, minmax(0, 1fr))` }}>
          <div />
          {WEEK_ORDER.map((d) => {
            const isToday = d === now.weekday;
            const mins = perDay.find((p) => p.d === d)!.minutes;
            return (
              <div key={d} className="px-1 pb-3">
                <button
                  type="button"
                  onClick={() => setAdding(d)}
                  className={cn(
                    "press group relative flex w-full flex-col items-center rounded-2xl px-1 py-2 transition-colors",
                    isToday ? "bg-gradient-to-br from-tone to-tone-2 text-white shadow-[0_10px_22px_-12px_var(--tone)]" : "text-text hover:bg-surface-2/80",
                  )}
                  title={`Añadir bloque el ${WEEKDAY_NAME[d].toLowerCase()}`}
                >
                  <span className="font-display text-[15px] font-semibold">{WEEKDAY_NAME[d]}</span>
                  <span className={cn("text-[11px] tabular", isToday ? "text-white/80" : "text-muted")} aria-hidden>
                    {isToday ? "Hoy · " : ""}
                    {mins ? formatDuration(mins * 60) : "Libre"}
                  </span>
                  <span
                    className={cn(
                      "absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full opacity-0 transition-opacity group-hover:opacity-100",
                      isToday ? "bg-white/25" : "bg-tone-soft text-tone-ink",
                    )}
                    aria-hidden
                  >
                    <Plus size={12} />
                  </span>
                </button>
              </div>
            );
          })}
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h, i) => (
              <span key={h} className="absolute right-2.5 -translate-y-1/2 text-[11px] font-medium text-faint tabular" style={{ top: i * HOUR_PX }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
            {now.minute >= from && now.minute <= to && (
              <span
                className="absolute right-1 z-10 -translate-y-1/2 rounded-full bg-gradient-to-r from-tone to-tone-2 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-[0_4px_10px_-4px_var(--tone)] tabular"
                style={{ top: ((now.minute - from) / 60) * HOUR_PX }}
                aria-hidden
              >
                {formatTime(now.minute)}
              </span>
            )}
          </div>
          {WEEK_ORDER.map((d) => {
            const isToday = d === now.weekday;
            return (
              <div
                key={d}
                className={cn("relative border-l border-border/70", isToday && "rounded-b-2xl bg-gradient-to-b from-tone-soft/70 to-tone-soft/20")}
                style={{ height: hours.length * HOUR_PX }}
                data-testid={`schedule-col-${d}`}
              >
                {hours.map((h, i) => (
                  <div key={h}>
                    <div className="absolute inset-x-0 border-t border-border/60" style={{ top: i * HOUR_PX }} />
                    <div className="sched-half absolute inset-x-0" style={{ top: i * HOUR_PX + HOUR_PX / 2 }} />
                  </div>
                ))}
                {now.minute >= from && now.minute <= to &&
                  (isToday ? (
                    <div className="sched-now absolute inset-x-0" style={{ top: ((now.minute - from) / 60) * HOUR_PX }} aria-label="Ahora" />
                  ) : (
                    <div className="sched-now-faint absolute inset-x-0" style={{ top: ((now.minute - from) / 60) * HOUR_PX }} aria-hidden />
                  ))}
                {byDay(d).map((b) => {
                  const height = Math.max(24, ((b.end_minute - b.start_minute) / 60) * HOUR_PX - 4);
                  const isNow = isToday && now.minute >= b.start_minute && now.minute < b.end_minute;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setOpen(b)}
                      data-now={isNow || undefined}
                      className="sched-block press absolute inset-x-1 overflow-hidden rounded-xl py-1.5 pl-3 pr-1.5 text-left text-[12px] leading-tight"
                      style={{ top: ((b.start_minute - from) / 60) * HOUR_PX + 2, height, "--c": b.color, color: inkFor(b.color) } as React.CSSProperties}
                    >
                      <span className={cn("block font-semibold", height >= 72 ? "line-clamp-2" : "truncate")}>{b.title}</span>
                      {height >= 38 && (
                        <span className="mt-0.5 block truncate font-display text-[11.5px] font-semibold opacity-80 tabular">
                          {formatTime(b.start_minute)}–{formatTime(b.end_minute)}
                        </span>
                      )}
                      {height >= 96 && b.idea_key && <Lightbulb size={13} className="mt-1.5 opacity-70" aria-hidden />}
                      {isNow && (
                        <span
                          className="pointer-events-none absolute inset-x-0 top-0 border-b-2 border-current bg-current opacity-15"
                          style={{ height: `${((now.minute - b.start_minute) / (b.end_minute - b.start_minute)) * 100}%` }}
                          aria-hidden
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Card>

      {summary.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Card data-reveal>
            <CardTitle icon={<PieChart />} subtitle={`${summary.length} actividades · ${formatDuration(weekly * 60)}`}>
              Horas por semana
            </CardTitle>
            {/* Composición de la semana */}
            <div className="mb-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {summary.map(([title, t]) => (
                <span key={title} className="bar-in h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(t.minutes / weekly) * 100}%`, background: t.color }} />
              ))}
            </div>
            <ul className="grid gap-1 sm:grid-cols-2 sm:gap-x-4">
              {summary.map(([title, t]) => (
                <li key={title} className="flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors hover:bg-surface-2/60">
                  <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: t.color, boxShadow: `0 0 10px -2px ${t.color}` }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm">
                      <span className="truncate font-medium">{title}</span>
                      {t.idea && <Lightbulb size={12} className="shrink-0 text-faint" aria-hidden />}
                    </span>
                    <ProgressBar value={t.minutes / maxActivity} color={t.color} size="sm" className="mt-1.5" />
                  </span>
                  <span className="shrink-0 text-right font-display text-[15px] font-semibold tabular">{compactHours(t.minutes)}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card data-reveal>
            <CardTitle icon={<BarChart3 />} subtitle="Horas reservadas cada día">
              Día a día
            </CardTitle>
            <div className="flex h-48 items-end gap-2 sm:gap-3">
              {perDay.map(({ d, minutes }, i) => {
                const isToday = d === now.weekday;
                return (
                  <div key={d} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                    <span className={cn("text-[11px] font-semibold tabular", isToday ? "text-tone-ink" : "text-muted")}>{minutes ? `${Math.round((minutes / 60) * 10) / 10} h` : "–"}</span>
                    <div
                      className={cn(
                        "grow-up w-full max-w-10 rounded-t-xl rounded-b-md bg-gradient-to-t from-tone to-tone-2",
                        isToday ? "shadow-[0_8px_20px_-8px_var(--tone)]" : "opacity-45",
                      )}
                      style={{ height: `${Math.max(4, (minutes / maxDay) * 100)}%`, animationDelay: `${i * 60}ms` }}
                    />
                    <span className={cn("text-xs", isToday ? "font-bold text-text" : "text-muted")}>{WEEKDAY_NAME[d].slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border pt-4 text-sm">
              <div className="rounded-2xl bg-surface-2/60 px-3 py-2.5">
                <p className="text-xs text-muted">Media diaria</p>
                <p className="mt-0.5 font-display text-lg font-semibold tabular">{formatDuration(Math.round(weekly / 7) * 60)}</p>
              </div>
              <div className="rounded-2xl bg-surface-2/60 px-3 py-2.5">
                <p className="text-xs text-muted">Día más libre</p>
                <p className="mt-0.5 font-display text-lg font-semibold">{WEEKDAY_NAME[lightest.d]}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Modal open={adding !== null} onClose={() => setAdding(null)} title="Añadir al horario" sheet>
        {adding !== null && <BlockForm key={adding} defaultDay={adding} onDone={() => setAdding(null)} />}
      </Modal>
      {open && <BlockDetail block={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Tarjeta destacada: el bloque de ahora (con lo que queda), el siguiente o el día libre. */
function NowCard({
  blocks,
  today,
  now,
  onAdd,
}: {
  blocks: ScheduleBlock[];
  today: ScheduleBlock[];
  now: { weekday: number; minute: number };
  onAdd: () => void;
}) {
  const current = today.find((b) => now.minute >= b.start_minute && now.minute < b.end_minute);
  const next = today.find((b) => b.start_minute > now.minute);
  // Primer bloque de los próximos días (para cuando hoy ya no queda nada).
  const upcoming = (() => {
    for (let i = 1; i <= 7; i++) {
      const d = (now.weekday + i) % 7;
      const first = blocks.filter((b) => b.day_of_week === d).sort((a, b) => a.start_minute - b.start_minute)[0];
      if (first) return { first, d, i };
    }
    return null;
  })();

  let eyebrow: string;
  let title: string;
  let body: React.ReactNode;
  if (!blocks.length) {
    eyebrow = "Empieza aquí";
    title = "Tu horario está vacío";
    body = <p className="max-w-md text-[15px] leading-relaxed text-muted">Añade tus clases, trabajo o estudio, o elige una habilidad en Ideas y ponla en tus horas libres.</p>;
  } else if (current) {
    const left = current.end_minute - now.minute;
    const after = today.find((b) => b.start_minute >= current.end_minute);
    eyebrow = `Ahora · ${WEEKDAY_NAME[now.weekday]}`;
    title = current.title;
    body = (
      <div className="space-y-3">
        <p className="num-xl text-[26px] sm:text-[30px]">
          {formatTime(current.start_minute)} <span className="text-muted">–</span> {formatTime(current.end_minute)}
        </p>
        <div className="max-w-md">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Progreso del bloque" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(((now.minute - current.start_minute) / (current.end_minute - current.start_minute)) * 100)}>
            <div className="bar-in h-full rounded-full bg-white shadow-[0_0_12px_rgb(255_255_255/0.7)]" style={{ width: `${((now.minute - current.start_minute) / (current.end_minute - current.start_minute)) * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">
            Quedan <b className="text-text">{formatDuration(left * 60)}</b>
            {after && (
              <>
                {" "}· Después: {after.title} a las {formatTime(after.start_minute)}
              </>
            )}
          </p>
        </div>
      </div>
    );
  } else if (next) {
    eyebrow = `A continuación · hoy`;
    title = next.title;
    body = (
      <div className="space-y-1.5">
        <p className="num-xl text-[26px] sm:text-[30px]">
          {formatTime(next.start_minute)} <span className="text-muted">–</span> {formatTime(next.end_minute)}
        </p>
        <p className="text-sm text-muted">
          Empieza en <b className="text-text">{formatDuration((next.start_minute - now.minute) * 60)}</b>. Buen momento para prepararte.
        </p>
      </div>
    );
  } else {
    eyebrow = `Hoy · ${WEEKDAY_NAME[now.weekday]}`;
    title = today.length ? "Has terminado por hoy" : "Día libre";
    body = upcoming && (
      <p className="text-sm text-muted">
        {upcoming.i === 1 ? "Mañana" : `El ${WEEKDAY_NAME[upcoming.d].toLowerCase()}`} empiezas con <b className="text-text">{upcoming.first.title}</b> a las {formatTime(upcoming.first.start_minute)}.
      </p>
    );
  }

  return (
    <Card variant="feature" className="flex min-h-[15rem] flex-col justify-between gap-6">
      <div className="pointer-events-none absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <CalendarPlus className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 rotate-12 text-white opacity-[0.08]" aria-hidden />
      <div className="relative min-w-0 space-y-3">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/85">
          {current ? <span className="live-dot bg-white!" aria-hidden /> : <Clock3 size={13} aria-hidden />}
          {eyebrow}
        </p>
        <h2 className="line-clamp-2 text-[28px] font-bold leading-[1.05] sm:text-[34px]">{title}</h2>
        {body}
      </div>
      {today.length > 0 && <DayTrack today={today} minute={now.minute} />}
      <div className="relative flex flex-wrap items-center gap-2">
        <button type="button" onClick={onAdd} className={buttonClass("inverse", "md")}>
          <CalendarPlus size={16} /> Añadir bloque
        </button>
        <Link href="/ideas" className="press inline-flex h-10 items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 text-sm font-semibold text-white backdrop-blur hover:bg-white/25">
          <Lightbulb size={16} /> Elegir de las ideas
        </Link>
      </div>
    </Card>
  );
}

/** Pista del día: los bloques de hoy sobre una línea de tiempo, con el momento actual marcado. */
function DayTrack({ today, minute }: { today: ScheduleBlock[]; minute: number }) {
  const from = Math.min(8 * 60, Math.floor(today[0].start_minute / 60) * 60);
  const to = Math.max(20 * 60, Math.ceil(Math.max(...today.map((b) => b.end_minute)) / 60) * 60);
  const pos = (m: number) => `${((Math.min(Math.max(m, from), to) - from) / (to - from)) * 100}%`;
  return (
    <div className="relative" aria-hidden>
      <div className="relative h-3 rounded-full bg-white/15">
        {today.map((b) => {
          const state = minute >= b.end_minute ? "past" : minute >= b.start_minute ? "now" : "next";
          return (
            <span
              key={b.id}
              className={cn("absolute inset-y-0 rounded-full", state === "past" ? "bg-white/35" : state === "now" ? "bg-white shadow-[0_0_14px_rgb(255_255_255/0.8)]" : "bg-white/65")}
              style={{ left: pos(b.start_minute), width: `calc(${pos(b.end_minute)} - ${pos(b.start_minute)} - 2px)` }}
            />
          );
        })}
        {minute >= from && minute <= to && <span className="absolute -top-1.5 h-6 w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgb(0_0_0/0.12)]" style={{ left: pos(minute) }} />}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-medium text-faint tabular">
        <span>{formatTime(from)}</span>
        <span>Tu día</span>
        <span>{formatTime(to)}</span>
      </div>
    </div>
  );
}

function BlockDetail({ block, onClose }: { block: ScheduleBlock; onClose: () => void }) {
  const { run, pending, error } = useAction();
  const [title, setTitle] = useState(block.title);
  const [color, setColor] = useState(block.color);
  const [day, setDay] = useState(block.day_of_week);
  const [start, setStart] = useState(formatTime(block.start_minute));
  const [end, setEnd] = useState(formatTime(block.end_minute));
  return (
    <Modal open onClose={onClose} title={block.title} sheet>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => updateScheduleBlock(block.id, { title, color, slot: { day, start, end } }), onClose);
        }}
      >
        {/* Vista previa en vivo del bloque */}
        <div className="sched-block relative overflow-hidden rounded-2xl py-3.5 pl-5 pr-4" style={{ "--c": color, color: inkFor(color) } as React.CSSProperties} aria-hidden>
          <p className="truncate font-display text-lg font-semibold leading-tight">{title || "Sin nombre"}</p>
          <p className="mt-0.5 text-sm font-medium opacity-80 tabular">
            {WEEKDAY_NAME[day]} · {start}–{end}
          </p>
        </div>
        {block.idea_key && (
          <Link href={`/ideas?idea=${block.idea_key}`} className="press inline-flex items-center gap-1.5 rounded-full bg-tone-soft px-3 py-1.5 text-sm font-semibold text-tone-ink hover:brightness-95">
            <Lightbulb size={14} /> Ver la idea y cómo avanzar
          </Link>
        )}
        <Field label="Nombre" htmlFor="bd-title">
          <Input id="bd-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
        </Field>
        <ColorSwatches colors={BLOCK_COLORS} value={color} onChange={setColor} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Field label="Día" htmlFor="bd-day" className="col-span-2 sm:col-span-1">
            <Select id="bd-day" value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {WEEK_ORDER.map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_NAME[d]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Inicio" htmlFor="bd-start">
            <Input id="bd-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field label="Fin" htmlFor="bd-end">
            <Input id="bd-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </Field>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={pending}>
            Guardar
          </Button>
          <Button variant="danger" disabled={pending} onClick={() => run(() => deleteScheduleBlock(block.id), onClose)} aria-label="Eliminar bloque">
            <Trash2 size={15} /> Eliminar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
