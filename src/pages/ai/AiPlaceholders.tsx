import { Bot, Braces, BrainCircuit, FileText, MessageSquareText } from "lucide-react";
import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export function AssistantsPage() {
  return <ModulePlaceholderPage title="Assistentes" area="Inteligência Artificial" icon={MessageSquareText} description="Organize assistentes internos por finalidade." moduleSummary="Assistentes reunirá configurações, objetivos e canais de uso dos assistentes internos da Kaizen para apoio operacional e comercial." />;
}

export function ContentsPage() {
  return <ModulePlaceholderPage title="Conteúdos" area="Inteligência Artificial" icon={FileText} description="Estruture geração e revisão de conteúdos." moduleSummary="Conteúdos será usado para planejar, acompanhar e registrar materiais criados com apoio de IA, mantendo contexto por cliente, projeto ou campanha interna." />;
}

export function PromptsPage() {
  return <ModulePlaceholderPage title="Prompts" area="Inteligência Artificial" icon={Braces} description="Centralize prompts aprovados e reutilizáveis." moduleSummary="Prompts organizará instruções, variáveis, modelos e versões usadas pelos times para manter consistência nos processos com IA." />;
}

export function AgentsPage() {
  return <ModulePlaceholderPage title="Agentes" area="Inteligência Artificial" icon={BrainCircuit} description="Prepare agentes especializados para fluxos internos." moduleSummary="Agentes será a área de definição e acompanhamento de agentes com responsabilidades específicas, integrações e histórico de execução." />;
}

export function AiOverviewPage() {
  return <ModulePlaceholderPage title="Inteligência Artificial" area="Inteligência Artificial" icon={Bot} description="Base para recursos internos de IA." moduleSummary="Esta área agrupará os recursos de IA usados pela Kaizen em processos comerciais, operacionais e administrativos." />;
}

