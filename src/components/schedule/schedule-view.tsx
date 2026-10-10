"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, Lightbulb, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { WEEKDAY_NAME } from "@/lib/format";
import { formatTime, visibleRange, WEEK_ORDER, weeklyMinutes } from "@/lib/domain/schedule";
import { formatDuration } from "@/lib/domain/stats";
import type { ScheduleBlock } from "@/lib/types";
import { deleteScheduleBlock, updateScheduleBlock } from "@/app/(app)/schedule/actions";
import { useAction } from "@/components/tasks/use-action";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { ErrorText, Field, Input, Select } from "@/components/ui/form";
import { BLOCK_COLORS, BlockForm } from "./block-form";

const HOUR_PX = 52;

export function ScheduleView({ blocks, weekday, nowMinute }: { blocks: ScheduleBlock[]; weekday: number; nowMinute: number }) {
  const [adding, setAdding] = useState<number | null>(null);
  const [open, setOpen] = useState<ScheduleBlock | null>(null);
  const [day, setDay] = useState(weekday);
  const { from, to } = visibleRange(blocks);
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => from / 60 + i);

  const totals = new Map<string, { minutes: number; color: string; idea: string | null }>();
  for (const b of blocks) {
    const t = totals.get(b.title) ?? { minutes: 0, color: b.color, idea: b.idea_key };
    t.minutes += b.end_minute - b.start_minute;
    totals.set(b.title, t);
  }
  const summary = [...totals.entries()].sort((a, b) => b[1].minutes - a[1].minutes);
  const dayBlocks = blocks.filter((b) => b.day_of_week === day).sort((a, b) => a.start_minute - b.start_minute);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setAdding(day)}>
          <CalendarPlus size={16} /> Añadir bloque
        </Button>
        <Link href="/ideas" className="press inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium shadow-soft hover:bg-surface-2">
          <Lightbulb size={16} className="text-warning" /> Elegir de las ideas
        </Link>
        <span className="text-sm text-muted">{formatDuration(weeklyMinutes(blocks) * 60)} reservadas a la semana</span>
      </div>

      {blocks.length === 0 && (
        <EmptyState icon={<CalendarPlus size={22} />} title="Tu horario está vacío">
          Añade tus clases, trabajo o estudio, o elige una habilidad en Ideas y ponla en tus horas libres.
        </EmptyState>
      )}

      {/* Móvil: un día cada vez */}
      <div className="md:hidden">
        <div className="mb-3 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Día">
          {WEEK_ORDER.map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={day === d}
              onClick={() => setDay(d)}
              className={cn("press shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold", day === d ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted", d === weekday && day !== d && "text-accent")}
            >
              {WEEKDAY_NAME[d].slice(0, 3)}
            </button>
          ))}
        </div>
        <ul className="space-y-2" data-testid="schedule-day-list">
          {dayBlocks.length === 0 && <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">Día libre. Toca «Añadir bloque» para ocuparlo.</li>}
          {dayBlocks.map((b) => {
            const now = day === weekday && nowMinute >= b.start_minute && nowMinute < b.end_minute;
            return (
              <li key={b.id}>
                <button type="button" onClick={() => setOpen(b)} className={cn("lift card-glass flex w-full items-center gap-3 rounded-2xl p-3 text-left", now && "ring-2 ring-accent")}>
                  <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: b.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{b.title}</span>
                    <span className="block text-sm text-muted tabular">
                      {formatTime(b.start_minute)} – {formatTime(b.end_minute)}
                      {now && <span className="ml-2 font-semibold text-accent">Ahora</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Ordenador: semana completa tipo horario escolar */}
      <Card className="hidden overflow-x-auto p-3 md:block">
        <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `52px repeat(7, minmax(0, 1fr))` }}>
          <div />
          {WEEK_ORDER.map((d) => (
            <button key={d} type="button" onClick={() => setAdding(d)} className={cn("pb-2 text-center text-sm font-semibold hover:text-accent", d === weekday ? "text-accent" : "text-muted")} title={`Añadir bloque el ${WEEKDAY_NAME[d].toLowerCase()}`}>
              {WEEKDAY_NAME[d]}
            </button>
          ))}
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h, i) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted tabular" style={{ top: i * HOUR_PX }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {WEEK_ORDER.map((d) => (
            <div key={d} className={cn("relative border-l border-border", d === weekday && "bg-accent-soft/40")} style={{ height: hours.length * HOUR_PX }} data-testid={`schedule-col-${d}`}>
              {hours.map((h, i) => (
                <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: i * HOUR_PX }} />
              ))}
              {d === weekday && nowMinute >= from && nowMinute <= to && (
                <div className="absolute inset-x-0 z-10 h-0.5 bg-ring-focus" style={{ top: ((nowMinute - from) / 60) * HOUR_PX }} aria-label="Ahora" />
              )}
              {blocks
                .filter((b) => b.day_of_week === d)
                .map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setOpen(b)}
                    className="press absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1 text-left text-[12px] leading-tight text-white shadow-soft"
                    style={{ top: ((b.start_minute - from) / 60) * HOUR_PX + 1, height: Math.max(22, ((b.end_minute - b.start_minute) / 60) * HOUR_PX - 2), background: b.color }}
                  >
                    <span className="block truncate font-semibold">{b.title}</span>
                    <span className="block truncate opacity-85 tabular">
                      {formatTime(b.start_minute)}–{formatTime(b.end_minute)}
                    </span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      </Card>

      {summary.length > 0 && (
        <Card>
          <CardTitle>Horas por semana</CardTitle>
          <ul className="grid gap-2 sm:grid-cols-2">
            {summary.map(([title, t]) => (
              <li key={title} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
                <span className="min-w-0 flex-1 truncate">{title}</span>
                <span className="text-muted tabular">{formatDuration(t.minutes * 60)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={adding !== null} onClose={() => setAdding(null)} title="Añadir al horario" sheet>
        {adding !== null && <BlockForm key={adding} defaultDay={adding} onDone={() => setAdding(null)} />}
      </Modal>
      {open && <BlockDetail block={open} onClose={() => setOpen(null)} />}
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
        {block.idea_key && (
          <Link href={`/ideas?idea=${block.idea_key}`} className="flex items-center gap-1.5 text-sm text-accent hover:underline">
            <Lightbulb size={14} /> Ver la idea y cómo avanzar
          </Link>
        )}
        <Field label="Nombre" htmlFor="bd-title">
          <Input id="bd-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
        </Field>
        <div className="flex flex-wrap gap-2">
          {BLOCK_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={cn("press h-8 w-8 rounded-full border-2", color === c ? "border-text" : "border-transparent")} style={{ background: c }} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Día" htmlFor="bd-day">
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
