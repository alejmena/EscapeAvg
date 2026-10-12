import { useId } from "react";
import type { Tone } from "@/lib/sections";

/**
 * Un anillo: progreso 0–1 (si pasa de 1 se muestra lleno). El color sale de `color`/`color2` o, si
 * se indica `tone`, del tono de esa sección (así Tareas es azul en todas partes).
 */
export type Ring = { value: number; label: string; color?: string; color2?: string; tone?: Tone };

/**
 * Anillos concéntricos estilo "Actividad": cada anillo se dibuja con degradado y un brillo suave del
 * mismo color. Se animan al cargar (sin animación con "reducir movimiento").
 */
export function ActivityRings({ rings, size = 200, stroke = 18, gap = 5, className }: { rings: Ring[]; size?: number; stroke?: number; gap?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={["-rotate-90 overflow-visible", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={rings.map((r) => `${r.label}: ${Math.round(r.value * 100)} %`).join(", ")}
    >
      <defs>
        {rings.map((r, i) => (
          <linearGradient key={i} id={`${id}-g${i}`} x1="0" y1="0" x2="1" y2="1" data-tone={r.tone}>
            <stop offset="0%" stopColor={r.color ?? "var(--tone)"} />
            <stop offset="100%" stopColor={r.color2 ?? "var(--tone-2)"} />
          </linearGradient>
        ))}
      </defs>
      {rings.map((r, i) => {
        const color = r.color ?? "var(--tone)";
        const radius = size / 2 - stroke / 2 - i * (stroke + gap);
        const c = 2 * Math.PI * radius;
        const v = Math.max(0, Math.min(1, r.value));
        return (
          <g key={i} data-tone={r.tone}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeOpacity={0.16} strokeWidth={stroke} />
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
                style={{
                  ["--ring-c" as string]: c,
                  animationDelay: `${i * 120}ms`,
                  filter: `drop-shadow(0 0 ${Math.round(stroke / 3)}px color-mix(in srgb, ${color} 55%, transparent))`,
                }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
