import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { cn } from "@/lib/utils";

const STORAGE_KEY = "kaizen-sidebar-open-groups";

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

function readOpenGroups() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function SidebarNavigation({ user, isCollapsed }: SidebarNavigationProps) {
  const location = useLocation();
  const items = useMemo(() => filterNavigation(navigationItems, user), [user]);
  const [openGroups, setOpenGroups] = useState<string[]>(() => readOpenGroups());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  const toggleGroup = (label: string) => {
    setOpenGroups((current) => (
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
    ));
  };

  return (
    <SidebarMenu>
      {items.map((item) => {
        if (item.children?.length) {
          const isActiveGroup = item.children.some((child) => isNavigationItemActive(child, location.pathname));
          const isOpen = openGroups.includes(item.label) && !isCollapsed;

          return (
            <SidebarMenuItem key={item.label}>
              <Collapsible open={isOpen} onOpenChange={() => toggleGroup(item.label)}>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.label} isActive={isActiveGroup} className="h-9" aria-expanded={isOpen}>
                    <item.icon />
                    <span>{item.label}</span>
                    <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <SidebarMenuSub>
                    {item.children.map((child) => (
                      <SidebarMenuSubItem key={child.path || child.label}>
                        <SidebarMenuSubButton asChild isActive={isNavigationItemActive(child, location.pathname)}>
                          <NavLink to={child.path || "#"}>
                            <child.icon />
                            <span>{child.label}</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            </SidebarMenuItem>
          );
        }

        return (
          <SidebarMenuItem key={item.path || item.label}>
            <SidebarMenuButton asChild tooltip={item.label} isActive={isNavigationItemActive(item, location.pathname)} className="h-9">
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
