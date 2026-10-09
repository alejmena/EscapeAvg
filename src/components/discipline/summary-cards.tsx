import { Flame, Sparkles, Trophy, TrendingUp } from "lucide-react";
import { hoursText, type Rank } from "@/lib/domain/discipline";
import { RankBadge } from "./today-panel";

/** Aviso mientras falta aplicar la migración del sistema de disciplina en Supabase. */
export function DisciplineSetupNotice() {
  return (
    <div className="card-glass flex items-start gap-3 rounded-[20px] border-warning/30 p-4 text-sm" role="status" data-testid="discipline-setup">
      <Sparkles size={18} className="mt-0.5 shrink-0 text-warning" />
      <p>
        <span className="font-semibold">Falta un último paso para activar todo el sistema de disciplina.</span>{" "}
        <span className="text-muted">
          Tus rangos ya funcionan. Al aplicar la actualización de la base de datos se activan: categoría y calidad por actividad, objetivo
          diario personalizado y frases favoritas.
        </span>
      </p>
    </div>
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
  return (
    <section className="card-glass min-w-0 rounded-[24px] p-5 sm:p-6" aria-labelledby="self-title" data-testid="self-compare">
      <p id="self-title" className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
        Contra ti mismo
      </p>
      <ul className="mt-4 space-y-4">
        <li className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-2)] text-white shadow-float">
            <Trophy size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted">Tu mejor día</p>
            {best ? (
              <>
                <p className="font-semibold">
                  {hoursText(best.seconds)} <span className="font-normal text-muted">· {best.label}</span>
                </p>
                <RankBadge rank={best.rank} className="mt-1 px-2 py-0.5 text-[11px]" />
              </>
            ) : (
              <p className="font-medium text-muted">Aún sin récord. El primero empieza hoy.</p>
            )}
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-float">
            <TrendingUp size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted">Tu media diaria (30 días)</p>
            <p className="font-semibold">{hoursText(avg30)}</p>
            {avg30 >= 60 && (
              <p className="text-xs text-muted">
                {diff >= 0 ? `Hoy vas ${hoursText(diff)} por encima de tu media.` : `Te faltan ${hoursText(-diff)} para igualar tu media.`}
              </p>
            )}
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-ring-focus to-[var(--ring-focus-2)] text-white shadow-float">
            <Flame size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted">Días seguidos cumpliendo tu objetivo</p>
            <p className="font-semibold">
              {goalStreak} {goalStreak === 1 ? "día" : "días"}
            </p>
            <p className="text-xs text-muted">Los días de descanso no rompen la racha.</p>
          </div>
        </li>
      </ul>
    </section>
  );
}
