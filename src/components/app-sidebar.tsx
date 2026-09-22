import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarNavigation } from "@/components/layout/sidebar/SidebarNavigation";
import { SidebarUser } from "@/components/layout/sidebar/SidebarUser";

export function AppSidebar() {
  const { state } = useSidebar();
  const { user } = useAuth();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/80">
      <SidebarContent className="bg-sidebar">
        <div className="flex h-16 items-center border-b border-sidebar-border/70 px-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5">
            <img src="/logo.svg" alt="Kaizen Midias" className="h-7 w-7" />
          </div>
          {!isCollapsed ? (
            <div className="ml-3 leading-none">
              <p className="text-sm font-extrabold uppercase tracking-wide text-sidebar-foreground">Kaizen</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sidebar-foreground/55">Mídias</p>
            </div>
          ) : null}
        </div>

        <div className="flex-1 px-2 py-3">
          <SidebarNavigation user={user} isCollapsed={isCollapsed} />
        </div>

        <SidebarUser user={user} isCollapsed={isCollapsed} />
      </SidebarContent>
    </Sidebar>
  );
}
