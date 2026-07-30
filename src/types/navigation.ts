import type { LucideIcon } from "lucide-react";
import type { AuthUser } from "@/types/database";

export type UserRole = AuthUser["role"];

export type PermissionKey =
  | "can_access_dashboard"
  | "can_access_briefings"
  | "can_access_codes"
  | "can_access_projects"
  | "can_access_expenses"
  | "can_access_crm"
  | "can_access_users";

export type NavigationItem = {
  label: string;
  icon: LucideIcon;
  path?: string;
  children?: NavigationItem[];
  legacyPaths?: string[];
  requiredRoles?: UserRole[];
  requiredPermissions?: PermissionKey[];
  restrictedForRicardo?: boolean;
};

