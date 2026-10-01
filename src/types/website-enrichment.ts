export type WebsiteEnrichmentStatus = "pending" | "processing" | "completed" | "partial" | "failed";

export type WebsiteEnrichmentDiagnostic = {
  seo?: { titlePresent?: boolean; metaDescriptionPresent?: boolean; canonical?: boolean; structuredData?: boolean; openGraph?: boolean; imagesWithoutAlt?: number };
  mobile?: { viewport?: boolean };
  security?: { https?: boolean; mixedContent?: boolean; headers?: Record<string, string | null | undefined> };
  marketing?: { googleAnalytics?: boolean; googleTagManager?: boolean; whatsapp?: boolean; instagram?: boolean; linkedin?: boolean; metaPixel?: boolean; contactForm?: boolean; clickablePhone?: boolean; clickableEmail?: boolean };
  technology?: Record<string, boolean | undefined>;
  performance?: { responseTimeMs?: number | null; htmlSizeBytes?: number | null; scriptCount?: number | null; stylesheetCount?: number | null; imageCount?: number | null };
  opportunities?: string[];
  pagesAnalyzed?: number;
  partialError?: { code?: string; message?: string } | null;
};

export type LeadWebsiteEnrichment = {
  websiteUrl: string | null;
  status: WebsiteEnrichmentStatus;
  startedAt: string | null;
  completedAt: string | null;
  diagnostic: WebsiteEnrichmentDiagnostic | null;
};

export type LeadWebsiteEnrichmentResponse = {
  prospectId: number;
  enrichment: LeadWebsiteEnrichment | null;
};
