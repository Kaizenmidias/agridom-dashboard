import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarNavigation } from "@/components/layout/sidebar/SidebarNavigation";
import { SidebarUser } from "@/components/layout/sidebar/SidebarUser";

export function AppSidebar() {
  const { state } = useSidebar();
  const { user } = useAuth();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center border-b border-border p-4">
          <div className="flex h-8 w-8 items-center justify-center">
            <img src="/logo.svg" alt="Logo" className="h-8 w-8 rounded-full" />
          </div>
          {!isCollapsed ? <span className="ml-3 text-lg font-bold text-foreground">Kaizen</span> : null}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarNavigation user={user} isCollapsed={isCollapsed} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarUser user={user} isCollapsed={isCollapsed} />
      </SidebarContent>
    </Sidebar>
  );
}

