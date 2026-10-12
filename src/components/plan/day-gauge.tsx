import { CountUp } from "@/components/fx/count-up";
import { formatDuration } from "@/lib/domain/stats";

// Semicírculo del medidor (pathLength = 100 para trabajar en porcentajes).
const ARC = "M 16 104 A 88 88 0 0 1 192 104";

/**
 * Medidor del día pensado para la tarjeta destacada: lo hecho (sólido) y lo planificado (translúcido)
 * frente a tu ritmo habitual. Es un progressbar accesible con el total (hecho + plan) sobre el ritmo.
 */
export function DayGauge({ done, planned, capacity, label }: { done: number; planned: number; capacity: number; label: string }) {
  const fill = capacity ? (done + planned) / capacity : 0;
  const clamped = Math.max(0, Math.min(1, fill));
  const donePart = capacity ? Math.min(100, (done / capacity) * 100) : 0;
  const totalPart = clamped * 100;
  const over = done + planned - capacity;

  return (
    <div className="mx-auto w-[236px] shrink-0">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="relative"
      >
        <svg viewBox="0 0 208 116" className="w-full overflow-visible" aria-hidden>
          <path d={ARC} pathLength={100} fill="none" stroke="var(--surface-3)" strokeWidth={16} strokeLinecap="round" />
          {totalPart > 0 && (
            <path
              d={ARC}
              pathLength={100}
              fill="none"
              stroke="var(--faint)"
              strokeWidth={16}
              strokeLinecap="round"
              strokeDasharray={`${totalPart} 200`}
              className="ring-in"
              style={{ "--ring-c": totalPart } as React.CSSProperties}
            />
          )}
          {donePart > 0 && (
            <path
              d={ARC}
              pathLength={100}
              fill="none"
              stroke="var(--text)"
              strokeWidth={16}
              strokeLinecap="round"
              strokeDasharray={`${donePart} 200`}
              className="ring-in"
              style={{ "--ring-c": donePart, filter: "drop-shadow(0 0 10px rgb(255 255 255 / 0.55))" } as React.CSSProperties}
            />
          )}
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="num-xl text-[46px]">
            <CountUp value={Math.round(fill * 100)} />
            <span className="ml-0.5 text-[22px] font-semibold">%</span>
          </p>
          <p className="mt-1 text-xs font-medium text-muted">de tu ritmo</p>
        </div>
      </div>
      <div className="mt-2 flex justify-between px-1 text-[10.5px] font-semibold uppercase tracking-wider text-faint" aria-hidden>
        <span>0</span>
        <span>Ritmo</span>
      </div>
      {over > 0 && (
        <p className="mx-auto mt-3 w-fit rounded-full bg-surface px-3 py-1 text-center text-[11.5px] font-semibold ring-1 ring-inset ring-border">
          {formatDuration(over * 60)} por encima de tu ritmo
        </p>
      )}
    </div>
  );
}
