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

export interface LeadLabel {
  id: string;
  name: string;
  color: string;
}

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
  assignedUserId?: number | null;
  googleMapsUrl?: string | null;
  lastContactAt?: string | null;
  createdAt: string;
  updatedAt: string;
  activities?: LeadActivity[];
  metadata?: {
    contactName?: string | null;
    origin?: string | null;
    crmSent?: boolean;
    crmSentAt?: string | null;
    labels?: LeadLabel[];
    address?: string | null;
    linkedin?: string | null;
    sector?: string | null;
    revenue?: string | null;
    employees?: string | null;
    budget?: string | null;
    notes?: string | null;
    nextMeetingAt?: string | null;
    meetingOwner?: string | null;
    assignedUserId?: number | null;
    documents?: Array<{
      id: string;
      name: string;
      url?: string | null;
      createdAt: string;
    }>;
  };
}

export interface LeadActivity {
  id: string;
  channel: "whatsapp" | "email" | "crm" | "system" | string;
  subject?: string | null;
  message: string;
  recipient?: string | null;
  deliveryStatus?: string | null;
  createdAt: string;
  type?: "task" | "call" | "follow_up" | "activity";
  status?: "pending" | "completed" | "cancelled";
  completedAt?: string | null;
  dueAt?: string | null;
  createdBy?: number;
  assignedUserId?: number | null;
  assignedUserName?: string | null;
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
