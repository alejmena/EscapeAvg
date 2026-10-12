"use client";

import { useId } from "react";
import { usePathname } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { sectionFor, type Tone } from "@/lib/sections";

type CardVariant = "glass" | "tint" | "feature" | "solid" | "outline";

const cardVariants: Record<CardVariant, string> = {
  // Cristal con luz que sigue al cursor: la tarjeta por defecto.
  glass: "card-glass spotlight",
  // Con un tinte del color de la sección: para bloques que conviene destacar un poco.
  tint: "card-tint",
  // Degradado intenso con texto blanco: para el bloque principal de una página (uno por pantalla).
  feature: "card-feature",
  solid: "border border-border bg-surface shadow-soft",
  outline: "border border-dashed border-border-strong bg-transparent",
};

/**
 * Tarjeta base. `tone` cambia el color (por defecto, el de la sección); `variant` su peso visual.
 * Para destacar, usa `variant="feature"` como mucho una vez por pantalla.
 */
export function Card({
  className,
  variant = "glass",
  tone,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: CardVariant; tone?: Tone }) {
  return <div data-tone={tone} className={cn("relative min-w-0 rounded-[26px] p-5 sm:p-6", cardVariants[variant], className)} {...props} />;
}

export function CardTitle({
  children,
  action,
  icon,
  subtitle,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="tone-chip-soft h-8 w-8 rounded-xl [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
        <div className="min-w-0">
          <h2 className="font-display text-[17px] font-semibold leading-tight tracking-tight text-text">{children}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

type BadgeVariant = "neutral" | "tone" | "accent" | "success" | "warning" | "danger" | "solid";

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: "bg-surface-2 text-muted",
  tone: "bg-tone-soft text-tone-ink",
  accent: "bg-accent-soft text-accent-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  solid: "bg-gradient-to-r from-tone to-tone-2 text-white shadow-[0_4px_10px_-4px_var(--tone)]",
};

export function Badge({
  children,
  color,
  className,
  variant = "neutral",
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
  variant?: BadgeVariant;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", badgeVariants[variant], className)}
      style={color ? { backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, color } : undefined}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  color,
  className,
  label,
  size = "md",
}: {
  value: number;
  color?: string;
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-surface-2", size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="bar-in relative h-full rounded-full bg-gradient-to-r from-tone to-tone-2 shadow-[0_0_12px_-2px_var(--tone)] transition-[width] duration-700"
        style={{ width: `${pct}%`, ...(color ? { background: color, boxShadow: `0 0 12px -2px ${color}` } : {}) }}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  children,
  color,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  color?: string;
}) {
  const gid = `pr${useId().replace(/:/g, "")}`;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color ?? "var(--tone)"} />
            <stop offset="100%" stopColor={color ?? "var(--tone-2)"} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color ?? "var(--tone)"} strokeOpacity={0.15} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{
            transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)",
            filter: `drop-shadow(0 0 ${size >= 120 ? 10 : 4}px ${color ?? "var(--tone)"})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/** Cifra clave con icono, etiqueta y comparación opcional ("+12 %"). */
export function StatTile({
  icon,
  label,
  value,
  delta,
  trend,
  footnote,
  tone,
  className,
  children,
}: {
  icon?: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  /** Texto de la comparación, p. ej. "+12 % vs. semana pasada". */
  delta?: React.ReactNode;
  trend?: "up" | "down" | "flat";
  footnote?: React.ReactNode;
  tone?: Tone;
  className?: string;
  children?: React.ReactNode;
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  return (
    <div data-tone={tone} className={cn("card-glass spotlight relative min-w-0 overflow-hidden rounded-[22px] p-4 sm:p-5", className)}>
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-tone opacity-[0.12] blur-2xl" aria-hidden />
      <div className="flex items-center gap-2.5">
        {icon && <span className="tone-chip h-8 w-8 rounded-xl [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
        <p className="min-w-0 text-[13px] font-medium leading-tight text-muted">{label}</p>
      </div>
      <p className="num-xl mt-3 text-[30px] sm:text-[34px]">{value}</p>
      {delta && (
        <p
          className={cn(
            "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
            trend === "up" ? "bg-success-soft text-success" : trend === "down" ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted",
          )}
        >
          {trend && <TrendIcon size={12} aria-hidden />}
          {delta}
        </p>
      )}
      {footnote && <p className="mt-2 text-xs text-muted">{footnote}</p>}
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-[24px] border border-dashed border-border-strong bg-surface/40 px-6 py-12 text-center">
      <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_60%_at_50%_30%,#000,transparent)]" aria-hidden />
      {icon && (
        <div className="relative mb-2">
          <div className="absolute inset-0 -z-0 scale-150 rounded-full bg-tone opacity-20 blur-2xl" aria-hidden />
          <div className="tone-chip animate-float relative h-14 w-14 rounded-[18px] [&_svg]:h-6 [&_svg]:w-6">{icon}</div>
        </div>
      )}
      <p className="relative font-display text-lg font-semibold">{title}</p>
      {children && <div className="relative max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="relative mt-3">{action}</div>}
    </div>
  );
}

/**
 * Encabezado de página: ficha de icono y color de la sección (se deducen de la ruta), titular grande
 * y, opcionalmente, una acción a la derecha.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
  icon,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /** Texto pequeño sobre el título (por defecto, la descripción corta de la sección). */
  eyebrow?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const section = sectionFor(usePathname() ?? "");
  const Icon = section?.icon;
  return (
    <header className="relative mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-tone opacity-[0.16] blur-3xl" aria-hidden />
      <div className="relative flex min-w-0 items-center gap-4">
        {(icon || Icon) && (
          <span className="tone-chip h-12 w-12 rounded-[16px] sm:h-14 sm:w-14 sm:rounded-[18px] [&_svg]:h-6 [&_svg]:w-6 sm:[&_svg]:h-7 sm:[&_svg]:w-7">
            {icon ?? (Icon && <Icon />)}
          </span>
        )}
        <div className="min-w-0">
          {(eyebrow ?? section?.hint) && <p className="eyebrow mb-1">{eyebrow ?? section?.hint}</p>}
          <h1 className="text-[30px] font-bold leading-[1.05] sm:text-[40px]">{title}</h1>
        </div>
      </div>
      {action && <div className="relative">{action}</div>}
      {subtitle && <p className="relative -mt-1 w-full max-w-2xl text-[15px] leading-relaxed text-muted">{subtitle}</p>}
    </header>
  );
}
