const LEVEL_MIX = [0, 30, 52, 76, 100];

/** Color de una celda de mapa de calor (nivel 0–4) mezclando el color base con transparencia. */
export function levelColor(level: number, color: string): string {
  return level === 0 ? "var(--surface-2)" : `color-mix(in srgb, ${color} ${LEVEL_MIX[level]}%, transparent)`;
}

/**
 * Fondo completo de una celda (propiedad `background`): igual que `levelColor`, pero el nivel máximo
 * lleva un degradado hacia `color2` para que los mejores momentos brillen.
 */
export function levelBackground(level: number, color: string, color2?: string): string {
  if (level >= 4 && color2) return `linear-gradient(135deg, ${color} 0%, ${color2} 100%)`;
  return levelColor(level, color);
}

/** Degradado vertical de una barra: `top` arriba y `bottom` (por defecto, el mismo color más transparente) abajo. */
export function barGradient(top: string, bottom?: string): string {
  return `linear-gradient(0deg, ${bottom ?? `color-mix(in srgb, ${top} 55%, transparent)`} 0%, ${top} 100%)`;
}
