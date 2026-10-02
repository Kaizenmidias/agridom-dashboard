export type LocalPerformanceStatus = "pending" | "processing" | "completed" | "failed" | "unavailable";
export type LocalPerformance = {
  status: LocalPerformanceStatus;
  score: number | null;
  strategy: "mobile";
  source: "pagespeed_insights" | null;
  analyzedAt: string | null;
  lab: { fcpMs: number | null; lcpMs: number | null; cls: number | null; speedIndexMs: number | null; tbtMs: number | null; ttfbMs: number | null } | null;
  field: null;
  opportunities: Array<{ id: string; title: string; description: string | null; savingsMs: number | null; savingsBytes: number | null }>;
  errorCode?: string | null;
};
