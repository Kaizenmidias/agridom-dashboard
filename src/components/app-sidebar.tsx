import { useState } from "react"
import { Home, FileText, Wallet, Users, Settings, User } from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "./theme-toggle"
import { UserProfileDialog } from "./user-profile-dialog"
import { Button } from "@/components/ui/button"

const items = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Projetos", url: "/projetos", icon: FileText },
  { title: "Despesas", url: "/despesas", icon: Wallet },
  { title: "CRM", url: "/crm", icon: Users },
  { title: "Usuários", url: "/usuarios", icon: Settings },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const location = useLocation()
  const currentPath = location.pathname

  const isActive = (path: string) => {
    if (path === "/" && currentPath === "/") return true
    if (path !== "/" && currentPath.startsWith(path)) return true
    return false
  }

  const isCollapsed = state === "collapsed"

  return (
    <Sidebar
      collapsible="icon"
    >
      <SidebarContent>
        {/* Logo/Header */}
        <div className="p-4 border-b border-border flex items-center">
          <div className="h-8 w-8 bg-primary rounded-lg text-primary-foreground flex items-center justify-center text-sm font-bold">
            K
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isActive(item.url)}>
                  <NavLink to={item.url} end>
                    <item.icon />
                    <span>{item.title}</span>
                  </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User section at bottom */}
        <div className="mt-auto p-4 border-t border-border space-y-3">
          {/* Theme Toggle */}
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
          
          {/* User Profile */}
          <UserProfileDialog>
            <Button variant="ghost" className="w-full justify-start p-2">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">KZ</span>
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">Kaizen Admin</p>
                    <p className="text-xs text-muted-foreground truncate">admin@kaizen.com</p>
                  </div>
                )}
              </div>
            </Button>
          </UserProfileDialog>
        </div>
      </SidebarContent>
    </Sidebar>
  )
}