import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Bienvenido de nuevo</h1>
      <p className="mb-6 text-sm text-muted">Un paso pequeño hoy cuenta.</p>
      {error && <p className="mb-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">No pudimos abrir la sesión desde el enlace (pasa si lo abres en otro navegador o dispositivo). Si ya confirmaste tu email, entra aquí con tu contraseña.</p>}
      <AuthForm mode="login" next={next} />
    </>
  );
}
