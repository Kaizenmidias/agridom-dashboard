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
