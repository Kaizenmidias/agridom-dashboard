import { FileSignature } from "lucide-react";
import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export function ContractsPage() {
  return <ModulePlaceholderPage title="Contratos" area="Jurídico" icon={FileSignature} description="Organize contratos e documentos jurídicos." moduleSummary="A área Contratos será utilizada para armazenar contratos, acompanhar status de assinatura, vencimentos, renovações e documentos vinculados a clientes e projetos." />;
}
