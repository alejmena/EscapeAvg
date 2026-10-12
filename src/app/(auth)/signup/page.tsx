import type { Metadata } from "next";
import { Check } from "lucide-react";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignupPage() {
  return (
    <>
      <p className="eyebrow mb-2">Empieza gratis</p>
      <h1 className="mb-1.5 text-[30px] font-bold leading-[1.05] sm:text-[36px]">Crea tu cuenta</h1>
      <p className="mb-4 text-[15px] text-muted">Tus datos son privados. Solo tú ves tu progreso.</p>
      <ul className="mb-7 flex flex-wrap gap-1.5" aria-label="Incluye">
        {["Gratis", "Sin anuncios", "Datos reales"].map((t) => (
          <li key={t} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-ink">
            <Check size={12} strokeWidth={3} aria-hidden /> {t}
          </li>
        ))}
      </ul>
      <AuthForm mode="signup" />
    </>
  );
}
