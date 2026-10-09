import { StatsTabs } from "@/components/stats/stats-tabs";

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Estadísticas</h1>
        <StatsTabs />
      </div>
      {children}
    </div>
  );
}
