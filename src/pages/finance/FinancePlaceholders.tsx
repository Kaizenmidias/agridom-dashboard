import { ChartSpline, CircleDollarSign } from "lucide-react";
import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export function RevenuesPage() {
  return <ModulePlaceholderPage title="Receitas" area="Financeiro" icon={CircleDollarSign} description="Acompanhe entradas financeiras previstas e realizadas." moduleSummary="Receitas sera utilizado para registrar recebimentos, recorrencias, previsoes e conciliacoes relacionadas aos projetos e servicos da Kaizen." />;
}

export function CashFlowPage() {
  return <ModulePlaceholderPage title="Fluxo de Caixa" area="Financeiro" icon={ChartSpline} description="Visualize entradas, saidas e saldo projetado." moduleSummary="Fluxo de Caixa consolidara receitas, despesas, recorrencias e projecoes por periodo para apoiar decisoes administrativas." />;
}
