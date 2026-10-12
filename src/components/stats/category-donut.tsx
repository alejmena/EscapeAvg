/** Anillo con el reparto por categoría (sin interacción: se puede renderizar en servidor). */
export function CategoryDonut({
  items,
  size = 128,
  stroke = 16,
  label,
  children,
}: {
  items: { key: string; value: number; color: string }[];
  size?: number;
  stroke?: number;
  label: string;
  /** Contenido del centro (p. ej. el total). */
  children?: React.ReactNode;
}) {
  const total = items.reduce((a, i) => a + i.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Un pequeño hueco del color de la superficie separa los segmentos.
  const gap = items.filter((i) => i.value > 0).length > 1 ? 3 : 0;
  const starts = items.reduce<number[]>((acc, it, i) => [...acc, i === 0 ? 0 : acc[i - 1] + (items[i - 1].value / (total || 1)) * c], []);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible" role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        {total > 0 &&
          items.map((it, i) => {
            const len = (it.value / total) * c;
            if (len <= 0) return null;
            return (
              <circle
                key={it.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={it.color}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(0.5, len - gap)} ${c}`}
                strokeDashoffset={-starts[i]}
                style={{ filter: `drop-shadow(0 2px 6px color-mix(in srgb, ${it.color} 40%, transparent))` }}
              />
            );
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
