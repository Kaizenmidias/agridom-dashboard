import { normalizePhone } from "@/utils/phone";

export function buildWhatsAppUrl(value?: string | null) {
  const phone = normalizePhone(value);
  return phone ? `https://wa.me/${phone}` : null;
}
