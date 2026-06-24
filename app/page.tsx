import { CollectorApp } from "@/app/_components/collector-app";
import { collectorSeed, dashboardSeed } from "@/app/_lib/dashboard-data";

export default function Home() {
  return <CollectorApp seed={collectorSeed} dropSeed={dashboardSeed} />;
}
