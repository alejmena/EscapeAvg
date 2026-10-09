import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div
        className="animate-glow pointer-events-none absolute left-1/2 top-1/4 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-accent/25 to-accent-2/15 blur-3xl"
        aria-hidden
      />
      <div className="w-full max-w-sm animate-in">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <div className="glass rounded-[28px] border border-border/70 p-7 shadow-float">{children}</div>
      </div>
    </main>
  );
}
