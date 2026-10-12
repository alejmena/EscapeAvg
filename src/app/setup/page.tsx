import Link from "next/link";
import { ArrowRight, CircleCheck, Database } from "lucide-react";
import { supabaseEnv } from "@/lib/supabase/env";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const code = "rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[12.5px] text-text";

export default function SetupPage() {
  const configured = Boolean(supabaseEnv());
  return (
    <main data-tone="violet" className="relative mx-auto max-w-2xl px-4 py-12 sm:py-20">
      <div className="animate-glow pointer-events-none absolute left-1/2 top-24 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-accent opacity-20 blur-3xl" aria-hidden />
      <Logo />
      <div className="card-glass page-in relative mt-8 overflow-hidden rounded-[30px] p-6 sm:p-9">
        <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(50%_60%_at_100%_0%,#000,transparent)]" aria-hidden />
        <div className="relative flex items-center gap-4">
          <span className="tone-chip h-14 w-14 rounded-[18px]">
            <Database size={26} aria-hidden />
          </span>
          <div>
            <p className="eyebrow mb-1">Primeros pasos</p>
            <h1 className="text-[26px] font-bold leading-tight sm:text-[32px]">Configura la base de datos</h1>
          </div>
        </div>
        {configured ? (
          <div className="relative mt-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-success-soft p-4">
            <p className="flex items-center gap-2.5 text-[15px] text-success">
              <CircleCheck size={20} className="shrink-0" aria-hidden />
              Supabase está configurado.
            </p>
            <Link href="/login" className={buttonClass("primary", "md", "group")}>
              Ir al inicio de sesión
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        ) : (
          <ol className="relative mt-7 space-y-3 text-sm text-muted">
            {[
              <>Crea un proyecto en supabase.com (o ejecuta <code className={code}>supabase start</code> en local).</>,
              <>
                Aplica las migraciones de <code className={code}>supabase/migrations</code> (<code className={code}>supabase db push</code> o pégalas en el
                editor SQL).
              </>,
              <>
                Copia <code className={code}>.env.example</code> a <code className={code}>.env.local</code> y rellena{" "}
                <code className={code}>NEXT_PUBLIC_SUPABASE_URL</code> y <code className={code}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
              </>,
              <>Reinicia <code className={code}>npm run dev</code>.</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-3.5 rounded-2xl border border-border bg-surface/60 p-4 leading-relaxed">
                <span className="tone-chip h-7 w-7 rounded-full font-display text-[13px] font-bold">{i + 1}</span>
                <span className="min-w-0 pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
