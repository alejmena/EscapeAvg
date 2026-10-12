import { PageHeader } from "@/components/ui/card";
import { StatsTabs } from "@/components/stats/stats-tabs";
import { StatsPendingProvider } from "@/components/stats/stats-pending";

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="[&>header]:mb-6">
        <PageHeader title="Estadísticas" />
        <StatsTabs />
      </div>
      <StatsPendingProvider>{children}</StatsPendingProvider>
    </div>
  );
}
