import { Bot, Braces, BrainCircuit, FileText, MessageSquareText } from "lucide-react";
import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export function AssistantsPage() {
  return <ModulePlaceholderPage title="Assistentes" area="Inteligencia Artificial" icon={MessageSquareText} description="Organize assistentes internos por finalidade." moduleSummary="Assistentes reunira configuracoes, objetivos e canais de uso dos assistentes internos da Kaizen para apoio operacional e comercial." />;
}

export function ContentsPage() {
  return <ModulePlaceholderPage title="Conteudos" area="Inteligencia Artificial" icon={FileText} description="Estruture geracao e revisao de conteudos." moduleSummary="Conteudos sera usado para planejar, acompanhar e registrar materiais criados com apoio de IA, mantendo contexto por cliente, projeto ou campanha interna." />;
}

export function PromptsPage() {
  return <ModulePlaceholderPage title="Prompts" area="Inteligencia Artificial" icon={Braces} description="Centralize prompts aprovados e reutilizaveis." moduleSummary="Prompts organizara instrucoes, variaveis, modelos e versoes usadas pelos times para manter consistencia nos processos com IA." />;
}

export function AgentsPage() {
  return <ModulePlaceholderPage title="Agentes" area="Inteligencia Artificial" icon={BrainCircuit} description="Prepare agentes especializados para fluxos internos." moduleSummary="Agentes sera a area de definicao e acompanhamento de agentes com responsabilidades especificas, integracoes e historico de execucao." />;
}

export function AiOverviewPage() {
  return <ModulePlaceholderPage title="Inteligencia Artificial" area="Inteligencia Artificial" icon={Bot} description="Base para recursos internos de IA." moduleSummary="Esta area agrupara os recursos de IA usados pela Kaizen em processos comerciais, operacionais e administrativos." />;
}

