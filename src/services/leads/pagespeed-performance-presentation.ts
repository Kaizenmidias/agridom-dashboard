import type { LeadWebsitePerformance, PageSpeedField, PageSpeedLab, PageSpeedStatus } from "@/types/pagespeed-performance";

export const pageSpeedStatusLabel = (status: PageSpeedStatus | string | undefined) => ({ pending: "Aguardando", processing: "Em análise", completed: "Concluído", partial: "Parcial", failed: "Falhou", unknown: "Indisponível" } as Record<string, string>)[status || ""] || "Indisponível";
export const pageSpeedStatusMessage = (status: PageSpeedStatus | string | undefined) => ({ pending: "Análise aguardando processamento.", processing: "Análise em andamento.", failed: "Não foi possível concluir a análise de performance.", unknown: "Status da análise indisponível." } as Record<string, string>)[status || ""] || null;
export const formatPageSpeedScore = (score: number | null | undefined) => typeof score === "number" && Number.isInteger(score) && score >= 0 && score <= 100 ? String(score) : "Score indisponível";
export const formatPageSpeedMs = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? `${value} ms` : "—";
export const formatPageSpeedCls = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? String(value) : "—";
export const formatPageSpeedDate = (value: string | null | undefined) => {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString("pt-BR");
};
export const pageSpeedScoreTone = (score: number | null | undefined) => typeof score !== "number" || score < 0 || score > 100 ? "muted" : score >= 90 ? "good" : score >= 50 ? "needs-improvement" : "poor";
export const pageSpeedFieldSourceLabel = (source: PageSpeedField["source"]) => source === "url" ? "Página analisada" : source === "origin" ? "Origem/domínio" : null;
export const pageSpeedFieldMessage = (field: PageSpeedField | null | undefined) => field?.available ? null : "Dados de usuários reais não disponíveis para esta página.";
export const pageSpeedLabMetrics = (lab: PageSpeedLab | null | undefined) => lab ? ([
  ["FCP", formatPageSpeedMs(lab.fcpMs)], ["LCP", formatPageSpeedMs(lab.lcpMs)], ["CLS", formatPageSpeedCls(lab.cls)], ["Speed Index", formatPageSpeedMs(lab.speedIndexMs)], ["TBT", formatPageSpeedMs(lab.tbtMs)], ["TTFB", formatPageSpeedMs(lab.ttfbMs)],
] as Array<[string, string]>).filter(([, value]) => value !== "—") : [];
export const pageSpeedHasData = (performance: LeadWebsitePerformance | null | undefined) => Boolean(performance?.score !== null || performance?.lab || performance?.field?.available);
