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
        "border border-border bg-surface p-0 text-text shadow-pop backdrop:bg-black/40 backdrop:backdrop-blur-md",
        sheet
          ? "sheet-in mx-auto mb-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-[28px] sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-lg sm:rounded-[24px]"
          : "m-auto w-[calc(100%-2rem)] max-w-lg rounded-[24px]",
        className,
      )}
    >
      {open && (
        <div className="pop-in p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-2" aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
