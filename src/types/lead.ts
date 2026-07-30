export type LeadStatus =
  | "novo"
  | "nao_contatado"
  | "em_contato"
  | "qualificado"
  | "reuniao"
  | "proposta"
  | "negociacao"
  | "convertido"
  | "perdido"
  | "arquivado";

export type LeadSource =
  | "google_maps"
  | "formulario"
  | "importacao"
  | "indicacao"
  | "instagram"
  | "manual"
  | "n8n";

export interface Lead {
  id: string;
  companyName: string;
  contactName?: string | null;
  category?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  secondaryEmail?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  source: LeadSource;
  score?: number | null;
  status: LeadStatus;
  folderId?: string | null;
  folderName?: string | null;
  assignedTo?: string | null;
  googleMapsUrl?: string | null;
  lastContactAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadFolder {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  isSystem: boolean;
  leadCount?: number;
  createdAt: string;
}

export type LeadFilters = {
  folderId: string;
  status: string;
  source: string;
  assignedTo: string;
  city: string;
  contactField: string;
  scoreRange: string;
  createdAt: string;
  lastContactAt: string;
};

