"use client";

import Link from "next/link";
import { CloudOff, RotateCcw } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-8 sm:py-14">
      <div data-tone="coral" className="card-glass relative overflow-hidden rounded-[32px] px-6 py-12 text-center sm:px-12">
        <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(55%_50%_at_50%_25%,#000,transparent)]" aria-hidden />
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-tone opacity-[0.16] blur-3xl" aria-hidden />

        {/* Ilustración */}
        <div className="relative mx-auto mb-7 grid h-28 w-28 place-items-center" aria-hidden>
          <span className="absolute inset-0 scale-125 rounded-full bg-tone opacity-20 blur-2xl" />
          <span className="absolute inset-0 rounded-full border-2 border-dashed border-tone/35" />
          <span className="absolute -right-1 top-3 h-3 w-3 rounded-full bg-tone-2 opacity-80" />
          <span className="absolute bottom-2 left-0 h-2 w-2 rounded-full bg-tone opacity-70" />
          <span className="tone-chip animate-float relative h-[72px] w-[72px] rounded-[22px]">
            <CloudOff size={32} strokeWidth={1.75} />
          </span>
        </div>

        <p className="eyebrow relative">Error al cargar</p>
        <h1 className="relative mt-2 text-[28px] font-bold leading-tight sm:text-[32px]">Algo no ha ido bien</h1>
        <p className="relative mx-auto mt-2 max-w-sm text-[15px] text-muted">No pudimos cargar esta sección. Tus datos están a salvo.</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" className="group px-7" onClick={reset}>
            <RotateCcw size={17} className="transition-transform duration-500 group-hover:-rotate-180" aria-hidden />
            Reintentar
          </Button>
          <Link href="/dashboard" className={buttonClass("secondary", "lg", "px-6")}>
            Ir al inicio
          </Link>
        </div>
        {error.digest && (
          <p className="relative mt-7 text-xs text-faint">
            Código: <code className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-muted">{error.digest}</code>
          </p>
        )}
      </div>
    </div>
  );
}
