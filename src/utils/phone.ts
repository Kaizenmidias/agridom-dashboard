export function onlyDigits(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

export function normalizePhone(value?: string | null) {
  const digits = onlyDigits(value);

  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;

  return digits;
}

export function formatPhone(value?: string | null) {
  const digits = onlyDigits(value);

  if (!digits) return "Sem telefone";

  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }

  return value || digits;
}
