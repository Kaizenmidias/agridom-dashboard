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
export const PERFORMANCE_METRICS = {
  fcp: { label: "FCP", fullName: "First Contentful Paint", description: "Mede quanto tempo leva para o primeiro conteÃºdo visÃ­vel aparecer na tela, como texto ou imagem.", whyItMatters: "Quanto menor, mais rapidamente o visitante percebe que a pÃ¡gina comeÃ§ou a carregar.", healthyReference: "SaudÃ¡vel: atÃ© 1,8 s.", threshold: 1800, attention: 3000, unit: "ms" },
  lcp: { label: "LCP", fullName: "Largest Contentful Paint", description: "Mede quanto tempo leva para o principal conteÃºdo visÃ­vel da pÃ¡gina aparecer completamente.", whyItMatters: "Ajuda a avaliar quando o visitante percebe que a parte principal da pÃ¡gina realmente carregou.", healthyReference: "SaudÃ¡vel: atÃ© 2,5 s.", threshold: 2500, attention: 4000, unit: "ms" },
  cls: { label: "CLS", fullName: "Cumulative Layout Shift", description: "Mede quanto os elementos da pÃ¡gina mudam de posiÃ§Ã£o inesperadamente durante o carregamento.", whyItMatters: "Quanto menor, mais estÃ¡vel Ã© a experiÃªncia visual.", healthyReference: "SaudÃ¡vel: atÃ© 0,10.", threshold: 0.1, attention: 0.25, unit: "cls" },
  speedIndex: { label: "Speed Index", fullName: "Speed Index", description: "Mede a velocidade com que o conteÃºdo visÃ­vel da pÃ¡gina Ã© preenchido durante o carregamento.", whyItMatters: "Quanto menor, mais rapidamente a primeira tela parece estar pronta para o visitante.", healthyReference: "SaudÃ¡vel: atÃ© 3,4 s.", threshold: 3400, attention: 5800, unit: "ms" },
  tbt: { label: "TBT", fullName: "Total Blocking Time", description: "Mede por quanto tempo a pÃ¡gina ficou bloqueada por tarefas que impediram uma resposta rÃ¡pida Ã s interaÃ§Ãµes.", whyItMatters: "Valores altos podem indicar que o navegador ficou ocupado demais durante o carregamento.", healthyReference: "SaudÃ¡vel: atÃ© 200 ms.", threshold: 200, attention: 600, unit: "ms" },
  ttfb: { label: "TTFB", fullName: "Time to First Byte", description: "Mede quanto tempo leva para o navegador comeÃ§ar a receber uma resposta do servidor.", whyItMatters: "Ajuda a identificar atrasos antes mesmo de o conteÃºdo da pÃ¡gina comeÃ§ar a chegar.", healthyReference: "ReferÃªncia saudÃ¡vel: atÃ© 800 ms.", threshold: 800, attention: 1800, unit: "ms" },
} as const;
export const pageSpeedMetricTone = (key: keyof typeof PERFORMANCE_METRICS, value: number | null | undefined) => typeof value !== "number" || !Number.isFinite(value) || value < 0 ? "muted" : value <= PERFORMANCE_METRICS[key].threshold ? "good" : value <= PERFORMANCE_METRICS[key].attention ? "needs-improvement" : "poor";
export const pageSpeedFieldSourceLabel = (source: PageSpeedField["source"]) => source === "url" ? "Página analisada" : source === "origin" ? "Origem/domínio" : null;
export const pageSpeedFieldMessage = (field: PageSpeedField | null | undefined) => field?.available ? null : "Dados de usuários reais não disponíveis para esta página.";
export const pageSpeedLabMetrics = (lab: PageSpeedLab | null | undefined) => lab ? ([
  ["FCP", formatPageSpeedMs(lab.fcpMs)], ["LCP", formatPageSpeedMs(lab.lcpMs)], ["CLS", formatPageSpeedCls(lab.cls)], ["Speed Index", formatPageSpeedMs(lab.speedIndexMs)], ["TBT", formatPageSpeedMs(lab.tbtMs)], ["TTFB", formatPageSpeedMs(lab.ttfbMs)],
] as Array<[string, string]>).filter(([, value]) => value !== "—") : [];
export const pageSpeedHasData = (performance: LeadWebsitePerformance | null | undefined) => Boolean(performance?.score !== null || performance?.lab || performance?.field?.available);
