import { FileSignature } from "lucide-react";
import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export function ContractsPage() {
  return <ModulePlaceholderPage title="Contratos" area="Jurídico" icon={FileSignature} description="Organize contratos e documentos juridicos." moduleSummary="A area Contratos sera utilizada para armazenar contratos, acompanhar status de assinatura, vencimentos, renovacoes e documentos vinculados a clientes e projetos." />;
}
