import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/sections";

// Tonos para los avatares: cada persona o grupo conserva siempre el mismo color.
const TONES: Tone[] = ["sky", "violet", "coral", "green", "amber", "pink", "teal", "indigo", "orange", "fuchsia"];

/** Color estable a partir de un id. */
export function toneFor(seed: string): Tone {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

/** Iniciales ("Ana López" → "AL", "@leo_dev" → "LD"). */
export function initials(name: string): string {
  const parts = name
    .replace(/^@/, "")
    .split(/[\s_.-]+/)
    .filter(Boolean);
  const out = (parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "");
  return out.toUpperCase();
}

const SIZES = {
  xs: "h-6 w-6 text-[9.5px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-[13px]",
  lg: "h-14 w-14 text-lg",
  xl: "h-[72px] w-[72px] text-2xl",
};

/** Avatar con degradado e iniciales. Decorativo: el nombre siempre aparece al lado. */
export function Avatar({
  name,
  seed,
  me = false,
  size = "md",
  className,
}: {
  name: string;
  seed: string;
  /** Tú: con el degradado de la marca, como en la barra lateral. */
  me?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      data-tone={me ? undefined : toneFor(seed)}
      className={cn(
        "inline-grid shrink-0 select-none place-items-center rounded-full font-display font-bold leading-none tracking-tight text-white shadow-[0_1px_0_rgb(255_255_255/0.3)_inset,0_6px_14px_-8px_var(--tone)]",
        me ? "bg-[image:var(--brand-gradient)]" : "bg-gradient-to-br from-tone to-tone-2",
        SIZES[size],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Varias caras superpuestas (miembros de un grupo). */
export function AvatarStack({ people, max = 5, size = "sm" }: { people: { id: string; name: string; me?: boolean }[]; max?: number; size?: keyof typeof SIZES }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="inline-flex items-center" aria-hidden>
      {shown.map((p, i) => (
        <Avatar key={p.id} name={p.name} seed={p.id} me={p.me} size={size} className={cn("ring-2 ring-bg", i > 0 && "-ml-2")} />
      ))}
      {rest > 0 && (
        <span className={cn("-ml-2 inline-grid place-items-center rounded-full bg-surface-3 font-semibold text-muted ring-2 ring-bg", SIZES[size])}>+{rest}</span>
      )}
    </span>
  );
}
