import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <p className="eyebrow mb-2">Inicia sesión</p>
      <h1 className="mb-1.5 text-[30px] font-bold leading-[1.05] sm:text-[36px]">Bienvenido de nuevo</h1>
      <p className="mb-7 text-[15px] text-muted">Un paso pequeño hoy cuenta.</p>
      {error && (
        <p className="pop-in mb-5 flex items-start gap-2.5 rounded-2xl bg-warning-soft px-3.5 py-3 text-sm text-warning">
          <TriangleAlert size={18} className="mt-px shrink-0" aria-hidden />
          <span>
            No pudimos abrir la sesión desde el enlace (pasa si lo abres en otro navegador o dispositivo). Si ya confirmaste tu email, entra aquí con tu
            contraseña.
          </span>
        </p>
      )}
      <AuthForm mode="login" next={next} />
    </>
  );
}
