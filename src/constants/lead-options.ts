export const LEAD_SECTORS = [
  "Serviço de alojamento",
  "Serviços administrativos e de suporte",
  "Construção",
  "Serviços ao consumidor",
  "Educação",
  "Indústria de entretenimento",
  "Agricultura, pecuária e silvicultura",
  "Serviços financeiros",
  "Administração pública",
  "Empresas de holding",
  "Hospitais e serviços de saúde",
  "Fabricação",
  "Petróleo, gás e mineração",
  "Serviços profissionais",
  "Serviços de locação de imóveis e equipamentos",
  "Varejo",
  "Tecnologia, informação e mídia",
  "Transporte, logística, cadeia de abastecimento e armazenamento",
  "Serviços",
  "Atacado",
  "Outro",
];

export const LEAD_LABEL_COLORS = [
  { name: "Azul", value: "#4D6EDB" },
  { name: "Verde menta", value: "#6FD6B5" },
  { name: "Amarelo", value: "#FFD21F" },
  { name: "Vermelho", value: "#DC3035" },
  { name: "Roxo", value: "#A63DA5" },
  { name: "Cinza claro", value: "#E1E1E1" },
  { name: "Marrom", value: "#9A6239" },
  { name: "Laranja", value: "#FFA64F" },
  { name: "Cinza escuro", value: "#858585" },
  { name: "Rosa", value: "#F17DB1" },
];

export function formatBRLInput(value: string) {
  const digits = value.replace(/\D/g, "");
  const cents = Number(digits || "0");
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}
