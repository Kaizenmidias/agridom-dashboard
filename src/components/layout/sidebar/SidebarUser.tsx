import { Button } from "@/components/ui/button";
import { UserProfileDialog } from "@/components/user-profile-dialog";
import type { AuthUser } from "@/types/database";

type SidebarUserProps = {
  user: AuthUser | null;
  isCollapsed: boolean;
};

function getInitials(name?: string) {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function SidebarUser({ user, isCollapsed }: SidebarUserProps) {
  const displayName = userá.full_name || userá.name || "Usuário";

  return (
    <div className="mt-auto space-y-2 overflow-hidden border-t border-sidebar-border/70 p-3">
      <UserProfileDialog>
        <Button variant="ghost" className="h-auto w-full justify-start overflow-hidden rounded-md p-2 hover:bg-white/5">
          <div className="flex w-full items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_18px_rgba(183,255,60,0.18)]">
              <span className="text-sm font-bold">{getInitials(displayName)}</span>
            </div>
            {!isCollapsed ? (
              <div className="min-w-0 flex-1 overflow-hidden text-left">
                <p className="truncate whitespace-nowrap text-xs font-semibold text-sidebar-foreground">{displayName}</p>
                <p className="truncate whitespace-nowrap text-[10px] text-sidebar-foreground/55">{userá.role || "Administrador"}</p>
              </div>
            ) : null}
          </div>
        </Button>
      </UserProfileDialog>
    </div>
  );
}
