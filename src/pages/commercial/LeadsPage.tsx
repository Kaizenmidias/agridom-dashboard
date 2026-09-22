import { useMemo, useState } from "react";
import {
  Archive,
  Building2,
  CheckCircle2,
  Circle,
  Edit,
  ExternalLink,
  Filter,
  Folder,
  FolderPlus,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Send,
  Trash2,
  UserRound,
  UserPlus,
  X,
} from "lucide-react";
import { AppBreadcrumbs } from "@/components/layout/AppBreadcrumbs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { useLeads } from "@/hooks/leads/useLeads";
import type { Lead, LeadFilters, LeadFolder, LeadSource, LeadStatus } from "@/types/lead";
import { formatPhone } from "@/utils/phone";
import { buildWhatsAppUrl } from "@/utils/whatsapp";
import { getWebsiteDomain, normalizeEmail, normalizeWebsiteUrl, slugify } from "@/utils/lead-formatters";
import { cn } from "@/lib/utils";

const statusLabels: Record<LeadStatus, string> = {
  novo: "Novo",
  nao_contatado: "Não contatado",
  em_contato: "Em contato",
  qualificado: "Qualificado",
  reuniao: "Reunião",
  proposta: "Proposta",
  negociacao: "Negociação",
  convertido: "Convertido",
  perdido: "Perdido",
  arquivado: "Arquivado",
};

const sourceLabels: Record<LeadSource, string> = {
  google_maps: "Google Maps",
  formulario: "Formulário",
  importacao: "Importação",
  indicacao: "Indicação",
  instagram: "Instagram",
  manual: "Manual",
  n8n: "n8n",
};

const initialFilters: LeadFilters = {
  folderId: "todos-os-leads",
  status: "all",
  source: "all",
  assignedTo: "all",
  city: "all",
  contactField: "all",
  scoreRange: "all",
  createdAt: "all",
  lastContactAt: "all",
};

function getScoreClass(score?: number | null) {
  const value = score || 0;
  if (value >= 70) return "bg-green-100 text-green-800 border-green-200";
  if (value >= 40) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getStatusClass(status: LeadStatus) {
  if (status === "convertido") return "bg-green-100 text-green-800";
  if (status === "perdido" || status === "arquivado") return "bg-red-100 text-red-800";
  if (status === "qualificado" || status === "reuniao" || status === "proposta") return "bg-blue-100 text-blue-800";
  return "bg-slate-100 text-slate-700";
}

function formatDate(value?: string | null) {
  if (!value) return "Nunca contatado";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nunca contatado";

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameDay) {
    return `Hoje, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";

  return date.toLocaleDateString("pt-BR");
}

function getLeadPersonName(lead: Lead) {
  return lead.contactName || lead.companyName || "Lead sem nome";
}

function getLeadOrganization(lead: Lead) {
  return lead.companyName || "Não informada";
}

function folderMatchesLead(folderId: string, lead: Lead) {
  if (folderId === "todos-os-leads") return true;
  if (folderId === "novos") return lead.status === "novo";
  if (folderId === "qualificados") return lead.status === "qualificado" || (lead.score || 0) >= 70;
  if (folderId === "sem-site") return !lead.website;
  if (folderId === "follow-up") return lead.status === "em_contato";
  if (folderId === "convertidos") return lead.status === "convertido";
  if (folderId === "arquivados") return lead.status === "arquivado";
  return lead.folderId === folderId;
}

function buildFolders(leads: Lead[], customFolders: LeadFolder[]) {
  const now = new Date().toISOString();
  const systemFolders: LeadFolder[] = [
    { id: "todos-os-leads", name: "Todos os Leads", icon: "folder", isSystem: true, createdAt: now },
    { id: "novos", name: "Novos", icon: "circle", isSystem: true, createdAt: now },
    { id: "qualificados", name: "Qualificados", icon: "check", isSystem: true, createdAt: now },
    { id: "sem-site", name: "Sem Site", icon: "folder", isSystem: true, createdAt: now },
    { id: "follow-up", name: "Follow-up", icon: "send", isSystem: true, createdAt: now },
    { id: "convertidos", name: "Convertidos", icon: "check", isSystem: true, createdAt: now },
    { id: "arquivados", name: "Arquivados", icon: "archive", isSystem: true, createdAt: now },
  ];

  return [...systemFolders, ...customFolders].map((folder) => ({
    ...folder,
    leadCount: leads.filter((lead) => folderMatchesLead(folder.id, lead)).length,
  }));
}

function getFolderIcon(folder: LeadFolder) {
  if (folder.icon === "check") return CheckCircle2;
  if (folder.icon === "archive") return Archive;
  if (folder.icon === "send") return Send;
  if (folder.icon === "circle") return Circle;
  return Folder;
}

function LeadTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

export default function LeadsPage() {
  const { leads, loading, error, reload } = useLeads();
  const [filters, setFilters] = useState<LeadFilters>(initialFilters);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [customFolders, setCustomFolders] = useState<LeadFolder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDescription, setNewFolderDescription] = useState("");
  const [newFolderIcon, setNewFolderIcon] = useState("folder");
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);

  const folders = useMemo(() => buildFolders(leads, customFolders), [leads, customFolders]);
  const selectedFolder = folders.find((folder) => folder.id === filters.folderId) || folders[0];
  const cities = useMemo(() => Array.from(new Set(leads.map((lead) => lead.city).filter(Boolean))).sort() as string[], [leads]);
  const owners = useMemo(() => Array.from(new Set(leads.map((lead) => lead.assignedTo).filter(Boolean))).sort() as string[], [leads]);

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return leads.filter((lead) => {
      const textMatches = !normalizedQuery || [
        lead.companyName,
        lead.phone,
        lead.email,
        lead.city,
        lead.assignedTo,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery));

      const fieldMatches =
        filters.contactField === "all" ||
        (filters.contactField === "has_whatsapp" && Boolean(buildWhatsAppUrl(lead.phone))) ||
        (filters.contactField === "has_email" && Boolean(lead.email)) ||
        (filters.contactField === "has_website" && Boolean(lead.website)) ||
        (filters.contactField === "without_website" && !lead.website);

      const score = lead.score || 0;
      const scoreMatches =
        filters.scoreRange === "all" ||
        (filters.scoreRange === "low" && score <= 39) ||
        (filters.scoreRange === "medium" && score >= 40 && score <= 69) ||
        (filters.scoreRange === "high" && score >= 70);

      return (
        folderMatchesLead(filters.folderId, lead) &&
        textMatches &&
        fieldMatches &&
        scoreMatches &&
        (filters.status === "all" || lead.status === filters.status) &&
        (filters.source === "all" || lead.source === filters.source) &&
        (filters.city === "all" || lead.city === filters.city) &&
        (filters.assignedTo === "all" || lead.assignedTo === filters.assignedTo)
      );
    });
  }, [filters, leads, query]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage));
  const paginatedLeads = filteredLeads.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const activeFilters = Object.entries(filters).filter(([key, value]) => key !== "folderId" && value !== "all").length;
  const allPageSelected = paginatedLeads.length > 0 && paginatedLeads.every((lead) => selectedIds.includes(lead.id));

  const updateFilter = (key: keyof LeadFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const toggleLead = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const togglePageSelection = () => {
    const pageIds = paginatedLeads.map((lead) => lead.id);
    setSelectedIds((current) => allPageSelected ? current.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...current, ...pageIds])));
  };

  const resetFilters = () => {
    setFilters({ ...initialFilters, folderId: filters.folderId });
    setQuery("");
    setPage(1);
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;

    setCustomFolders((current) => [
      ...current,
      {
        id: slugify(name),
        name,
        description: newFolderDescription.trim() || null,
        icon: newFolderIcon,
        isSystem: false,
        leadCount: 0,
        createdAt: new Date().toISOString(),
      },
    ]);
    setNewFolderName("");
    setNewFolderDescription("");
    setNewFolderIcon("folder");
    setFolderDialogOpen(false);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] space-y-4 bg-background p-4 md:p-6">
      <div className="space-y-3 border-b border-border/70 pb-4">
        <AppBreadcrumbs />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Leads</h1>
            <p className="text-sm text-muted-foreground">Organize pessoas, empresas e contatos comerciais.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-10 pl-9" placeholder="Buscar leads, empresas, e-mails..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <Button variant="outline">Importar</Button>
            <Button><Plus className="mr-2 h-4 w-4" />Novo Lead</Button>
          </div>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar leads</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void reload()}>Tentar novamente</Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid min-h-[680px] gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-border/80 bg-card">
          <div className="border-b border-border/70 px-4 py-3">
            <h2 className="text-sm font-semibold">Contatos</h2>
            <p className="text-xs text-muted-foreground">{leads.length} registros no CRM</p>
          </div>
          <div className="space-y-1 p-3">
            {folders.map((folder) => {
              const Icon = getFolderIcon(folder);
              const active = filters.folderId === folder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => updateFilter("folderId", folder.id)}
                  className={cn(
                    "flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted",
                    active && "bg-primary/10 font-medium text-primary"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{folder.leadCount || 0}</span>
                </button>
              );
            })}

            <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="mt-3 w-full justify-start">
                  <FolderPlus className="mr-2 h-4 w-4" />Nova pasta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova pasta de leads</DialogTitle>
                  <DialogDescription>Crie a estrutura visual da pasta. A persistência será conectada ao backend MySQL quando esta rotina estiver preparada.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="folder-name">Nome da pasta</Label>
                    <Input id="folder-name" value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="folder-description">Descrição opcional</Label>
                    <Input id="folder-description" value={newFolderDescription} onChange={(event) => setNewFolderDescription(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ícone</Label>
                    <Select value={newFolderIcon} onValueChange={setNewFolderIcon}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="folder">Pasta</SelectItem>
                        <SelectItem value="circle">Círculo</SelectItem>
                        <SelectItem value="send">Follow-up</SelectItem>
                        <SelectItem value="check">Validado</SelectItem>
                        <SelectItem value="archive">Arquivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Criar pasta</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </aside>

        <Card className="min-w-0 rounded-lg border border-border/80 shadow-none">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Encontre os contatos certos mais rápido</p>
                <p className="text-xs text-muted-foreground">Use status, origem, cidade e score para priorizar os leads com maior chance de avanço.</p>
              </div>
              <Button variant="secondary" size="sm" className="w-fit">
                <Filter className="mr-2 h-4 w-4" />Aplicar filtro
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>{selectedFolder?.name || "Todos os Leads"}</CardTitle>
                <p className="text-sm text-muted-foreground">{filteredLeads.length} lead(s) encontrados</p>
              </div>
              {activeFilters > 0 ? <Badge variant="secondary">{activeFilters} filtro(s) ativo(s)</Badge> : null}
            </div>

            <div className="grid gap-2 md:grid-cols-[repeat(4,minmax(130px,1fr))_auto]">
              <Select value={filters.status} onValueChange={(value) => updateFilter("status", value)}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  {Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.source} onValueChange={(value) => updateFilter("source", value)}>
                <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas origens</SelectItem>
                  {Object.entries(sourceLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.city} onValueChange={(value) => updateFilter("city", value)}>
                <SelectTrigger><SelectValue placeholder="Cidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas cidades</SelectItem>
                  {cities.map((city) => <SelectItem key={city} value={city}>{city}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.scoreRange} onValueChange={(value) => updateFilter("scoreRange", value)}>
                <SelectTrigger><SelectValue placeholder="Score" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos scores</SelectItem>
                  <SelectItem value="low">0 a 39</SelectItem>
                  <SelectItem value="medium">40 a 69</SelectItem>
                  <SelectItem value="high">70 a 100</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={resetFilters}>
                <X className="mr-2 h-4 w-4" />Limpar
              </Button>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <Select value={filters.contactField} onValueChange={(value) => updateFilter("contactField", value)}>
                <SelectTrigger><SelectValue placeholder="Contato" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos contatos</SelectItem>
                  <SelectItem value="has_whatsapp">Possui WhatsApp</SelectItem>
                  <SelectItem value="has_email">Possui e-mail</SelectItem>
                  <SelectItem value="has_website">Possui website</SelectItem>
                  <SelectItem value="without_website">Sem website</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.assignedTo} onValueChange={(value) => updateFilter("assignedTo", value)}>
                <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos responsáveis</SelectItem>
                  {owners.map((owner) => <SelectItem key={owner} value={owner}>{owner}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" className="justify-start">
                <Filter className="mr-2 h-4 w-4" />Filtros avançados
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {selectedIds.length > 0 ? (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3">
                <span className="text-sm font-medium">{selectedIds.length} selecionado(s)</span>
                {["Mover para pasta", "Alterar status", "Atribuir responsável", "Adicionar ao Kanban", "Exportar", "Arquivar", "Excluir"].map((action) => (
                  <Button key={action} variant={action === "Excluir" ? "destructive" : "outline"} size="sm">{action}</Button>
                ))}
              </div>
            ) : null}

            {loading ? (
              <LeadTableSkeleton />
            ) : leads.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center">
                <h3 className="font-semibold">Nenhum lead encontrado na base atual</h3>
                <p className="mt-1 text-sm text-muted-foreground">Quando a tabela de prospecção receber contatos do n8n ou das buscas, eles aparecerão aqui.</p>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center">
                <h3 className="font-semibold">Nenhum resultado para os filtros atuais</h3>
                <p className="mt-1 text-sm text-muted-foreground">Ajuste a busca ou limpe os filtros para visualizar mais leads.</p>
                <Button variant="outline" className="mt-4" onClick={resetFilters}>Limpar filtros</Button>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto rounded-md border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"><Checkbox checked={allPageSelected} onCheckedChange={togglePageSelection} /></TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Organização</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Último contato</TableHead>
                        <TableHead className="w-10">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLeads.map((lead) => {
                        const whatsappUrl = buildWhatsAppUrl(lead.phone);
                        const websiteUrl = normalizeWebsiteUrl(lead.website);
                        const email = normalizeEmail(lead.email);
                        const leadName = getLeadPersonName(lead);
                        const organization = getLeadOrganization(lead);

                        return (
                          <TableRow key={lead.id} className="h-16">
                            <TableCell><Checkbox checked={selectedIds.includes(lead.id)} onCheckedChange={() => toggleLead(lead.id)} /></TableCell>
                            <TableCell className="min-w-[240px]">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border border-border/70 bg-muted">
                                  <AvatarFallback>{leadName.slice(0, 1).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{leadName}</p>
                                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                    <UserRound className="h-3 w-3" />{lead.category || "Sem categoria"}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[210px]">
                              <div className="min-w-0">
                                <p className="flex items-center gap-1 truncate font-medium"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{organization}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {websiteUrl ? <a className="inline-flex items-center gap-1 hover:text-primary" href={websiteUrl} target="_blank" rel="noreferrer">{getWebsiteDomain(websiteUrl)}<ExternalLink className="h-3 w-3" /></a> : "Sem site"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[220px]">
                              {email ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`mailto:${email}`}><Mail className="h-3.5 w-3.5" />{email}</a> : "Sem e-mail"}
                            </TableCell>
                            <TableCell className="min-w-[170px]">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{formatPhone(lead.phone)}</span>
                                {whatsappUrl ? <Button variant="ghost" size="icon" className="h-7 w-7" asChild><a href={whatsappUrl} target="_blank" rel="noreferrer"><Send className="h-4 w-4" /></a></Button> : null}
                              </div>
                            </TableCell>
                            <TableCell>{[lead.city, lead.state].filter(Boolean).join(" / ") || "Não informada"}</TableCell>
                            <TableCell>{sourceLabels[lead.source]}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusClass(lead.status)}>{statusLabels[lead.status]}</Badge>
                                <Badge variant="outline" className={getScoreClass(lead.score)}>{lead.score || 0}</Badge>
                              </div>
                            </TableCell>
                            <TableCell>{lead.assignedTo || "Sem responsável"}</TableCell>
                            <TableCell>{formatDate(lead.lastContactAt)}</TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>Ver lead</DropdownMenuItem>
                                  <DropdownMenuItem><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                                  {whatsappUrl ? <DropdownMenuItem asChild><a href={whatsappUrl} target="_blank" rel="noreferrer">Abrir WhatsApp</a></DropdownMenuItem> : null}
                                  {email ? <DropdownMenuItem asChild><a href={`mailto:${email}`}>Enviar e-mail</a></DropdownMenuItem> : null}
                                  <DropdownMenuItem>Mover para pasta</DropdownMenuItem>
                                  <DropdownMenuItem>Alterar status</DropdownMenuItem>
                                  <DropdownMenuItem>Adicionar ao Kanban</DropdownMenuItem>
                                  <DropdownMenuItem>Criar tarefa</DropdownMenuItem>
                                  <DropdownMenuItem>Arquivar</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => setLeadToDelete(lead)}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3 md:hidden">
                  {paginatedLeads.map((lead) => (
                    <div key={lead.id} className="rounded-md border p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox checked={selectedIds.includes(lead.id)} onCheckedChange={() => toggleLead(lead.id)} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{lead.companyName}</p>
                          <p className="text-sm text-muted-foreground">{[lead.city, lead.state].filter(Boolean).join(" / ") || "Não informada"}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant="outline" className={getScoreClass(lead.score)}>{lead.score || 0}</Badge>
                            <Badge className={getStatusClass(lead.status)}>{statusLabels[lead.status]}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <DataTablePagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={filteredLeads.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setPage}
                  onItemsPerPageChange={(value) => {
                    setItemsPerPage(value);
                    setPage(1);
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={Boolean(leadToDelete)} onOpenChange={(open) => !open && setLeadToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação exigirá integração de exclusão com o backend antes de remover dados reais. O lead selecionado foi marcado apenas para confirmação visual nesta etapa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => setLeadToDelete(null)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
