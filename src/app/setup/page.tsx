import Link from "next/link";
import { supabaseEnv } from "@/lib/supabase/env";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const configured = Boolean(supabaseEnv());
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold">Configura la base de datos</h1>
      {configured ? (
        <p className="mt-4 text-muted">
          Supabase está configurado. <Link href="/login" className="text-accent">Ir al inicio de sesión</Link>.
        </p>
      ) : (
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-muted">
          <li>Crea un proyecto en supabase.com (o ejecuta <code>supabase start</code> en local).</li>
          <li>
            Aplica las migraciones de <code>supabase/migrations</code> (<code>supabase db push</code> o pégalas en el editor SQL).
          </li>
          <li>
            Copia <code>.env.example</code> a <code>.env.local</code> y rellena <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          </li>
          <li>Reinicia <code>npm run dev</code>.</li>
        </ol>
      )}
    </main>
  );
}
