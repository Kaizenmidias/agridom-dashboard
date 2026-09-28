import { Smartphone } from "lucide-react";
import { AppBreadcrumbs } from "@/components/layout/AppBreadcrumbs";
import { WhatsAppIntegrationPanel } from "@/components/integrations/WhatsAppIntegrationPanel";

export function ConnectedNumbersPage() {
  return <div className="space-y-5 p-4 md:p-6"><AppBreadcrumbs /><div><div className="flex items-center gap-2"><Smartphone className="h-6 w-6 text-primary" /><h1 className="text-3xl font-bold">Números conectados</h1></div><p className="text-muted-foreground">Gerencie os números de WhatsApp conectados ao CRM.</p></div><WhatsAppIntegrationPanel /></div>;
}
