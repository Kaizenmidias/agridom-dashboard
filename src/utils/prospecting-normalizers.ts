import type { NormalizedProspect, WhatsAppValidationStatus } from "@/types/prospecting";
import type { Lead } from "@/types/lead";

export function onlyDigits(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

export function normalizeBrazilianPhone(value?: string | null) {
  let digits = onlyDigits(value);
  if (!digits) return "";

  digits = digits.replace(/^0+/, "");
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("55")) {
    const national = digits.slice(2);
    return national.length >= 10 && national.length <= 11 ? digits : "";
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return "";
}

export function formatBrazilianPhone(value?: string | null) {
  const normalized = normalizeBrazilianPhone(value);
  if (!normalized) return value || "";

  const national = normalized.slice(2);
  if (national.length === 11) return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  if (national.length === 10) return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  return normalized;
}

export function isPossibleMobilePhone(value?: string | null) {
  const normalized = normalizeBrazilianPhone(value);
  if (!normalized) return false;
  const national = normalized.slice(2);
  return national.length === 11 && national[2] === "9";
}

export function buildProspectingWhatsAppUrl(value?: string | null) {
  const normalized = normalizeBrazilianPhone(value);
  return normalized ? `https://wa.me/${normalized}` : null;
}

export function normalizeCnpj(value?: string | null) {
  const digits = onlyDigits(value);
  return digits.length === 14 ? digits : "";
}

export function formatCnpj(value?: string | null) {
  const digits = normalizeCnpj(value);
  if (!digits) return value || "";
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function normalizeProspectingEmail(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

export function normalizeWebsiteDomain(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, "").replace(/\/$/, "").toLowerCase();
  } catch {
    return trimmed.replace(/^https?:\/\//i, "").replace(/^www\./, "").replace(/\/$/, "").toLowerCase();
  }
}

export function normalizeInstagramUsername(value?: string | null) {
  return (value || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
}

function normalizeName(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getWhatsAppStatusLabel(status: WhatsAppValidationStatus) {
  const labels: Record<WhatsAppValidationStatus, string> = {
    valid: "Validado",
    invalid: "Invalido",
    unknown: "Nao validado",
    not_checked: "Nao consultado",
    provider_error: "Erro na validacao",
  };

  return labels[status];
}

export function detectDuplicate(prospect: NormalizedProspect, leads: Lead[]) {
  const cnpj = normalizeCnpj(prospect.cnpj);
  const phone = normalizeBrazilianPhone(prospect.phone);
  const email = normalizeProspectingEmail(prospect.email);
  const website = normalizeWebsiteDomain(prospect.website);
  const instagram = normalizeInstagramUsername(prospect.instagramUsername || prospect.instagramUrl);
  const prospectName = normalizeName(prospect.companyName || prospect.tradeName || prospect.legalName);

  for (const lead of leads) {
    const leadMetadata = lead as Lead & { cnpj?: string | null; instagramUsername?: string | null };
    if (cnpj && normalizeCnpj(leadMetadata.cnpj) === cnpj) {
      return { status: "duplicate" as const, leadId: lead.id, reason: "cnpj" };
    }
    if (phone && normalizeBrazilianPhone(lead.phone) === phone) {
      return { status: "duplicate" as const, leadId: lead.id, reason: "telefone" };
    }
    if (email && normalizeProspectingEmail(lead.email) === email) {
      return { status: "possible_duplicate" as const, leadId: lead.id, reason: "email" };
    }
    if (website && normalizeWebsiteDomain(lead.website) === website) {
      return { status: "possible_duplicate" as const, leadId: lead.id, reason: "website" };
    }
    if (instagram && normalizeInstagramUsername(leadMetadata.instagramUsername) === instagram) {
      return { status: "possible_duplicate" as const, leadId: lead.id, reason: "instagram" };
    }

    const leadName = normalizeName(lead.companyName);
    const sameLocation = (lead.city || "").toLowerCase() === (prospect.city || "").toLowerCase()
      && (lead.state || "").toLowerCase() === (prospect.state || "").toLowerCase();
    if (prospectName && leadName === prospectName && sameLocation) {
      return { status: "possible_duplicate" as const, leadId: lead.id, reason: "nome_localizacao" };
    }
  }

  return { status: "new" as const, leadId: null, reason: null };
}

