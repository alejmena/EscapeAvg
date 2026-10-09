const LEVEL_MIX = [0, 28, 50, 75, 100];

/** Color de una celda de mapa de calor (nivel 0–4) mezclando el color base con transparencia. */
export function levelColor(level: number, color: string): string {
  return level === 0 ? "var(--surface-2)" : `color-mix(in srgb, ${color} ${LEVEL_MIX[level]}%, transparent)`;
}
