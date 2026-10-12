import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main data-tone="violet" className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="animate-glow absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-25 blur-3xl" />
        <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(45%_45%_at_50%_40%,#000,transparent)]" />
      </div>

      <div className="page-in relative w-full max-w-lg text-center">
        <Link href="/" className="mb-12 inline-flex rounded-full">
          <Logo />
        </Link>

        {/* Ilustración: 4 · brújula · 4 */}
        <div className="relative mx-auto flex items-center justify-center gap-2 sm:gap-4" aria-hidden>
          <span className="num-xl text-tone-gradient text-[112px] sm:text-[150px]">4</span>
          <span className="relative grid h-[104px] w-[104px] place-items-center sm:h-[136px] sm:w-[136px]">
            <span className="absolute inset-0 rounded-full bg-tone opacity-25 blur-2xl" />
            <span className="absolute inset-0 rounded-full border-2 border-dashed border-tone/40 animate-[spin_30s_linear_infinite]" />
            <span className="tone-chip animate-float relative h-[76px] w-[76px] rounded-full sm:h-[96px] sm:w-[96px]">
              <Compass className="h-9 w-9 animate-[spin_12s_linear_infinite] sm:h-11 sm:w-11" strokeWidth={1.75} />
            </span>
          </span>
          <span className="num-xl text-tone-gradient text-[112px] sm:text-[150px]">4</span>
        </div>

        <h1 className="mt-8 text-[30px] font-bold leading-tight sm:text-[38px]">Página no encontrada</h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
          Puede que el enlace haya cambiado o que esta página ya no exista. Volvamos a lo importante.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className={buttonClass("primary", "lg", "px-7")}>
            Ir al inicio
          </Link>
          <Link href="/" className={buttonClass("secondary", "lg", "px-6")}>
            <ArrowLeft size={17} aria-hidden /> Portada
          </Link>
        </div>
      </div>
    </main>
  );
}
