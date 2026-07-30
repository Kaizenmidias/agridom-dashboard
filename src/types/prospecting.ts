export type ProspectingSource = "google_maps" | "cnpj" | "instagram";

export type ProspectingJobStatus =
  | "draft"
  | "queued"
  | "running"
  | "collecting"
  | "normalizing"
  | "validating"
  | "completed"
  | "partially_completed"
  | "failed"
  | "cancelled";

export type WhatsAppValidationStatus =
  | "valid"
  | "invalid"
  | "unknown"
  | "not_checked"
  | "provider_error";

export type DuplicateStatus = "new" | "duplicate" | "possible_duplicate";

export type IntegrationProvider = "apify" | "casa_dos_dados" | "whatsapp_validator" | "smtp";

export type IntegrationStatus =
  | "not_configured"
  | "configured"
  | "connected"
  | "auth_error"
  | "provider_error";

export interface WhatsAppValidationResult {
  phone: string;
  normalizedPhone: string;
  status: WhatsAppValidationStatus;
  isWhatsApp: boolean | null;
  provider?: string | null;
  checkedAt?: string | null;
  errorMessage?: string | null;
}

export interface NormalizedProspect {
  source: ProspectingSource;
  externalId?: string | null;
  companyName: string;
  legalName?: string | null;
  tradeName?: string | null;
  contactName?: string | null;
  category?: string | null;
  cnpj?: string | null;
  phone?: string | null;
  normalizedPhone?: string | null;
  whatsappStatus: WhatsAppValidationStatus;
  email?: string | null;
  secondaryEmail?: string | null;
  website?: string | null;
  instagramUsername?: string | null;
  instagramUrl?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  cnaePrimary?: string | null;
  cnaeSecondary?: string[];
  rawPayload?: unknown;
}

export interface ProspectingJob {
  id: string;
  source: ProspectingSource;
  status: ProspectingJobStatus;
  searchParameters: Record<string, unknown>;
  requestedQuantity: number;
  processedCount: number;
  foundCount: number;
  duplicateCount: number;
  validCount: number;
  invalidCount: number;
  externalRunId?: string | null;
  externalDatasetId?: string | null;
  integrationProvider?: string | null;
  creditsEstimated?: number | null;
  creditsConsumed?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectingResult extends NormalizedProspect {
  id: string;
  jobId: string;
  duplicateStatus: DuplicateStatus;
  duplicateLeadId?: string | null;
  duplicateReason?: string | null;
  validationStatus: string;
  selected: boolean;
  importedToLeadsAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectingJobEvent {
  id: string;
  jobId: string;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface IntegrationSummary {
  provider: IntegrationProvider;
  displayName: string;
  description: string;
  status: IntegrationStatus;
  configured: boolean;
  connected: boolean;
  lastTestedAt?: string | null;
  lastError?: string | null;
  tokenMasked?: string | null;
  apiKeyMasked?: string | null;
  passwordMasked?: string | null;
  secure?: boolean | null;
  creditsBalance?: number | null;
  metadata: Record<string, string | number | boolean | null>;
}

export interface IntegrationLibraryResponse {
  integrations: IntegrationSummary[];
}

export interface CnaeCode {
  id: string;
  code: string;
  formattedCode: string;
  description: string;
  section?: string | null;
}

export interface BrazilianCity {
  id: string;
  name: string;
  state: string;
}

export interface GoogleMapsSearchPayload {
  source: "google_maps";
  searchTerms: string;
  quantity: number;
  minimumRating: number | null;
  onlyValidatedWhatsApp: boolean;
}

export interface CnpjSearchPayload {
  source: "cnpj";
  cnaeCodes: string[];
  state: string;
  city?: string | null;
  quantity: number;
  includeSecondaryActivity: boolean;
  onlyValidatedWhatsApp: boolean;
}

export interface InstagramSearchPayload {
  source: "instagram";
  searchTerms: string;
  quantity: number;
}

export type ProspectingSearchPayload =
  | GoogleMapsSearchPayload
  | CnpjSearchPayload
  | InstagramSearchPayload;

export interface LeadImportPayload {
  resultIds: string[];
  folderName: string;
  status: string;
  assignedTo?: string | null;
  origin: string;
  tags: string[];
}

export interface LeadImportResult {
  imported: number;
  skippedDuplicates: number;
  failed: number;
  message: string;
}

