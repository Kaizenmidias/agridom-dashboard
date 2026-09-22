import { NavLink, useLocation } from "react-router-dom";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { navigationItems, isNavigationItemActive } from "@/config/navigation";
import type { NavigationItem } from "@/types/navigation";
import type { AuthUser } from "@/types/database";

type SidebarNavigationProps = {
  user: AuthUser | null;
  isCollapsed: boolean;
};

function canShowItem(item: NavigationItem, user: AuthUser | null) {
  if (!user) return false;

  if (user.email === "ricardorpc11@gmail.com" && item.restrictedForRicardo) {
    return false;
  }

  return true;
}

function filterNavigation(items: NavigationItem[], user: AuthUser | null): NavigationItem[] {
  return items
    .map((item) => {
      const children = item.children ? filterNavigation(item.children, user) : undefined;
      const visible = canShowItem(item, user);

      if (!visible && !children?.length) {
        return null;
      }

      return { ...item, children };
    })
    .filter((item): item is NavigationItem => Boolean(item));
}

export function SidebarNavigation({ user, isCollapsed }: SidebarNavigationProps) {
  const location = useLocation();
  const items = filterNavigation(navigationItems, user);

  return (
    <SidebarMenu className="gap-3">
      {items.map((item) => {
        if (item.children?.length) {
          return (
            <SidebarMenuItem key={item.label}>
              {!isCollapsed ? (
                <p className="mb-1 px-2 text-[11px] font-semibold text-sidebar-foreground/55">{item.label}</p>
              ) : null}
              <SidebarMenuSub className="mx-0 border-l-0 px-0 py-0">
                {item.children.map((child) => (
                  <SidebarMenuSubItem key={child.path || child.label}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={isNavigationItemActive(child, location.pathname)}
                      className="h-8 rounded-md px-2 text-[12px] font-medium"
                    >
                      <NavLink to={child.path || "#"}>
                        <child.icon />
                        <span>{child.label}</span>
                      </NavLink>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </SidebarMenuItem>
          );
        }

        return (
          <SidebarMenuItem key={item.path || item.label}>
            <SidebarMenuButton
              asChild
              tooltip={item.label}
              isActive={isNavigationItemActive(item, location.pathname)}
              className="h-9 rounded-md text-[12px] font-semibold"
            >
              <NavLink to={item.path || "#"} end={item.path === "/dashboard" || item.path === "/"}>
                <item.icon />
                <span>{item.label}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
