import { useId } from "react";

export type Ring = { value: number; color: string; color2: string; label: string };

/**
 * Anillos concéntricos estilo "Actividad": cada anillo es un progreso 0–1 (puede pasar de 1, se
 * muestra lleno). Se dibujan con degradado y se animan al cargar.
 */
export function ActivityRings({ rings, size = 200, stroke = 18, gap = 5 }: { rings: Ring[]; size?: number; stroke?: number; gap?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible" role="img" aria-label={rings.map((r) => `${r.label}: ${Math.round(r.value * 100)} %`).join(", ")}>
      <defs>
        {rings.map((r, i) => (
          <linearGradient key={i} id={`${id}-g${i}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={r.color} />
            <stop offset="100%" stopColor={r.color2} />
          </linearGradient>
        ))}
      </defs>
      {rings.map((r, i) => {
        const radius = size / 2 - stroke / 2 - i * (stroke + gap);
        const c = 2 * Math.PI * radius;
        const v = Math.max(0, Math.min(1, r.value));
        return (
          <g key={i}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={r.color} strokeOpacity={0.16} strokeWidth={stroke} />
            {v > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={`url(#${id}-g${i})`}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - v)}
                className="ring-in"
                style={{ ["--ring-c" as string]: c, animationDelay: `${i * 120}ms`, filter: `drop-shadow(0 0 6px ${r.color}55)` }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
