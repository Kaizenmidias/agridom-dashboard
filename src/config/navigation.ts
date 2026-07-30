import {
  Bot,
  Braces,
  BrainCircuit,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  ChartSpline,
  CircleDollarSign,
  ClipboardList,
  Code2,
  Columns3,
  FileText,
  FolderKanban,
  Headphones,
  History,
  KeyRound,
  LayoutDashboard,
  MessageSquareText,
  Package,
  Plug,
  ReceiptText,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  TrendingUp,
  UserCog,
  Users,
  WalletCards,
  Workflow,
} from "lucide-react";
import type { NavigationItem } from "@/types/navigation";

export const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
    legacyPaths: ["/"],
    requiredPermissions: ["can_access_dashboard"],
    restrictedForRicardo: true,
  },
  {
    label: "Comercial",
    icon: TrendingUp,
    children: [
      { label: "Leads", icon: Users, path: "/comercial/leads", requiredPermissions: ["can_access_crm"] },
      { label: "Kanban", icon: Columns3, path: "/comercial/kanban", requiredPermissions: ["can_access_crm"] },
      { label: "Produtos", icon: Package, path: "/comercial/produtos", requiredPermissions: ["can_access_crm"] },
      { label: "Histórico", icon: History, path: "/comercial/historico", requiredPermissions: ["can_access_crm"] },
      { label: "Prospecção", icon: Search, path: "/comercial/prospeccao", legacyPaths: ["/prospeccao"], requiredPermissions: ["can_access_crm"] },
      { label: "Métricas", icon: ChartNoAxesCombined, path: "/comercial/metricas", requiredPermissions: ["can_access_crm"] },
      { label: "Disparar", icon: Send, path: "/comercial/disparar", requiredPermissions: ["can_access_crm"] },
      { label: "SDR", icon: Headphones, path: "/comercial/sdr", requiredPermissions: ["can_access_crm"] },
      { label: "Automações", icon: Workflow, path: "/comercial/automacoes", requiredPermissions: ["can_access_crm"] },
    ],
  },
  {
    label: "Operacional",
    icon: BriefcaseBusiness,
    children: [
      { label: "Briefings", icon: ClipboardList, path: "/briefings", legacyPaths: ["/operacional/briefings"], requiredPermissions: ["can_access_briefings"] },
      { label: "Códigos", icon: Code2, path: "/codigos", legacyPaths: ["/operacional/codigos"], requiredPermissions: ["can_access_codes"] },
      { label: "Acessos", icon: KeyRound, path: "/acessos", legacyPaths: ["/operacional/acessos"] },
    ],
  },
  {
    label: "Inteligência Artificial",
    icon: Bot,
    children: [
      { label: "Assistentes", icon: MessageSquareText, path: "/ia/assistentes" },
      { label: "Conteúdos", icon: FileText, path: "/ia/conteudos" },
      { label: "Prompts", icon: Braces, path: "/ia/prompts" },
      { label: "Agentes", icon: BrainCircuit, path: "/ia/agentes" },
    ],
  },
  {
    label: "Financeiro",
    icon: WalletCards,
    children: [
      { label: "Projetos", icon: FolderKanban, path: "/projetos", legacyPaths: ["/financeiro/projetos"], requiredPermissions: ["can_access_projects"], restrictedForRicardo: true },
      { label: "Receitas", icon: CircleDollarSign, path: "/financeiro/receitas", restrictedForRicardo: true },
      { label: "Despesas", icon: ReceiptText, path: "/despesas", legacyPaths: ["/financeiro/despesas"], requiredPermissions: ["can_access_expenses"], restrictedForRicardo: true },
      { label: "Fluxo de Caixa", icon: ChartSpline, path: "/financeiro/fluxo-de-caixa", restrictedForRicardo: true },
    ],
  },
  {
    label: "Administração",
    icon: Settings,
    children: [
      { label: "Usuários", icon: UserCog, path: "/usuarios", legacyPaths: ["/administracao/usuarios"], requiredPermissions: ["can_access_users"], restrictedForRicardo: true },
      { label: "Integrações", icon: Plug, path: "/administracao/integracoes", restrictedForRicardo: true },
      { label: "Configurações", icon: SlidersHorizontal, path: "/administracao/configuracoes", restrictedForRicardo: true },
  ],
  },
];

export function flattenNavigation(items: NavigationItem[] = navigationItems): NavigationItem[] {
  return items.flatMap((item) => [item, ...(item.children ? flattenNavigation(item.children) : [])]);
}

export function findNavigationPath(pathname: string, items: NavigationItem[] = navigationItems): NavigationItem[] {
  for (const item of items) {
    const paths = [item.path, ...(item.legacyPaths || [])].filter(Boolean);
    if (paths.includes(pathname)) {
      return [item];
    }

    if (item.children) {
      const childPath = findNavigationPath(pathname, item.children);
      if (childPath.length) {
        return [item, ...childPath];
      }
    }
  }

  return [];
}

export function isNavigationItemActive(item: NavigationItem, pathname: string) {
  const paths = [item.path, ...(item.legacyPaths || [])].filter(Boolean);
  return paths.some((path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)));
}
