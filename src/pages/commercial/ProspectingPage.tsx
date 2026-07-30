import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Instagram,
  Loader2,
  MapPinned,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import { AppBreadcrumbs } from "@/components/layout/AppBreadcrumbs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { prospectingAPI } from "@/api/prospecting";
import type {
  BrazilianCity,
  CnaeCode,
  IntegrationSummary,
  ProspectingJob,
  ProspectingJobEvent,
  ProspectingResult,
  ProspectingSearchPayload,
  ProspectingSource,
} from "@/types/prospecting";
import {
  buildProspectingWhatsAppUrl,
  formatBrazilianPhone,
  formatCnpj,
  getWhatsAppStatusLabel,
} from "@/utils/prospecting-normalizers";
import { cn } from "@/lib/utils";

const sourceConfig = {
  google_maps: { label: "Google Maps", icon: MapPinned, queryValue: "google-maps" },
  cnpj: { label: "CNPJ", icon: Building2, queryValue: "cnpj" },
  instagram: { label: "Instagram", icon: Instagram, queryValue: "instagram" },
};

const stateOptions = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

function queryToSource(value: string | null): ProspectingSource {
  if (value === "cnpj") return "cnpj";
  if (value === "instagram") return "instagram";
  return "google_maps";
}

function getStatusBadge(status: ProspectingJob["status"]) {
  if (status === "completed") return "bg-green-100 text-green-800";
  if (status === "failed" || status === "cancelled") return "bg-red-100 text-red-800";
  return "bg-blue-100 text-blue-800";
}

function getDuplicateBadge(status: ProspectingResult["duplicateStatus"]) {
  if (status === "duplicate") return "bg-red-100 text-red-800";
  if (status === "possible_duplicate") return "bg-amber-100 text-amber-800";
  return "bg-green-100 text-green-800";
}

function getDuplicateLabel(status: ProspectingResult["duplicateStatus"]) {
  if (status === "duplicate") return "Ja existe";
  if (status === "possible_duplicate") return "Possivel duplicado";
  return "Novo lead";
}

function getWhatsAppBadge(status: ProspectingResult["whatsappStatus"], phone?: string | null) {
  if (!phone) return "bg-slate-100 text-slate-700";
  if (status === "valid") return "bg-green-100 text-green-800";
  if (status === "invalid" || status === "provider_error") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

function getElapsedLabel(job?: ProspectingJob | null) {
  if (!job?.startedAt) return "Ainda nao iniciado";
  const start = new Date(job.startedAt).getTime();
  const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}min ${seconds % 60}s`;
}

function IntegrationConsumption({ integrations }: { integrations: IntegrationSummary[] }) {
  const apify = integrations.find((item) => item.provider === "apify");
  const casa = integrations.find((item) => item.provider === "casa_dos_dados");
  const whatsapp = integrations.find((item) => item.provider === "whatsapp_validator");

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {[apify, casa, whatsapp].filter(Boolean).map((item) => (
        <Card key={item!.provider} className="rounded-lg border shadow-none">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">{item!.displayName}</p>
              <p className="text-xs text-muted-foreground">{item!.configured ? "Configurada no backend" : "Nao configurada"}</p>
            </div>
            <Badge variant={item!.configured ? "default" : "secondary"}>{item!.creditsBalance != null ? `${item!.creditsBalance} creditos` : item!.status}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GoogleMapsSearchForm({
  disabledWhatsApp,
  onSubmit,
  running,
}: {
  disabledWhatsApp: boolean;
  onSubmit: (payload: ProspectingSearchPayload) => void;
  running: boolean;
}) {
  const [searchTerms, setSearchTerms] = useState("");
  const [quantity, setQuantity] = useState("20");
  const [minimumRating, setMinimumRating] = useState("any");
  const [onlyValidatedWhatsApp, setOnlyValidatedWhatsApp] = useState(false);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Termos de busca</Label>
        <Textarea placeholder="Ex.: escritorio de contabilidade em Curitiba" value={searchTerms} onChange={(event) => setSearchTerms(event.target.value)} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Quantidade</Label>
          <Select value={quantity} onValueChange={setQuantity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[10, 20, 30, 50, 100].map((item) => <SelectItem key={item} value={String(item)}>{item}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Estrelas minimas</Label>
          <Select value={minimumRating} onValueChange={setMinimumRating}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer avaliacao</SelectItem>
              <SelectItem value="3">3 estrelas ou mais</SelectItem>
              <SelectItem value="3.5">3,5 estrelas ou mais</SelectItem>
              <SelectItem value="4">4 estrelas ou mais</SelectItem>
              <SelectItem value="4.5">4,5 estrelas ou mais</SelectItem>
              <SelectItem value="5">5 estrelas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={onlyValidatedWhatsApp} disabled={disabledWhatsApp} onCheckedChange={(value) => setOnlyValidatedWhatsApp(Boolean(value))} />
            <Label>So com WhatsApp validado</Label>
          </div>
          {disabledWhatsApp ? <p className="text-xs text-muted-foreground">Configure um serviço de validação de WhatsApp em Administração / Integrações.</p> : null}
        </div>
      </div>
      <Button disabled={running || !searchTerms.trim()} onClick={() => onSubmit({ source: "google_maps", searchTerms, quantity: Number(quantity), minimumRating: minimumRating === "any" ? null : Number(minimumRating), onlyValidatedWhatsApp })}>
        {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Buscar empresas
      </Button>
    </div>
  );
}

function CnpjSearchForm({
  disabledWhatsApp,
  onSubmit,
  running,
}: {
  disabledWhatsApp: boolean;
  onSubmit: (payload: ProspectingSearchPayload) => void;
  running: boolean;
}) {
  const [cnaeQuery, setCnaeQuery] = useState("");
  const [cnaes, setCnaes] = useState<CnaeCode[]>([]);
  const [selectedCnaes, setSelectedCnaes] = useState<CnaeCode[]>([]);
  const [state, setState] = useState("");
  const [cities, setCities] = useState<BrazilianCity[]>([]);
  const [city, setCity] = useState("");
  const [quantity, setQuantity] = useState("20");
  const [includeSecondaryActivity, setIncludeSecondaryActivity] = useState(false);
  const [onlyValidatedWhatsApp, setOnlyValidatedWhatsApp] = useState(false);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (cnaeQuery.trim().length < 2) {
        setCnaes([]);
        return;
      }
      try {
        const data = await prospectingAPI.searchCnaes(cnaeQuery);
        setCnaes(data.items);
      } catch {
        setCnaes([]);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [cnaeQuery]);

  useEffect(() => {
    setCity("");
    if (!state) {
      setCities([]);
      return;
    }
    void prospectingAPI.getCities(state).then((data) => setCities(data.items)).catch(() => setCities([]));
  }, [state]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nicho / Atividade</Label>
        <Input placeholder="Pesquise por codigo CNAE ou descricao" value={cnaeQuery} onChange={(event) => setCnaeQuery(event.target.value)} />
        {cnaes.length > 0 ? (
          <div className="rounded-md border">
            {cnaes.map((item) => (
              <button key={item.id} type="button" className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => setSelectedCnaes((current) => current.some((selected) => selected.id === item.id) ? current : [...current, item])}>
                <span className="font-medium">{item.formattedCode}</span>
                <span className="text-muted-foreground">{item.description}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {selectedCnaes.map((item) => (
            <Badge key={item.id} variant="secondary" className="gap-2">
              {item.formattedCode}
              <button type="button" onClick={() => setSelectedCnaes((current) => current.filter((selected) => selected.id !== item.id))}>x</button>
            </Badge>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-2">
          <Label>Estado</Label>
          <Select value={state} onValueChange={setState}>
            <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
            <SelectContent>{stateOptions.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Cidade</Label>
          <Select value={city} onValueChange={setCity} disabled={!state}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{cities.map((item) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Quantidade</Label>
          <Select value={quantity} onValueChange={setQuantity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[10, 20, 30, 50, 100].map((item) => <SelectItem key={item} value={String(item)}>{item} empresas</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Consumo estimado informado pela integracao quando disponivel.</p>
        </div>
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={includeSecondaryActivity} onCheckedChange={(value) => setIncludeSecondaryActivity(Boolean(value))} />
            <Label>Incluir atividade secundaria</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={onlyValidatedWhatsApp} disabled={disabledWhatsApp} onCheckedChange={(value) => setOnlyValidatedWhatsApp(Boolean(value))} />
            <Label>So com WhatsApp validado</Label>
          </div>
        </div>
      </div>
      <Button disabled={running || selectedCnaes.length === 0 || !state} onClick={() => onSubmit({ source: "cnpj", cnaeCodes: selectedCnaes.map((item) => item.code), state, city: city || null, quantity: Number(quantity), includeSecondaryActivity, onlyValidatedWhatsApp })}>
        {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Buscar empresas
      </Button>
    </div>
  );
}

function InstagramSearchForm({ onSubmit, running }: { onSubmit: (payload: ProspectingSearchPayload) => void; running: boolean }) {
  const [searchTerms, setSearchTerms] = useState("");
  const [quantity, setQuantity] = useState("20");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Termos de busca</Label>
        <Input placeholder="Ex.: Contabilidade" value={searchTerms} onChange={(event) => setSearchTerms(event.target.value)} />
        <p className="text-sm text-muted-foreground">A busca retornara perfis publicos relacionados ao termo informado. A disponibilidade dos dados depende das informacoes publicas de cada perfil.</p>
      </div>
      <div className="max-w-xs space-y-2">
        <Label>Quantidade</Label>
        <Select value={quantity} onValueChange={setQuantity}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{[10, 20, 30, 50, 100].map((item) => <SelectItem key={item} value={String(item)}>{item} perfis</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button disabled={running || !searchTerms.trim()} onClick={() => onSubmit({ source: "instagram", searchTerms, quantity: Number(quantity) })}>
        {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Instagram className="mr-2 h-4 w-4" />}Buscar perfis
      </Button>
    </div>
  );
}

function ProspectingJobProgress({ job, events, onCancel }: { job: ProspectingJob | null; events: ProspectingJobEvent[]; onCancel: () => void }) {
  const steps = ["Preparando consulta", "Enviando para o provedor", "Buscando resultados", "Recebendo dados", "Normalizando contatos", "Verificando duplicidades", "Validando WhatsApp", "Finalizando"];
  const running = job && !["completed", "failed", "cancelled"].includes(job.status);

  return (
    <Card className="rounded-lg border shadow-none">
      <CardHeader>
        <CardTitle>Progresso da consulta</CardTitle>
        <CardDescription>Nao exibimos porcentagem artificial; o acompanhamento usa etapas e eventos reais do backend.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {job ? (
          <div className="grid gap-3 md:grid-cols-4">
            <Badge className={getStatusBadge(job.status)}>{job.status}</Badge>
            <span className="text-sm text-muted-foreground">Tempo: {getElapsedLabel(job)}</span>
            <span className="text-sm text-muted-foreground">Encontrados: {job.foundCount}</span>
            <span className="text-sm text-muted-foreground">Processados: {job.processedCount}</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma consulta iniciada nesta sessao.</p>
        )}
        <div className="grid gap-2 md:grid-cols-4">
          {steps.map((step) => {
            const reached = events.some((event) => step.toLowerCase().includes(event.message.toLowerCase().split(" ")[0]));
            return (
              <div key={step} className={cn("rounded-md border p-3 text-sm", reached ? "bg-primary/5 text-primary" : "bg-muted/30 text-muted-foreground")}>
                {step}
              </div>
            );
          })}
        </div>
        {job?.errorMessage ? <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Erro</AlertTitle><AlertDescription>{job.errorMessage}</AlertDescription></Alert> : null}
        {running ? <Button variant="outline" onClick={onCancel}>Cancelar</Button> : null}
      </CardContent>
    </Card>
  );
}

function ProspectingSummaryCards({ results }: { results: ProspectingResult[] }) {
  const values = [
    ["Encontrados", results.length],
    ["Novos", results.filter((item) => item.duplicateStatus === "new").length],
    ["Duplicados", results.filter((item) => item.duplicateStatus !== "new").length],
    ["Com telefone", results.filter((item) => item.phone).length],
    ["WhatsApp validado", results.filter((item) => item.whatsappStatus === "valid").length],
    ["Com e-mail", results.filter((item) => item.email).length],
    ["Com website", results.filter((item) => item.website).length],
    ["Sem website", results.filter((item) => !item.website).length],
  ];

  return (
    <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
      {values.map(([label, value]) => (
        <Card key={label} className="rounded-lg border shadow-none">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProspectingResultsTable({
  results,
  selectedIds,
  onToggle,
  onToggleAll,
  onImport,
}: {
  results: ProspectingResult[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onImport: () => void;
}) {
  const allSelected = results.length > 0 && results.filter((item) => item.duplicateStatus !== "duplicate").every((item) => selectedIds.includes(item.id));

  return (
    <Card className="rounded-lg border shadow-none">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Resultados encontrados</CardTitle>
            <CardDescription>Selecione oportunidades novas ou possiveis duplicados para revisar e importar.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline"><Filter className="mr-2 h-4 w-4" />Filtros</Button>
            <Button disabled={selectedIds.length === 0} onClick={onImport}><Plus className="mr-2 h-4 w-4" />Adicionar selecionados aos Leads</Button>
          </div>
        </div>
        {selectedIds.length > 0 ? <Badge variant="secondary" className="w-fit">{selectedIds.length} selecionado(s)</Badge> : null}
      </CardHeader>
      <CardContent>
        {results.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center">
            <p className="font-medium">Nenhum resultado carregado</p>
            <p className="text-sm text-muted-foreground">Execute uma consulta para visualizar os resultados normalizados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={onToggleAll} /></TableHead>
                  <TableHead>Empresa / Perfil</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Avaliacao</TableHead>
                  <TableHead>CNPJ / Instagram</TableHead>
                  <TableHead>Duplicidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((item) => {
                  const disabled = item.duplicateStatus === "duplicate";
                  const whatsappUrl = buildProspectingWhatsAppUrl(item.phone);
                  return (
                    <TableRow key={item.id}>
                      <TableCell><Checkbox disabled={disabled} checked={selectedIds.includes(item.id)} onCheckedChange={() => onToggle(item.id)} /></TableCell>
                      <TableCell className="min-w-[220px]">
                        <p className="font-medium">{item.companyName}</p>
                        <p className="text-xs text-muted-foreground">{item.category || item.tradeName || "Sem categoria"}</p>
                      </TableCell>
                      <TableCell>{sourceConfig[item.source].label}</TableCell>
                      <TableCell>{formatBrazilianPhone(item.phone) || "Sem telefone"}</TableCell>
                      <TableCell><Badge className={getWhatsAppBadge(item.whatsappStatus, item.phone)}>{item.phone ? getWhatsAppStatusLabel(item.whatsappStatus) : "Sem telefone"}</Badge></TableCell>
                      <TableCell>{item.email ? <a className="text-primary hover:underline" href={`mailto:${item.email}`}>{item.email}</a> : "Sem e-mail"}</TableCell>
                      <TableCell>{item.website ? <a className="text-primary hover:underline" href={item.website.startsWith("http") ? item.website : `https://${item.website}`} target="_blank" rel="noreferrer">Abrir</a> : "Sem site"}</TableCell>
                      <TableCell>{[item.city, item.state].filter(Boolean).join(" / ") || "Nao informado"}</TableCell>
                      <TableCell>{item.rating ? `${item.rating} (${item.reviewCount || 0})` : "Nao informada"}</TableCell>
                      <TableCell>{item.cnpj ? formatCnpj(item.cnpj) : item.instagramUsername ? `@${item.instagramUsername}` : "Nao informado"}</TableCell>
                      <TableCell><Badge className={getDuplicateBadge(item.duplicateStatus)}>{getDuplicateLabel(item.duplicateStatus)}</Badge></TableCell>
                      <TableCell>{item.validationStatus}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Ver detalhes</DropdownMenuItem>
                            {item.instagramUrl ? <DropdownMenuItem asChild><a href={item.instagramUrl} target="_blank" rel="noreferrer">Abrir Instagram</a></DropdownMenuItem> : null}
                            {item.website ? <DropdownMenuItem asChild><a href={item.website.startsWith("http") ? item.website : `https://${item.website}`} target="_blank" rel="noreferrer">Abrir website</a></DropdownMenuItem> : null}
                            {whatsappUrl ? <DropdownMenuItem asChild><a href={whatsappUrl} target="_blank" rel="noreferrer">Abrir WhatsApp</a></DropdownMenuItem> : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProspectingImportDialog({
  open,
  onOpenChange,
  selectedCount,
  source,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  source: ProspectingSource;
  onConfirm: (options: { folderName: string; status: string; assignedTo: string; tags: string[] }) => void;
}) {
  const [folderName, setFolderName] = useState("Novos");
  const [status, setStatus] = useState("Novo");
  const [assignedTo, setAssignedTo] = useState("");
  const [tags, setTags] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar aos Leads</DialogTitle>
          <DialogDescription>{selectedCount} resultado(s) selecionado(s). Duplicados definitivos serao ignorados pelo backend.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Pasta de destino</Label><Input value={folderName} onChange={(event) => setFolderName(event.target.value)} /></div>
          <div className="space-y-2">
            <Label>Status inicial</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Novo">Novo</SelectItem>
                <SelectItem value="Contato Enviado">Contato enviado</SelectItem>
                <SelectItem value="Interessado">Interessado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Responsavel</Label><Input value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} /></div>
          <div className="space-y-2"><Label>Origem</Label><Input value={`Prospeccao - ${sourceConfig[source].label}`} disabled /></div>
          <div className="space-y-2"><Label>Tags</Label><Input placeholder="Separadas por virgula" value={tags} onChange={(event) => setTags(event.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onConfirm({ folderName, status, assignedTo, tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean) })}>Importar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProspectingHistory({ items, onRefresh }: { items: ProspectingJob[]; onRefresh: () => void }) {
  return (
    <Card className="rounded-lg border shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Historico recente</CardTitle>
          <CardDescription>Buscas realizadas e status operacional.</CardDescription>
        </div>
        <Button variant="outline" size="icon" onClick={onRefresh}><RefreshCw className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma busca registrada ainda.</p> : null}
        {items.map((item) => (
          <div key={item.id} className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[1fr_auto_auto_auto] md:items-center">
            <div>
              <p className="font-medium">{sourceConfig[item.source].label}</p>
              <p className="text-muted-foreground">{new Date(item.createdAt).toLocaleString("pt-BR")} | {item.requestedQuantity} solicitados | {item.foundCount} encontrados</p>
            </div>
            <Badge className={getStatusBadge(item.status)}>{item.status}</Badge>
            <Button variant="outline" size="sm">Ver resultados</Button>
            <Button variant="outline" size="sm">Repetir busca</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ProspectingPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [source, setSource] = useState<ProspectingSource>(() => queryToSource(searchParams.get("fonte")));
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [job, setJob] = useState<ProspectingJob | null>(null);
  const [events, setEvents] = useState<ProspectingJobEvent[]>([]);
  const [results, setResults] = useState<ProspectingResult[]>([]);
  const [history, setHistory] = useState<ProspectingJob[]>([]);
  const [running, setRunning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  const whatsappConfigured = integrations.some((item) => item.provider === "whatsapp_validator" && item.configured);

  const loadInitialData = async () => {
    try {
      const [integrationData, historyData] = await Promise.all([
        prospectingAPI.getIntegrations(),
        prospectingAPI.getHistory().catch(() => ({ items: [] })),
      ]);
      setIntegrations(integrationData.integrations);
      setHistory(historyData.items);
    } catch (error) {
      toast({
        title: "Erro ao carregar prospeccao",
        description: error instanceof Error ? error.message : "Nao foi possivel carregar os dados iniciais.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    void loadInitialData();
  }, []);

  const handleSourceChange = (value: string) => {
    const nextSource = value as ProspectingSource;
    setSource(nextSource);
    setSearchParams({ fonte: sourceConfig[nextSource].queryValue });
  };

  const refreshJob = async (jobId: string) => {
    const data = await prospectingAPI.getJob(jobId);
    setJob(data.job);
    setEvents(data.events);
    const resultData = await prospectingAPI.getResults(jobId);
    setResults(resultData.items);
  };

  const startSearch = async (payload: ProspectingSearchPayload) => {
    try {
      setRunning(true);
      setSelectedIds([]);
      setResults([]);
      const createdJob = await prospectingAPI.createJob(payload);
      setJob(createdJob);
      await refreshJob(createdJob.id);
      const completedJob = await prospectingAPI.startJob(createdJob.id);
      setJob(completedJob);
      await refreshJob(createdJob.id);
      await loadInitialData();
      toast({ title: "Busca finalizada", description: `${completedJob.foundCount} resultado(s) encontrados.` });
    } catch (error) {
      toast({
        title: "Nao foi possivel executar a busca",
        description: error instanceof Error ? error.message : "Verifique as integracoes e a migration de prospeccao.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const toggleResult = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleAllResults = () => {
    const selectable = results.filter((item) => item.duplicateStatus !== "duplicate").map((item) => item.id);
    const allSelected = selectable.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : selectable);
  };

  const importSelected = async (options: { folderName: string; status: string; assignedTo: string; tags: string[] }) => {
    try {
      const result = await prospectingAPI.importResults({
        resultIds: selectedIds,
        folderName: options.folderName,
        status: options.status,
        assignedTo: options.assignedTo,
        origin: `Prospeccao - ${sourceConfig[source].label}`,
        tags: options.tags,
      });
      toast({ title: "Importacao concluida", description: result.message });
      setImportOpen(false);
      setSelectedIds([]);
      if (job) await refreshJob(job.id);
    } catch (error) {
      toast({
        title: "Erro ao importar leads",
        description: error instanceof Error ? error.message : "Nao foi possivel importar os selecionados.",
        variant: "destructive",
      });
    }
  };

  const cancelJob = async () => {
    if (!job) return;
    try {
      const cancelled = await prospectingAPI.cancelJob(job.id);
      setJob(cancelled);
      await refreshJob(job.id);
    } catch (error) {
      toast({ title: "Erro ao cancelar", description: error instanceof Error ? error.message : "Nao foi possivel cancelar.", variant: "destructive" });
    }
  };

  const SourceIcon = sourceConfig[source].icon;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-3">
        <AppBreadcrumbs />
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <SourceIcon className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold">Prospeccao</h1>
            </div>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Encontre, valide e organize novas oportunidades comerciais a partir do Google Maps, CNPJ e Instagram.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/administracao/integracoes"><ExternalLink className="mr-2 h-4 w-4" />Integrações</Link>
          </Button>
        </div>
      </div>

      <IntegrationConsumption integrations={integrations} />

      <Card className="rounded-lg border shadow-none">
        <CardHeader>
          <CardTitle>Fonte de prospeccao</CardTitle>
          <CardDescription>Escolha a origem e preencha os filtros da consulta.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={source} onValueChange={handleSourceChange}>
            <TabsList className="grid w-full grid-cols-3">
              {Object.entries(sourceConfig).map(([key, config]) => (
                <TabsTrigger key={key} value={key} className="gap-2">
                  <config.icon className="h-4 w-4" />{config.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="google_maps" className="mt-6">
              <GoogleMapsSearchForm disabledWhatsApp={!whatsappConfigured} running={running} onSubmit={startSearch} />
            </TabsContent>
            <TabsContent value="cnpj" className="mt-6">
              <CnpjSearchForm disabledWhatsApp={!whatsappConfigured} running={running} onSubmit={startSearch} />
            </TabsContent>
            <TabsContent value="instagram" className="mt-6">
              <InstagramSearchForm running={running} onSubmit={startSearch} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ProspectingJobProgress job={job} events={events} onCancel={() => void cancelJob()} />
      <ProspectingSummaryCards results={results} />
      <ProspectingResultsTable results={results} selectedIds={selectedIds} onToggle={toggleResult} onToggleAll={toggleAllResults} onImport={() => setImportOpen(true)} />
      <ProspectingHistory items={history} onRefresh={() => void loadInitialData()} />

      <ProspectingImportDialog open={importOpen} onOpenChange={setImportOpen} selectedCount={selectedIds.length} source={source} onConfirm={importSelected} />
    </div>
  );
}

