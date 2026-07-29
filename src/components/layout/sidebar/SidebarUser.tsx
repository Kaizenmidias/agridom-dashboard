import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
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
  const displayName = user?.full_name || user?.name || "Usuario";

  return (
    <div className="mt-auto space-y-3 overflow-hidden border-t border-border p-4">
      <div className="flex justify-center">
        <ThemeToggle />
      </div>

      <UserProfileDialog>
        <Button variant="ghost" className="w-full justify-start overflow-hidden p-2">
          <div className="flex w-full items-center gap-3 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <span className="text-sm font-medium text-primary">{getInitials(displayName)}</span>
            </div>
            {!isCollapsed ? (
              <div className="min-w-0 flex-1 overflow-hidden text-left">
                <p className="truncate whitespace-nowrap text-sm font-medium">{displayName}</p>
                <p className="truncate whitespace-nowrap text-xs text-muted-foreground">{user?.email || "email@exemplo.com"}</p>
              </div>
            ) : null}
          </div>
        </Button>
      </UserProfileDialog>
    </div>
  );
}
