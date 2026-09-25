import {
  LayoutDashboard,
  UploadCloud,
  Users2,
  PieChart,
  Scale,
  LifeBuoy,
  ShieldCheck,
  FileDown,
  CalendarClock,
  AlertTriangle,
  UserCog,
  TrendingUp,
  ListFilter,
  type LucideIcon,
} from "lucide-react";
import { can, type Permission, type Role } from "./auth/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown only to roles holding this permission — the same rule the proxy enforces. */
  permission: Permission;
  /** Label for roles that can only view (no upload/edit). */
  readOnlyLabel?: string;
  badgeSource?: "tasks" | "alerts";
  /** Page exists but isn't built yet — kept out of the navigation until it is. */
  comingSoon?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "data:view" },
  { href: "/upload", label: "Upload & Data Preview", readOnlyLabel: "Data Preview", icon: UploadCloud, permission: "data:view" },
  { href: "/students", label: "Student Explorer", icon: Users2, permission: "data:view" },
  { href: "/filter", label: "Data Filter", icon: ListFilter, permission: "data:view" },
  { href: "/student-performance", label: "Student Performance", icon: TrendingUp, permission: "data:view" },
  { href: "/charts", label: "Interactive Charts", icon: PieChart, permission: "data:view" },
  { href: "/departments", label: "Department Comparison", icon: Scale, permission: "analysis:departments" },
  { href: "/interventions", label: "Intervention Planner", icon: LifeBuoy, permission: "analysis:departments", comingSoon: true },
  { href: "/placement", label: "Placement Readiness", icon: ShieldCheck, permission: "analysis:placement", comingSoon: true },
  { href: "/reports", label: "Reports & Exports", icon: FileDown, permission: "reports:download" },
  { href: "/tasks", label: "Tasks & Calendar", icon: CalendarClock, permission: "data:view", badgeSource: "tasks", comingSoon: true },
  { href: "/alerts", label: "Alerts & Insights", icon: AlertTriangle, permission: "data:view", badgeSource: "alerts" },
  { href: "/admin/users", label: "User Management", icon: UserCog, permission: "users:view" },
];

/** The nav as a given role sees it: filtered by permission, with read-only labels applied. */
export function navItemsFor(role: Role): NavItem[] {
  const editor = can(role, "records:edit");
  return NAV_ITEMS.filter((i) => !i.comingSoon && can(role, i.permission)).map((i) => (!editor && i.readOnlyLabel ? { ...i, label: i.readOnlyLabel } : i));
}

export function isNavItemActive(item: NavItem, pathname: string) {
  return pathname === item.href || pathname.startsWith(item.href + "/");
}
