import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "tone" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  // Marca: degradado violeta → magenta con brillo al pasar por encima.
  primary:
    "shine bg-[image:var(--brand-gradient)] bg-[length:140%_100%] bg-left text-white shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_10px_24px_-10px_var(--accent)] hover:bg-right hover:shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_14px_30px_-10px_var(--accent-2)] transition-[background-position,box-shadow,transform]",
  // Color de la sección actual.
  tone: "shine bg-gradient-to-br from-tone to-tone-2 text-white shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_10px_22px_-10px_var(--tone)] hover:brightness-110",
  secondary:
    "bg-surface/90 text-text border border-border shadow-[0_1px_2px_rgb(21_19_43/0.06)] hover:border-border-strong hover:bg-surface",
  ghost: "text-muted hover:text-text hover:bg-surface-2",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
  success: "bg-success text-white shadow-[0_10px_22px_-10px_var(--success)] hover:brightness-110 dark:text-bg",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13px] gap-1.5 rounded-full",
  md: "h-10 px-4.5 text-sm gap-2 rounded-full",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-full",
  icon: "h-9 w-9 rounded-full justify-center",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "press inline-flex items-center justify-center font-semibold disabled:opacity-50 disabled:pointer-events-none select-none",
    variants[variant],
    sizes[size],
    extra,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
});
