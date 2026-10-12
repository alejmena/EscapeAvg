"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Modal({ open, onClose, title, children, className, sheet = false }: {
  open: boolean;
  /** En móvil se abre como hoja desde abajo (en pantallas grandes, centrado). */
  sheet?: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "border border-card-border bg-surface p-0 text-text shadow-pop ring-1 ring-[var(--card-edge)] backdrop:bg-[rgb(10_8_30/0.45)] backdrop:backdrop-blur-md",
        sheet
          ? "sheet-in mx-auto mb-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-[30px] sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-lg sm:rounded-[28px]"
          : "m-auto w-[calc(100%-2rem)] max-w-lg rounded-[28px]",
        className,
      )}
    >
      {open && (
        <div className="pop-in p-5 sm:p-6">
          {sheet && <div className="mx-auto -mt-2 mb-3 h-1 w-10 rounded-full bg-border-strong sm:hidden" aria-hidden />}
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="press grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-muted hover:bg-surface-3 hover:text-text" aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
