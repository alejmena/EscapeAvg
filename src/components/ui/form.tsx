import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/** Ancho completo y alto estándar salvo que el llamador indique otros (w-… / h-…). */
const width = (className?: string) => (className && /(^|\s)w-/.test(className) ? "" : "w-full");
const height = (className?: string) => (className && /(^|\s)h-/.test(className) ? "" : "h-10");

const field =
  "rounded-xl border border-border bg-surface px-3 text-sm text-text placeholder:text-muted/70 transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_4px_var(--ring)] focus:outline-none";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(field, width(className), height(className), className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(field, width(className), "py-2 min-h-20", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref,
) {
  return <select ref={ref} className={cn(field, width(className), height(className), "pr-8", className)} {...props} />;
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-xs font-medium text-muted mb-1.5", className)} {...props} />;
}

export function Field({ label, htmlFor, children, hint, className }: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function ErrorText({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}
