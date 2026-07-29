export function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

export function normalizeWebsiteUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function getWebsiteDomain(value?: string | null) {
  const normalized = normalizeWebsiteUrl(value);
  if (!normalized) return "";

  try {
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return value || "";
  }
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
