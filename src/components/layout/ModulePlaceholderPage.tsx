import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppBreadcrumbs } from "@/components/layout/AppBreadcrumbs";

type ModulePlaceholderPageProps = {
  title: string;
  description: string;
  moduleSummary: string;
  area: string;
  icon: LucideIcon;
};

export function ModulePlaceholderPage({
  title,
  description,
  moduleSummary,
  area,
  icon: Icon,
}: ModulePlaceholderPageProps) {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-3">
        <AppBreadcrumbs />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-normal text-foreground">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <Badge variant="outline" className="w-fit">{area}</Badge>
        </div>
      </div>

      <Card className="rounded-lg border shadow-none">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{moduleSummary}</p>
          <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            A estrutura inicial ja esta preparada para receber dados, filtros, permissoes e integracoes quando a area for ativada.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
