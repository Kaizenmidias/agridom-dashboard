import { useState } from "react"
import { Home, FileText, Wallet, Users, Settings, User, Briefcase, Code } from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"

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

const allItems = [
  { title: "Dashboard", url: "/", icon: Home, permission: "can_access_dashboard" },
  { title: "Projetos", url: "/projetos", icon: FileText, permission: "can_access_projects" },
  { title: "Briefings", url: "/briefings", icon: Briefcase, permission: "can_access_briefings" },
  { title: "Códigos", url: "/codigos", icon: Code, permission: "can_access_codes" },
  { title: "Despesas", url: "/despesas", icon: Wallet, permission: "can_access_expenses" },
  { title: "CRM", url: "/crm", icon: Users, permission: "can_access_crm" },
  { title: "Usuários", url: "/usuarios", icon: Settings, permission: "can_access_users" },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const { user } = useAuth()
  const location = useLocation()
  const currentPath = location.pathname

  // Filtrar itens baseado nas permissões do usuário
  const items = allItems.filter(item => {
    if (!user) return false
    const permission = user[item.permission as keyof typeof user]
    return permission === true || permission === '1'
  })

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
          <div className="h-8 w-8 flex items-center justify-center">
            <img src="/logo.svg" alt="Logo" className="h-8 w-8 rounded-full" />
          </div>
          {!isCollapsed && (
            <span className="ml-3 text-lg font-bold text-foreground">Kaizen</span>
          )}
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
        <div className="mt-auto p-4 border-t border-border space-y-3 overflow-hidden">
          {/* Theme Toggle */}
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
          
          {/* User Profile */}
          <UserProfileDialog>
            <Button variant="ghost" className="w-full justify-start p-2 overflow-hidden">
              <div className="flex items-center space-x-3 w-full overflow-hidden">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-primary">
                    {user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                  </span>
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0 text-left overflow-hidden">
                    <p className="text-sm font-medium truncate whitespace-nowrap">{user?.full_name || 'Usuário'}</p>
                    <p className="text-xs text-muted-foreground truncate whitespace-nowrap">{user?.email || 'email@exemplo.com'}</p>
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