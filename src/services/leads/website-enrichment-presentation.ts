import type { WebsiteEnrichmentDiagnostic, WebsiteEnrichmentStatus } from "@/types/website-enrichment";

export const booleanLabel = (value: boolean | null | undefined) => value === true ? "Detectado" : value === false ? "Não detectado nas páginas analisadas" : "Informação indisponível";
export const headerLabel = (value: string | null | undefined) => value === null ? "Não identificado nas páginas analisadas" : value === undefined || value.trim() === "" ? "Informação indisponível" : "Detectado";
export const websiteAvailable = (value: string | null | undefined) => typeof value === "string" && value.trim().length > 0;
export const statusLabel = (status: string | undefined) => ({ pending: "Aguardando", processing: "Em análise", completed: "Concluído", partial: "Parcial", failed: "Falhou" } as Record<string, string>)[status || ""] || "Indisponível";
export const isKnownStatus = (status: string | undefined): status is WebsiteEnrichmentStatus => ["pending", "processing", "completed", "partial", "failed"].includes(status || "");
export const imageAltLabel = (value: number | null | undefined) => typeof value !== "number" || !Number.isFinite(value) || value < 0 ? "Informação indisponível" : value > 0 ? `${value} imagens sem atributo alt` : "Nenhuma imagem sem atributo alt identificada na página analisada";
export const cleanOpportunities = (values: unknown) => Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim()) : [];
export const friendlyOpportunity = (value: string) => value === "Meta Pixel nao detectado" ? "Meta Pixel não detectado nas páginas analisadas" : value;
export const pagesAnalyzedLabel = (value: number | null | undefined) => typeof value === "number" && Number.isInteger(value) && value > 0 ? `Análise automática de ${value} ${value === 1 ? "página" : "páginas"} do site.` : null;
export const technologyLabels = (technology?: WebsiteEnrichmentDiagnostic["technology"]) => {
  const labels: Record<string, string> = { wordpress: "WordPress", elementor: "Elementor", woocommerce: "WooCommerce", shopify: "Shopify", wix: "Wix", webflow: "Webflow", react: "React", nextjs: "Next.js" };
  return Object.entries(labels).filter(([key]) => technology?.[key] === true).map(([, label]) => label);
};
export const securityHeaders = (diagnostic: WebsiteEnrichmentDiagnostic) => {
  const headers = diagnostic.security?.headers || {};
  return [["Content Security Policy", headers.contentSecurityPolicy], ["X-Content-Type-Options", headers.xContentTypeOptions], ["Referrer Policy", headers.referrerPolicy], ["Strict Transport Security", headers.strictTransportSecurity]] as Array<[string, string | null | undefined]>;
};

export const securityBooleanLabel = (kind: "https" | "mixedContent", value: boolean | null | undefined) => {
  if (value === undefined || value === null) return "Informação indisponível";
  if (kind === "https") return value ? "HTTPS detectado" : "HTTPS não detectado nas páginas analisadas";
  return value ? "Conteúdo misto identificado nas páginas analisadas" : "Nenhum conteúdo misto identificado nas páginas analisadas";
};

export const buildCommercialSummary = (diagnostic: WebsiteEnrichmentDiagnostic) => {
  const technologies = technologyLabels(diagnostic.technology);
  const marketing = [
    ["Google Analytics", diagnostic.marketing?.googleAnalytics],
    ["Google Tag Manager", diagnostic.marketing?.googleTagManager],
    ["WhatsApp", diagnostic.marketing?.whatsapp],
    ["Instagram", diagnostic.marketing?.instagram],
    ["formulário de contato", diagnostic.marketing?.contactForm],
  ].filter(([, value]) => value === true).map(([label]) => label as string);
  const seo = [["título", diagnostic.seo?.titlePresent], ["meta descrição", diagnostic.seo?.metaDescriptionPresent], ["canonical", diagnostic.seo?.canonical], ["Open Graph", diagnostic.seo?.openGraph], ["dados estruturados", diagnostic.seo?.structuredData]] as const;
  const seoPresent = seo.filter(([, value]) => value === true).map(([label]) => label);
  const opportunities = commercialOpportunities(diagnostic);
  const paragraphs: string[] = [];
  const positives: string[] = [];
  if (technologies.length) positives.push(`uma base digital com ${technologies.join(", ")}`);
  if (marketing.length) positives.push(`recursos de acompanhamento e conversão, como ${marketing.join(", ")}`);
  if (seoPresent.length) positives.push(`fundamentos de SEO observados, como ${seoPresent.join(", ")}`);
  if (positives.length) paragraphs.push(`A análise identificou ${positives.join(" e ")}.`);
  if (opportunities.length) {
    const findings: string[] = [];
    if (opportunities.includes("Avaliar configuração do Meta Pixel")) findings.push("o Meta Pixel não foi identificado nas páginas analisadas");
    if (opportunities.includes("Otimizar textos alternativos das imagens")) findings.push("foram encontradas imagens sem texto alternativo");
    if (opportunities.includes("Revisar configurações adicionais de segurança")) findings.push("algumas configurações adicionais de segurança podem ser revisadas");
    paragraphs.push(`Há oportunidades claras de evolução: ${findings.join("; ")}. Esses pontos podem contribuir para aprimorar a mensuração, a acessibilidade e a robustez técnica do site.`);
  } else if (positives.length) {
    paragraphs.push("Não foram destacadas oportunidades adicionais com os sinais disponíveis nesta análise.");
  }
  if (!paragraphs.length) paragraphs.push("A análise reuniu sinais técnicos e comerciais do site para apoiar uma avaliação inicial do lead.");
  return paragraphs;
};

export const commercialOpportunities = (diagnostic: WebsiteEnrichmentDiagnostic) => {
  const opportunities: string[] = [];
  const items = cleanOpportunities(diagnostic.opportunities);
  if (items.some((item) => /meta pixel/i.test(item))) opportunities.push("Avaliar configuração do Meta Pixel");
  if (typeof diagnostic.seo?.imagesWithoutAlt === "number" && diagnostic.seo.imagesWithoutAlt > 0) opportunities.push("Otimizar textos alternativos das imagens");
  const headers = diagnostic.security?.headers;
  if (headers && [headers.contentSecurityPolicy, headers.xContentTypeOptions, headers.referrerPolicy, headers.strictTransportSecurity].some((value) => value === null)) opportunities.push("Revisar configurações adicionais de segurança");
  return [...new Set(opportunities)];
};
