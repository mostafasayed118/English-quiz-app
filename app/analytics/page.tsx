import { Suspense } from "react";
import { Analytics } from "@/components/analytics/Analytics";

export default function AnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <Analytics />
    </Suspense>
  );
}
