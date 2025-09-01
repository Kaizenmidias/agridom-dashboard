export function formatCurrencyMask(value: string): string {
  // Remove tudo que não for número
  const numericValue = value.replace(/\D/g, '');
  
  // Se não há valor, retorna vazio
  if (!numericValue) return '';
  
  // Converte para número e divide por 100 para ter centavos
  const amount = parseInt(numericValue) / 100;
  
  // Formata com separadores brasileiros
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function parseCurrencyValue(formattedValue: string): number {
  // Remove símbolos de moeda e converte para número
  const numericString = formattedValue.replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(numericString) || 0;
}

export function formatCurrencyInput(value: string): string {
  // Para input, remove R$ e espaços, mantém apenas números e vírgula
  const formatted = formatCurrencyMask(value);
  return formatted.replace('R$\u00A0', '').trim();
}