import { ChartSpline, CircleDollarSign } from "lucide-react";
import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export function RevenuesPage() {
  return <ModulePlaceholderPage title="Receitas" area="Financeiro" icon={CircleDollarSign} description="Acompanhe entradas financeiras previstas e realizadas." moduleSummary="Receitas será utilizado para registrar recebimentos, recorrências, previsões e conciliações relacionadas aos projetos e serviços da Kaizen." />;
}

export function CashFlowPage() {
  return <ModulePlaceholderPage title="Fluxo de Caixa" area="Financeiro" icon={ChartSpline} description="Visualize entradas, saídas e saldo projetado." moduleSummary="Fluxo de Caixa consolidará receitas, despesas, recorrências e projeções por período para apoiar decisões administrativas." />;
}

