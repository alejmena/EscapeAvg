import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Escape Average", template: "%s · Escape Average" },
  description: "Escape the Average. Become the 0.1%. Concentración, tareas, hábitos y progreso medible.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  applicationName: "Escape Average",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4fb" },
    { media: "(prefers-color-scheme: dark)", color: "#07060e" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Aplica el tema antes de pintar para evitar parpadeos.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
