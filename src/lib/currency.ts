export const parseCurrencyBR = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').replace(/R\$\s?/g, '').trim();
  const hasComma = raw.includes(',');
  const normalized = hasComma
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/\.(?=\d{3}(?:\D|$))/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatCurrencyBR = (value: string | number | null | undefined): string =>
  parseCurrencyBR(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const maskCurrencyBR = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const amount = Number(digits) / 100;
  return formatCurrencyBR(amount);
};
