import { Flame, Sparkles, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { hoursText, type Rank } from "@/lib/domain/discipline";
import type { Tone } from "@/lib/sections";
import { RankBadge } from "./today-panel";

/** Aviso mientras falta aplicar la migración del sistema de disciplina en Supabase. */
export function DisciplineSetupNotice() {
  return (
    <div
      className="card-glass relative flex items-start gap-3.5 overflow-hidden rounded-[22px] border-warning/30 p-4 text-sm sm:p-5"
      role="status"
      data-testid="discipline-setup"
    >
      <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-warning opacity-15 blur-2xl" aria-hidden />
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-warning-soft text-warning">
        <Sparkles size={18} aria-hidden />
      </span>
      <p className="relative leading-relaxed">
        <span className="font-semibold">Falta un último paso para activar todo el sistema de disciplina.</span>{" "}
        <span className="text-muted">
          Tus rangos ya funcionan. Al aplicar la actualización de la base de datos se activan: categoría y calidad por actividad, objetivo
          diario personalizado y frases favoritas.
        </span>
      </p>
    </div>
  );
}

function Row({ tone, icon, label, children }: { tone: Tone; icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <li data-tone={tone} className="flex items-start gap-3.5 rounded-2xl p-2.5 transition-colors hover:bg-surface-2/60">
      <span className="tone-chip h-11 w-11 rounded-[14px] [&_svg]:h-[18px] [&_svg]:w-[18px]" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted">{label}</p>
        {children}
      </div>
    </li>
  );
}

/** Tú contra ti mismo: récord, media y racha de objetivos cumplidos. */
export function SelfCompare({
  best,
  avg30,
  todaySeconds,
  goalStreak,
}: {
  best: { day: string; seconds: number; label: string; rank: Rank } | null;
  avg30: number;
  todaySeconds: number;
  goalStreak: number;
}) {
  const diff = todaySeconds - avg30;
  // Hoy frente a la media: la barra muestra cuánto de tu media llevas (y se llena en dorado si la superas).
  const vsAvg = avg30 > 0 ? Math.min(1, todaySeconds / avg30) : 0;
  return (
    <section className="card-glass spotlight relative min-w-0 overflow-hidden rounded-[26px] p-5 sm:p-6" aria-labelledby="self-title" data-testid="self-compare">
      <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-tone opacity-[0.12] blur-3xl" aria-hidden />
      <div className="relative flex items-center justify-between gap-3">
        <p id="self-title" className="eyebrow">
          Contra ti mismo
        </p>
        <span className="text-[11px] font-medium text-muted">Tu única referencia</span>
      </div>
      <ul className="relative mt-3 space-y-1">
        <Row tone="gold" icon={<Trophy />} label="Tu mejor día">
          {best ? (
            <>
              <p className="font-display text-lg font-semibold leading-tight">
                {hoursText(best.seconds)} <span className="font-sans text-sm font-normal text-muted">· {best.label}</span>
              </p>
              <RankBadge rank={best.rank} className="mt-1.5 px-2 py-0.5 text-[11px]" />
            </>
          ) : (
            <p className="font-medium text-muted">Aún sin récord. El primero empieza hoy.</p>
          )}
        </Row>
        <Row tone="violet" icon={<TrendingUp />} label="Tu media diaria (30 días)">
          <p className="font-display text-lg font-semibold leading-tight">{hoursText(avg30)}</p>
          {avg30 >= 60 && (
            <>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div
                  className={cn("bar-in h-full rounded-full", diff >= 0 ? "bg-gradient-to-r from-[var(--gold)] to-[var(--gold-2)]" : "bg-gradient-to-r from-tone to-tone-2")}
                  style={{ width: `${Math.max(3, vsAvg * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-xs text-muted">
                {diff >= 0 ? <TrendingUp size={12} className="text-success" aria-hidden /> : <TrendingDown size={12} aria-hidden />}
                {diff >= 0 ? `Hoy vas ${hoursText(diff)} por encima de tu media.` : `Te faltan ${hoursText(-diff)} para igualar tu media.`}
              </p>
            </>
          )}
        </Row>
        <Row tone="coral" icon={<Flame />} label="Días seguidos cumpliendo tu objetivo">
          <p className="font-display text-lg font-semibold leading-tight">
            {goalStreak} {goalStreak === 1 ? "día" : "días"}
          </p>
          <p className="mt-0.5 text-xs text-muted">Los días de descanso no rompen la racha.</p>
        </Row>
      </ul>
    </section>
  );
}
