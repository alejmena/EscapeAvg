import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { Select } from "@/components/ui/form";

/**
 * Select del sistema con icono opcional a la izquierda y flecha propia a la derecha.
 * (La flecha de fondo del Select base no se genera; aquí se quita y se pinta un icono, así nunca sale doble.)
 */
export function IconSelect({
  icon,
  wrapperClassName,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { icon?: React.ReactNode; wrapperClassName?: string }) {
  return (
    <div className={cn("relative min-w-0", wrapperClassName)}>
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 flex -translate-y-1/2 items-center" aria-hidden>
          {icon}
        </span>
      )}
      <Select {...props} className={cn("bg-none!", !!icon && !/(^|\s)pl-/.test(className ?? "") && "pl-8!", className)} />
      <ChevronDown size={15} strokeWidth={2.4} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
}
