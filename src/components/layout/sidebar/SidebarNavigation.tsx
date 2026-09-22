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
  const items = useMemo(() => filterNavigation(navigationItems, user), [user]);
  const activeGroup = useMemo(() => {
    return items.find((item) => item.children?.some((child) => isNavigationItemActive(child, location.pathname)))?.label || null;
  }, [items, location.pathname]);
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup);

  useEffect(() => {
    if (activeGroup) {
      setOpenGroup(activeGroup);
    }
  }, [activeGroup]);

  const toggleGroup = (label: string) => {
    setOpenGroup((current) => (current === label ? null : label));
  };

  return (
    <SidebarMenu className="gap-1">
      {items.map((item) => {
        if (item.children?.length) {
          const isOpen = openGroup === item.label && !isCollapsed;
          const isActiveGroup = item.children.some((child) => isNavigationItemActive(child, location.pathname));

          return (
            <SidebarMenuItem key={item.label}>
              <Collapsible open={isOpen} onOpenChange={() => toggleGroup(item.label)}>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={item.label}
                    isActive={isActiveGroup}
                    className="h-9 rounded-md text-[12px] font-semibold"
                    aria-expanded={isOpen}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                    <ChevronDown className={cn("ml-auto h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <SidebarMenuSub className="mx-0 mt-1 border-l-0 px-0 pb-1 pl-4">
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
                </CollapsibleContent>
              </Collapsible>
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
