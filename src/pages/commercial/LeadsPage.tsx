import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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
  X,
} from "lucide-react";
import { AppBreadcrumbs } from "@/components/layout/AppBreadcrumbs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LeadLabelPicker } from "@/components/leads/LeadLabelPicker";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { LEAD_SECTORS, formatBRLInput } from "@/constants/lead-options";
import { useLeads } from "@/hooks/leads/useLeads";
import {
  addLeadToPipeline as persistLeadToPipeline,
  createLead,
  deleteLead,
  deleteLeads,
  applyBulkLeadAction,
  updateLead,
} from "@/services/leads/lead-service";
import {
  commercialEntitiesAPI,
  type UserOption,
} from "@/services/commercial-entities";
import type {
  Lead,
  LeadFilters,
  LeadFolder,
  LeadLabel,
  LeadSource,
  LeadStatus,
} from "@/types/lead";
import { formatPhone } from "@/utils/phone";
import { buildWhatsAppUrl } from "@/utils/whatsapp";
import {
  getWebsiteDomain,
  normalizeEmail,
  normalizeWebsiteUrl,
  slugify,
} from "@/utils/lead-formatters";
import { cn } from "@/lib/utils";
import { leadFoldersAPI } from "@/api/lead-folders";

const BRAZILIAN_STATES = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];

function formatLeadBudget(lead: Lead) {
  const legacyBudget = (lead as Lead & { budget?: string | number }).budget;
  const raw = lead.metadata?.budget ?? legacyBudget ?? "";
  if (typeof raw === "number")
    return raw.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const value = Number(
    String(raw)
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", "."),
  );
  return Number.isFinite(value) && value > 0
    ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "Não informado";
}

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
  if (status === "perdido" || status === "arquivado")
    return "bg-red-100 text-red-800";
  if (status === "qualificado" || status === "reuniao" || status === "proposta")
    return "bg-blue-100 text-blue-800";
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

function formatBrazilianPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function leadToForm(lead: Lead) {
  return {
    companyName: lead.companyName || "",
    contactName: lead.contactName || "",
    email: lead.email || "",
    phone: formatBrazilianPhoneInput(lead.phone || ""),
    website: lead.website || "",
    city: lead.city || "",
    state: lead.state || "",
    category: lead.metadata?.sector || lead.category || "",
    assignedTo: lead.assignedTo || "",
    assignedUserId: lead.assignedUserId ? String(lead.assignedUserId) : "",
    address: lead.metadata?.address || "",
    linkedin: lead.metadata?.linkedin || "",
    revenue: lead.metadata?.revenue || "",
    employees: lead.metadata?.employees || "",
    budget: lead.metadata?.budget || "",
    notes: lead.metadata?.notes || "",
    nextMeetingAt: lead.metadata?.nextMeetingAt
      ? lead.metadata.nextMeetingAt.slice(0, 16)
      : "",
    meetingOwner: lead.metadata?.meetingOwner || "",
    labels: lead.metadata?.labels || [],
  };
}

function folderMatchesLead(
  folderId: string,
  lead: Lead,
  customFolders: LeadFolder[] = [],
) {
  if (folderId === "todos-os-leads") return true;
  if (folderId === "novos") return lead.status === "novo";
  if (folderId === "qualificados")
    return lead.status === "qualificado" || (lead.score || 0) >= 70;
  if (folderId === "sem-site") return !lead.website;
  if (folderId === "follow-up") return lead.status === "em_contato";
  if (folderId === "convertidos") return lead.status === "convertido";
  if (folderId === "arquivados") return lead.status === "arquivado";
  const custom = customFolders.find((folder) => folder.id === folderId);
  return Boolean(
    custom?.prospectIds?.includes(String(lead.id)) ||
    lead.folderId === folderId,
  );
}

function buildFolders(leads: Lead[], customFolders: LeadFolder[]) {
  const now = new Date().toISOString();
  const systemFolders: LeadFolder[] = [
    {
      id: "todos-os-leads",
      name: "Todos os Leads",
      icon: "folder",
      isSystem: true,
      createdAt: now,
    },
    {
      id: "novos",
      name: "Novos",
      icon: "circle",
      isSystem: true,
      createdAt: now,
    },
    {
      id: "qualificados",
      name: "Qualificados",
      icon: "check",
      isSystem: true,
      createdAt: now,
    },
    {
      id: "sem-site",
      name: "Sem Site",
      icon: "folder",
      isSystem: true,
      createdAt: now,
    },
    {
      id: "follow-up",
      name: "Follow-up",
      icon: "send",
      isSystem: true,
      createdAt: now,
    },
    {
      id: "convertidos",
      name: "Convertidos",
      icon: "check",
      isSystem: true,
      createdAt: now,
    },
    {
      id: "arquivados",
      name: "Arquivados",
      icon: "archive",
      isSystem: true,
      createdAt: now,
    },
  ];

  return [...systemFolders, ...customFolders].map((folder) => ({
    ...folder,
    leadCount: leads.filter((lead) =>
      folderMatchesLead(folder.id, lead, customFolders),
    ).length,
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

const emptyLeadForm = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  city: "",
  state: "",
  category: "",
  assignedTo: "",
  assignedUserId: "",
  address: "",
  linkedin: "",
  revenue: "",
  employees: "",
  budget: "",
  notes: "",
  nextMeetingAt: "",
  meetingOwner: "",
  labels: [] as LeadLabel[],
};

export default function LeadsPage() {
  const navigate = useNavigate();
  const { leads, loading, error, reload } = useLeads();
  const [sessionLeads, setSessionLeads] = useState<Lead[]>([]);
  const [filters, setFilters] = useState<LeadFilters>(initialFilters);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [folderTargetIds, setFolderTargetIds] = useState<string[]>([]);
  const [folderTarget, setFolderTarget] = useState("");
  const [folderMemberDialogOpen, setFolderMemberDialogOpen] = useState(false);
  const [customFolders, setCustomFolders] = useState<LeadFolder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDescription, setNewFolderDescription] = useState("");
  const [newFolderIcon, setNewFolderIcon] = useState("folder");
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadForm, setLeadForm] = useState(emptyLeadForm);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);

  useEffect(() => {
    void commercialEntitiesAPI
      .getUsers()
      .then(({ users }) => setUserOptions(users))
      .catch(() => setUserOptions([]));
    void leadFoldersAPI
      .list()
      .then(({ folders }) =>
        setCustomFolders(
          folders.map((folder) => ({
            id: String(folder.id),
            name: folder.name,
            description: folder.description || null,
            icon: folder.icon || "folder",
            isSystem: false,
            leadCount: folder.total,
            prospectIds: (folder.prospect_ids || []).map(String),
            createdAt: new Date().toISOString(),
          })),
        ),
      )
      .catch(() => setCustomFolders([]));
  }, []);

  const allLeads = useMemo(() => {
    const localIds = new Set(sessionLeads.map((lead) => lead.id));
    return [...sessionLeads, ...leads.filter((lead) => !localIds.has(lead.id))];
  }, [leads, sessionLeads]);
  const folders = useMemo(
    () => buildFolders(allLeads, customFolders),
    [allLeads, customFolders],
  );
  const selectedFolder =
    folders.find((folder) => folder.id === filters.folderId) || folders[0];
  const cities = useMemo(
    () =>
      Array.from(
        new Set(allLeads.map((lead) => lead.city).filter(Boolean)),
      ).sort() as string[],
    [allLeads],
  );
  const owners = useMemo(
    () =>
      Array.from(
        new Set(allLeads.map((lead) => lead.assignedTo).filter(Boolean)),
      ).sort() as string[],
    [allLeads],
  );
  const availableLabels = useMemo(
    () => allLeads.flatMap((lead) => lead.metadata?.labels || []),
    [allLeads],
  );

  useEffect(() => {
    if (!leadForm.state) {
      setCityOptions([]);
      return;
    }

    const controller = new AbortController();

    async function loadCities() {
      try {
        setCitiesLoading(true);
        const response = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${leadForm.state}/municipios?orderBy=nome`,
          { signal: controller.signal },
        );
        const data = await response.json();
        setCityOptions(
          Array.isArray(data)
            ? data.map((city) => city.nome).filter(Boolean)
            : [],
        );
      } catch (error) {
        if (!controller.signal.aborted) setCityOptions([]);
      } finally {
        if (!controller.signal.aborted) setCitiesLoading(false);
      }
    }

    void loadCities();

    return () => controller.abort();
  }, [leadForm.state]);

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return allLeads.filter((lead) => {
      const textMatches =
        !normalizedQuery ||
        [
          lead.companyName,
          lead.phone,
          lead.email,
          lead.city,
          lead.assignedTo,
        ].some((value) => value?.toLowerCase().includes(normalizedQuery));

      const fieldMatches =
        filters.contactField === "all" ||
        (filters.contactField === "has_whatsapp" &&
          Boolean(buildWhatsAppUrl(lead.phone))) ||
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
        folderMatchesLead(filters.folderId, lead, customFolders) &&
        textMatches &&
        fieldMatches &&
        scoreMatches &&
        (filters.status === "all" || lead.status === filters.status) &&
        (filters.source === "all" || lead.source === filters.source) &&
        (filters.city === "all" || lead.city === filters.city) &&
        (filters.assignedTo === "all" || lead.assignedTo === filters.assignedTo)
      );
    });
  }, [allLeads, customFolders, filters, query]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLeads.length / itemsPerPage),
  );
  const paginatedLeads = filteredLeads.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage,
  );
  const activeFilters = Object.entries(filters).filter(
    ([key, value]) => key !== "folderId" && value !== "all",
  ).length;
  const allPageSelected =
    paginatedLeads.length > 0 &&
    paginatedLeads.every((lead) => selectedIds.includes(lead.id));

  const updateFilter = (key: keyof LeadFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const toggleLead = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const togglePageSelection = () => {
    const pageIds = paginatedLeads.map((lead) => lead.id);
    setSelectedIds((current) =>
      allPageSelected
        ? current.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...current, ...pageIds])),
    );
  };

  const resetFilters = () => {
    setFilters({ ...initialFilters, folderId: filters.folderId });
    setQuery("");
    setPage(1);
  };

  const getLeadPath = (lead: Lead) => {
    const leadName = getLeadPersonName(lead);
    return `/comercial/leads/${slugify(`${lead.companyName || leadName}-${lead.id}`)}`;
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;

    try {
      const { folder } = await leadFoldersAPI.create({
        name,
        description: newFolderDescription.trim() || null,
        icon: newFolderIcon,
      });
      setCustomFolders((current) => [
        ...current,
        {
          id: String(folder.id),
          name: folder.name,
          description: folder.description || null,
          icon: folder.icon || "folder",
          isSystem: false,
          leadCount: folder.total,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      toast({
        title: "Não foi possível criar a pasta",
        description:
          error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
      return;
    }
    setNewFolderName("");
    setNewFolderDescription("");
    setNewFolderIcon("folder");
    setFolderDialogOpen(false);
  };

  const openFolderMemberDialog = (ids: string[]) => {
    setFolderTargetIds(ids);
    setFolderTarget("");
    setFolderMemberDialogOpen(true);
  };
  const handleAddToFolder = async () => {
    const folder = customFolders.find((item) => item.id === folderTarget);
    if (!folder) return;
    try {
      await leadFoldersAPI.addMembers(Number(folder.id), folderTargetIds);
      const { folders: refreshed } = await leadFoldersAPI.list();
      setCustomFolders(
        refreshed.map((item) => ({
          id: String(item.id),
          name: item.name,
          description: item.description || null,
          icon: item.icon || "folder",
          isSystem: false,
          leadCount: item.total,
          prospectIds: (item.prospect_ids || []).map(String),
          createdAt: new Date().toISOString(),
        })),
      );
      setFolderMemberDialogOpen(false);
      setSelectedIds([]);
      toast.success("Lead(s) adicionados à pasta.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível adicionar à pasta.",
      );
    }
  };

  const handleDeleteLead = async () => {
    if (!leadToDelete) return;
    try {
      await deleteLead(leadToDelete.id);
      setSessionLeads((current) =>
        current.filter((item) => item.id !== leadToDelete.id),
      );
      setSelectedIds((current) =>
        current.filter((id) => id !== leadToDelete.id),
      );
      await reload();
      toast.success("Lead excluído.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o lead.",
      );
    } finally {
      setLeadToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const result = await deleteLeads(selectedIds);
      setSessionLeads((current) =>
        current.filter((lead) => !selectedIds.includes(lead.id)),
      );
      setSelectedIds([]);
      await reload();
      setBulkDeleteOpen(false);
      toast.success(`${result.deleted} lead(s) excluído(s).`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir os leads selecionados.",
      );
    }
  };

  const handleBulkAction = async (action: "status" | "assignee" | "archive") => {
    if (!selectedIds.length) return;
    const value = action === "status" ? window.prompt("Informe o status: novo, em_contato, qualificado, reuniao, proposta, convertido ou perdido") : action === "assignee" ? window.prompt(`Informe o ID do responsavel (${userOptions.map((user) => `${user.id}: ${user.name}`).join(", ")}) ou deixe vazio para remover`) : undefined;
    if (action !== "archive" && value === null) return;
    try {
      const result = await applyBulkLeadAction(selectedIds, action, action === "assignee" && value === "" ? null : value);
      setSelectedIds([]); await reload();
      toast.success(`${result.processed} lead(s) processado(s).`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível processar os leads selecionados."); }
  };

  const exportSelectedLeads = () => {
    const selected = allLeads.filter((lead) => selectedIds.includes(lead.id));
    const csvValue = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""').replace(/\r?\n/g, " ")}"`;
    const rows = [["Nome", "Telefone", "E-mail", "Empresa", "Status", "Responsável", "Origem", "Criado em"], ...selected.map((lead) => [getLeadPersonName(lead), lead.phone, lead.email, lead.companyName, statusLabels[lead.status], lead.assignedTo, lead.source, lead.createdAt].map(csvValue))];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "leads-selecionados.csv"; anchor.click(); URL.revokeObjectURL(url);
    toast.success(`${selected.length} lead(s) exportado(s).`);
  };

  const handleDeleteFolder = async (folder: LeadFolder) => {
    if (!window.confirm(`Excluir a lista '${folder.name}'? Isso remove apenas a lista e seus vínculos, não os leads.`)) return;
    try { await leadFoldersAPI.remove(Number(folder.id)); setCustomFolders((current) => current.filter((item) => item.id !== folder.id)); if (filters.folderId === folder.id) setFilters((current) => ({ ...current, folderId: "todos-os-leads" })); toast.success("Lista excluída."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir a lista."); }
  };

  const currentManualFolder = customFolders.find((folder) => folder.id === filters.folderId);
  const refreshFolderState = async () => {
    const { folders: refreshed } = await leadFoldersAPI.list();
    setCustomFolders(refreshed.map((item) => ({ id: String(item.id), name: item.name, description: item.description || null, icon: item.icon || "folder", isSystem: false, leadCount: item.total, prospectIds: (item.prospect_ids || []).map(String), createdAt: new Date().toISOString() })));
    setSelectedIds([]);
    await reload();
  };
  const removeLeadsFromCurrentFolder = async (ids: string[]) => {
    if (!currentManualFolder || !ids.length) return;
    const label = ids.length === 1 ? `Remover 1 lead da lista '${currentManualFolder.name}'?` : `Remover ${ids.length} leads da lista '${currentManualFolder.name}'?`;
    if (!window.confirm(`${label}\n\nOs leads continuarão no CRM e em outras listas.`)) return;
    try {
      const result = await leadFoldersAPI.removeMembers(Number(currentManualFolder.id), ids);
      await refreshFolderState();
      toast.success(`${result.removed} lead(s) removido(s) da lista.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível remover os leads da lista."); }
  };

  const handleLeadFormChange = (
    key: keyof typeof emptyLeadForm,
    value: string,
  ) => {
    setLeadForm((current) => {
      if (key === "phone")
        return { ...current, phone: formatBrazilianPhoneInput(value) };
      if (key === "state") return { ...current, state: value, city: "" };
      if (key === "budget" || key === "revenue")
        return { ...current, [key]: formatBRLInput(value) };
      if (key === "employees")
        return { ...current, employees: value.replace(/\D/g, "") };
      return { ...current, [key]: value };
    });
  };

  const openCreateLeadDialog = () => {
    setEditingLeadId(null);
    setLeadForm({ ...emptyLeadForm, labels: [] });
    setLeadDialogOpen(true);
  };

  const openEditLeadDialog = (lead: Lead) => {
    setEditingLeadId(lead.id);
    setLeadForm(leadToForm(lead));
    setLeadDialogOpen(true);
  };

  const upsertLocalLead = (lead: Lead) => {
    setSessionLeads((current) => [
      lead,
      ...current.filter((item) => item.id !== lead.id),
    ]);
  };

  const handleSaveLead = async () => {
    const companyName = leadForm.companyName.trim();
    if (!companyName) return;

    const now = new Date().toISOString();
    const currentLead = editingLeadId
      ? allLeads.find((lead) => lead.id === editingLeadId)
      : null;
    const savedLead: Lead = {
      id: currentLead?.id || `local-${Date.now()}`,
      companyName,
      contactName: leadForm.contactName.trim() || null,
      email: leadForm.email.trim() || null,
      phone: leadForm.phone.trim() || null,
      website: leadForm.website.trim() || null,
      city: leadForm.city.trim() || null,
      state: leadForm.state.trim() || null,
      category: leadForm.category.trim() || null,
      assignedTo: leadForm.assignedTo.trim() || null,
      assignedUserId: leadForm.assignedUserId
        ? Number(leadForm.assignedUserId)
        : null,
      source: "manual",
      status: currentLead?.status || "novo",
      score: currentLead?.score || 0,
      folderId: currentLead?.folderId || "todos-os-leads",
      folderName: currentLead?.folderName || "Todos os Leads",
      lastContactAt: currentLead?.lastContactAt || null,
      createdAt: currentLead?.createdAt || now,
      updatedAt: now,
      metadata: {
        ...currentLead?.metadata,
        labels: leadForm.labels,
        address: leadForm.address.trim() || null,
        linkedin: leadForm.linkedin.trim() || null,
        sector: leadForm.category.trim() || null,
        revenue: leadForm.revenue.trim() || null,
        employees: leadForm.employees.trim() || null,
        budget: leadForm.budget.trim() || null,
        notes: leadForm.notes.trim() || null,
        nextMeetingAt: leadForm.nextMeetingAt
          ? new Date(leadForm.nextMeetingAt).toISOString()
          : null,
        meetingOwner: leadForm.meetingOwner.trim() || null,
      },
    };

    try {
      setSavingLead(true);
      if (editingLeadId) {
        const persisted = await updateLead(editingLeadId, savedLead);
        upsertLocalLead(persisted);
      } else {
        const persisted = await createLead(savedLead);
        upsertLocalLead(persisted);
      }
      await reload();
      setFilters((current) => ({ ...current, folderId: "todos-os-leads" }));
      setPage(1);
      setLeadForm({ ...emptyLeadForm, labels: [] });
      setEditingLeadId(null);
      setLeadDialogOpen(false);
    } finally {
      setSavingLead(false);
    }
  };

  const addLeadToKanban = async (lead: Lead) => {
    const now = new Date().toISOString();
    const pipelineLead = await persistLeadToPipeline(lead.id);
    const normalizedPipelineLead: Lead = {
      ...pipelineLead,
      status:
        pipelineLead.status === "novo" ||
        pipelineLead.status === "nao_contatado"
          ? "qualificado"
          : pipelineLead.status,
      folderId: "pipeline",
      folderName: "Pipeline",
      updatedAt: pipelineLead.updatedAt || now,
    };
    upsertLocalLead(normalizedPipelineLead);
    await reload();
    navigate("/comercial/pipeline");
  };

  const addSelectedToKanban = async () => {
    const leadsToSend = selectedIds
      .map((id) => allLeads.find((lead) => lead.id === id))
      .filter((lead): lead is Lead => Boolean(lead));

    for (const lead of leadsToSend) {
      const persisted = await persistLeadToPipeline(lead.id);
      const pipelineLead = {
        ...persisted,
        status:
          persisted.status === "novo" || persisted.status === "nao_contatado"
            ? ("qualificado" as LeadStatus)
            : persisted.status,
        folderId: "pipeline",
        folderName: "Pipeline",
        updatedAt: new Date().toISOString(),
      };
      upsertLocalLead(pipelineLead);
    }
    await reload();
    setSelectedIds([]);
    navigate("/comercial/pipeline");
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="space-y-3 border-b border-border/70 px-4 py-4 md:px-6">
        <AppBreadcrumbs />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Leads</h1>
            <p className="text-sm text-muted-foreground">
              Organize pessoas, empresas e contatos comerciais.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 pl-9"
                placeholder="Buscar leads, empresas, e-mails..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Button variant="outline">Importar</Button>
            <Button onClick={openCreateLeadDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Lead
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar leads</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid min-h-[calc(100vh-9rem)] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-r border-border/80 bg-card/60">
          <div className="border-b border-border/70 px-4 py-3">
            <h2 className="text-sm font-semibold">Contatos</h2>
            <p className="text-xs text-muted-foreground">
              {allLeads.length} registros no CRM
            </p>
          </div>
          <div className="space-y-1 p-3">
            {folders.map((folder) => {
              const Icon = getFolderIcon(folder);
              const active = filters.folderId === folder.id;
              return (
                <div key={folder.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateFilter("folderId", folder.id)}
                  className={cn(
                    "flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted",
                    active && "bg-primary/10 font-medium text-primary",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {folder.leadCount || 0}
                  </span>
                </button>
                {!folder.isSystem ? <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Excluir lista" onClick={() => void handleDeleteFolder(folder)}><Trash2 className="h-4 w-4" /></Button> : null}
                </div>
              );
            })}

            <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="mt-3 w-full justify-start">
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Nova pasta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova pasta de leads</DialogTitle>
                  <DialogDescription>
                    Crie a estrutura visual da pasta. A persistência será
                    conectada ao backend MySQL quando esta rotina estiver
                    preparada.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="folder-name">Nome da pasta</Label>
                    <Input
                      id="folder-name"
                      value={newFolderName}
                      onChange={(event) => setNewFolderName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="folder-description">
                      Descrição opcional
                    </Label>
                    <Input
                      id="folder-description"
                      value={newFolderDescription}
                      onChange={(event) =>
                        setNewFolderDescription(event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ícone</Label>
                    <Select
                      value={newFolderIcon}
                      onValueChange={setNewFolderIcon}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                  <Button
                    variant="outline"
                    onClick={() => setFolderDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                  >
                    Criar pasta
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="space-y-4 border-b border-border/70 p-4 md:p-5">
            <div className="flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/10 p-4 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Encontre os contatos certos mais rápido
                </p>
                <p className="text-xs text-muted-foreground">
                  Use status, origem, cidade e score para priorizar os leads com
                  maior chance de avanço.
                </p>
              </div>
              <Button variant="secondary" size="sm" className="w-fit">
                <Filter className="mr-2 h-4 w-4" />
                Aplicar filtro
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {selectedFolder?.name || "Todos os Leads"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {filteredLeads.length} lead(s) encontrados
                </p>
              </div>
              {activeFilters > 0 ? (
                <Badge variant="secondary">
                  {activeFilters} filtro(s) ativo(s)
                </Badge>
              ) : null}
            </div>

            <div className="grid gap-2 md:grid-cols-[repeat(4,minmax(130px,1fr))_auto]">
              <Select
                value={filters.status}
                onValueChange={(value) => updateFilter("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.source}
                onValueChange={(value) => updateFilter("source", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas origens</SelectItem>
                  {Object.entries(sourceLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.city}
                onValueChange={(value) => updateFilter("city", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Cidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas cidades</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.scoreRange}
                onValueChange={(value) => updateFilter("scoreRange", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Score" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos scores</SelectItem>
                  <SelectItem value="low">0 a 39</SelectItem>
                  <SelectItem value="medium">40 a 69</SelectItem>
                  <SelectItem value="high">70 a 100</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={resetFilters}>
                <X className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <Select
                value={filters.contactField}
                onValueChange={(value) => updateFilter("contactField", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Contato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos contatos</SelectItem>
                  <SelectItem value="has_whatsapp">Possui WhatsApp</SelectItem>
                  <SelectItem value="has_email">Possui e-mail</SelectItem>
                  <SelectItem value="has_website">Possui website</SelectItem>
                  <SelectItem value="without_website">Sem website</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.assignedTo}
                onValueChange={(value) => updateFilter("assignedTo", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos responsáveis</SelectItem>
                  {owners.map((owner) => (
                    <SelectItem key={owner} value={owner}>
                      {owner}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" className="justify-start">
                <Filter className="mr-2 h-4 w-4" />
                Filtros avançados
              </Button>
            </div>
          </div>

          <div className="p-4 md:p-5">
            {selectedIds.length > 0 ? (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-3">
                <span className="text-sm font-medium">
                  {selectedIds.length} selecionado(s)
                </span>
                {[
                  "Mover para pasta",
                  "Alterar status",
                  "Atribuir responsável",
                  "Exportar",
                  "Arquivar",
                ].map((action) => (
                  <Button key={action} variant="outline" size="sm" onClick={() => { if (action === "Mover para pasta") openFolderMemberDialog(selectedIds); else if (action === "Alterar status") void handleBulkAction("status"); else if (action === "Atribuir responsÃ¡vel") void handleBulkAction("assignee"); else if (action === "Exportar") exportSelectedLeads(); else if (action === "Arquivar") void handleBulkAction("archive"); }}>
                    {action}
                  </Button>
                ))}
                {currentManualFolder ? <Button variant="outline" size="sm" onClick={() => void removeLeadsFromCurrentFolder(selectedIds)}>Remover da lista</Button> : null}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  Excluir selecionados
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addSelectedToKanban}
                >
                  Adicionar ao Kanban
                </Button>
              </div>
            ) : null}

            {loading ? (
              <LeadTableSkeleton />
            ) : allLeads.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center">
                <h3 className="font-semibold">
                  Nenhum lead encontrado na base atual
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Quando a tabela de prospecção receber contatos do n8n ou das
                  buscas, eles aparecerão aqui.
                </p>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center">
                <h3 className="font-semibold">
                  Nenhum resultado para os filtros atuais
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajuste a busca ou limpe os filtros para visualizar mais leads.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={resetFilters}
                >
                  Limpar filtros
                </Button>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto rounded-md border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allPageSelected}
                            onCheckedChange={togglePageSelection}
                          />
                        </TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Organização</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Orçamento</TableHead>
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
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.includes(lead.id)}
                                onCheckedChange={() => toggleLead(lead.id)}
                              />
                            </TableCell>
                            <TableCell className="min-w-[240px]">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border border-border/70 bg-muted">
                                  <AvatarFallback>
                                    {leadName.slice(0, 1).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    className="truncate text-left font-medium hover:text-primary hover:underline"
                                    onClick={() => navigate(getLeadPath(lead))}
                                  >
                                    {leadName}
                                  </button>
                                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                    <UserRound className="h-3 w-3" />
                                    {lead.category || "Sem categoria"}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[210px]">
                              <div className="min-w-0">
                                <p className="flex items-center gap-1 truncate font-medium">
                                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  {organization}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {websiteUrl ? (
                                    <a
                                      className="inline-flex items-center gap-1 hover:text-primary"
                                      href={websiteUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {getWebsiteDomain(websiteUrl)}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : (
                                    "Sem site"
                                  )}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[220px]">
                              {email ? (
                                <a
                                  className="inline-flex items-center gap-1 text-primary hover:underline"
                                  href={`mailto:${email}`}
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                  {email}
                                </a>
                              ) : (
                                "Sem e-mail"
                              )}
                            </TableCell>
                            <TableCell className="min-w-[170px]">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                  {formatPhone(lead.phone)}
                                </span>
                                {whatsappUrl ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    asChild
                                  >
                                    <a
                                      href={whatsappUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <Send className="h-4 w-4" />
                                    </a>
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              {[lead.city, lead.state]
                                .filter(Boolean)
                                .join(" / ") || "Não informada"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-medium text-primary">
                              {formatLeadBudget(lead)}
                            </TableCell>
                            <TableCell>{sourceLabels[lead.source]}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusClass(lead.status)}>
                                  {statusLabels[lead.status]}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={getScoreClass(lead.score)}
                                >
                                  {lead.score || 0}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              {lead.assignedTo || "Sem responsável"}
                            </TableCell>
                            <TableCell>
                              {formatDate(lead.lastContactAt)}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => navigate(getLeadPath(lead))}
                                  >
                                    Ver lead
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => openEditLeadDialog(lead)}
                                  >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Editar
                                  </DropdownMenuItem>
                                  {whatsappUrl ? (
                                    <DropdownMenuItem asChild>
                                      <a
                                        href={whatsappUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        Abrir WhatsApp
                                      </a>
                                    </DropdownMenuItem>
                                  ) : null}
                                  {email ? (
                                    <DropdownMenuItem asChild>
                                      <a href={`mailto:${email}`}>
                                        Enviar e-mail
                                      </a>
                                    </DropdownMenuItem>
                                  ) : null}
                                  <DropdownMenuItem
                                    onClick={() =>
                                      openFolderMemberDialog([lead.id])
                                    }
                                  >
                                    Mover para pasta
                                  </DropdownMenuItem>
                                  {currentManualFolder ? <DropdownMenuItem onClick={() => void removeLeadsFromCurrentFolder([lead.id])}>Remover da lista</DropdownMenuItem> : null}
                                  <DropdownMenuItem>
                                    Alterar status
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => addLeadToKanban(lead)}
                                  >
                                    Adicionar ao Kanban
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    Criar tarefa
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>Arquivar</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setLeadToDelete(lead)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                  </DropdownMenuItem>
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
                        <Checkbox
                          checked={selectedIds.includes(lead.id)}
                          onCheckedChange={() => toggleLead(lead.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{lead.companyName}</p>
                          <p className="text-sm text-muted-foreground">
                            {[lead.city, lead.state]
                              .filter(Boolean)
                              .join(" / ") || "Não informada"}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge
                              variant="outline"
                              className={getScoreClass(lead.score)}
                            >
                              {lead.score || 0}
                            </Badge>
                            <Badge className={getStatusClass(lead.status)}>
                              {statusLabels[lead.status]}
                            </Badge>
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
          </div>
        </section>
      </div>

      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingLeadId ? "Editar lead" : "Novo lead"}
            </DialogTitle>
            <DialogDescription>
              {editingLeadId
                ? "Atualize as informações principais do contato comercial."
                : "Cadastre as informações principais do contato comercial."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[68vh] gap-4 overflow-y-auto pr-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lead-company">Organização *</Label>
              <Input
                id="lead-company"
                value={leadForm.companyName}
                onChange={(event) =>
                  handleLeadFormChange("companyName", event.target.value)
                }
                placeholder="Nome da empresa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-contact">Nome do contato</Label>
              <Input
                id="lead-contact"
                value={leadForm.contactName}
                onChange={(event) =>
                  handleLeadFormChange("contactName", event.target.value)
                }
                placeholder="Pessoa responsável"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-category">Setor</Label>
              <Select
                value={leadForm.category || undefined}
                onValueChange={(value) =>
                  handleLeadFormChange("category", value)
                }
              >
                <SelectTrigger id="lead-category">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SECTORS.map((sector) => (
                    <SelectItem key={sector} value={sector}>
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-email">E-mail</Label>
              <Input
                id="lead-email"
                value={leadForm.email}
                onChange={(event) =>
                  handleLeadFormChange("email", event.target.value)
                }
                placeholder="contato@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-phone">Telefone</Label>
              <Input
                id="lead-phone"
                value={leadForm.phone}
                onChange={(event) =>
                  handleLeadFormChange("phone", event.target.value)
                }
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-website">Site</Label>
              <Input
                id="lead-website"
                value={leadForm.website}
                onChange={(event) =>
                  handleLeadFormChange("website", event.target.value)
                }
                placeholder="empresa.com.br"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-linkedin">LinkedIn</Label>
              <Input
                id="lead-linkedin"
                value={leadForm.linkedin}
                onChange={(event) =>
                  handleLeadFormChange("linkedin", event.target.value)
                }
                placeholder="linkedin.com/company/empresa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-budget">Valor do orçamento</Label>
              <Input
                id="lead-budget"
                value={leadForm.budget}
                onChange={(event) =>
                  handleLeadFormChange("budget", event.target.value)
                }
                placeholder="R$ 0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-revenue">Receita estimada</Label>
              <Input
                id="lead-revenue"
                value={leadForm.revenue}
                onChange={(event) =>
                  handleLeadFormChange("revenue", event.target.value)
                }
                placeholder="R$ 0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-employees">Número de funcionários</Label>
              <Input
                id="lead-employees"
                value={leadForm.employees}
                onChange={(event) =>
                  handleLeadFormChange("employees", event.target.value)
                }
                placeholder="Ex.: 25"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_88px]">
              <div className="space-y-2">
                <Label htmlFor="lead-city">Cidade</Label>
                <Select
                  value={leadForm.city || undefined}
                  onValueChange={(value) => handleLeadFormChange("city", value)}
                  disabled={!leadForm.state || citiesLoading}
                >
                  <SelectTrigger id="lead-city">
                    <SelectValue
                      placeholder={
                        leadForm.state
                          ? citiesLoading
                            ? "Carregando..."
                            : "Selecione"
                          : "Escolha a UF"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {cityOptions.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-state">UF</Label>
                <Select
                  value={leadForm.state || undefined}
                  onValueChange={(value) =>
                    handleLeadFormChange("state", value)
                  }
                >
                  <SelectTrigger id="lead-state">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map((state) => (
                      <SelectItem key={state.uf} value={state.uf}>
                        {state.uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lead-address">Endereço</Label>
              <Input
                id="lead-address"
                value={leadForm.address}
                onChange={(event) =>
                  handleLeadFormChange("address", event.target.value)
                }
                placeholder="Rua, número, bairro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-meeting-date">Próxima reunião</Label>
              <Input
                id="lead-meeting-date"
                type="datetime-local"
                value={leadForm.nextMeetingAt}
                onChange={(event) =>
                  handleLeadFormChange("nextMeetingAt", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-meeting-owner">
                Responsável pela reunião
              </Label>
              <Input
                id="lead-meeting-owner"
                value={leadForm.meetingOwner}
                onChange={(event) =>
                  handleLeadFormChange("meetingOwner", event.target.value)
                }
                placeholder="Nome do responsável"
              />
            </div>
            <div className="space-y-3 sm:col-span-2">
              <Label>Etiquetas</Label>
              <LeadLabelPicker
                labels={leadForm.labels}
                availableLabels={availableLabels}
                onChange={(labels) =>
                  setLeadForm((current) => ({ ...current, labels }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lead-notes">Anotações</Label>
              <Input
                id="lead-notes"
                value={leadForm.notes}
                onChange={(event) =>
                  handleLeadFormChange("notes", event.target.value)
                }
                placeholder="Contexto inicial, dores e próximos passos"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lead-owner">Responsável</Label>
              <Select
                value={leadForm.assignedUserId || "unassigned"}
                onValueChange={(value) => {
                  if (value === "unassigned") {
                    setLeadForm((current) => ({
                      ...current,
                      assignedUserId: "",
                      assignedTo: "",
                    }));
                    return;
                  }
                  const selected = userOptions.find(
                    (user) => String(user.id) === value,
                  );
                  setLeadForm((current) => ({
                    ...current,
                    assignedUserId: value,
                    assignedTo: selected?.name || "",
                  }));
                }}
              >
                <SelectTrigger id="lead-owner">
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Sem responsável</SelectItem>
                  {userOptions.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeadDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveLead}
              disabled={!leadForm.companyName.trim() || savingLead}
            >
              <Plus className="mr-2 h-4 w-4" />
              {savingLead
                ? "Salvando..."
                : editingLeadId
                  ? "Salvar lead"
                  : "Adicionar lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={folderMemberDialogOpen}
        onOpenChange={setFolderMemberDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar lead à pasta</DialogTitle>
            <DialogDescription>
              Escolha uma pasta manual para salvar a associação.
            </DialogDescription>
          </DialogHeader>
          <Select value={folderTarget} onValueChange={setFolderTarget}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma pasta" />
            </SelectTrigger>
            <SelectContent>
              {customFolders.map((folder) => (
                <SelectItem value={folder.id} key={folder.id}>
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFolderMemberDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={!folderTarget}
              onClick={() => void handleAddToFolder()}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {selectedIds.length} leads?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá os leads selecionados e não poderá ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleBulkDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(leadToDelete)}
        onOpenChange={(open) => !open && setLeadToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação exigirá integração de exclusão com o backend antes de
              remover dados reais. O lead selecionado foi marcado apenas para
              confirmação visual nesta etapa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteLead()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
