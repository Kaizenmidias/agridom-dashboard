export type PageSpeedStatus = "pending" | "processing" | "completed" | "partial" | "failed" | "unknown";
export type PageSpeedLab = { fcpMs: number | null; lcpMs: number | null; cls: number | null; speedIndexMs: number | null; tbtMs: number | null; ttfbMs: number | null };
export type PageSpeedField = { available: boolean; source: "url" | "origin" | null; lcpMs: number | null; inpMs: number | null; cls: number | null };
export type LeadWebsitePerformance = { websiteUrl: string | null; strategy: "mobile"; status: PageSpeedStatus; score: number | null; analyzedAt: string | null; refreshAfter: string | null; lab: PageSpeedLab | null; field: PageSpeedField | null; opportunities: [] };
export type LeadWebsitePerformanceResponse = { prospectId: number; performance: LeadWebsitePerformance | null };
