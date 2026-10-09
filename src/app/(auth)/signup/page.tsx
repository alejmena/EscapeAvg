import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Crea tu cuenta</h1>
      <p className="mb-6 text-sm text-muted">Tus datos son privados. Solo tú ves tu progreso.</p>
      <AuthForm mode="signup" />
    </>
  );
}
