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
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./roles";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  badgeSource?: "tasks" | "alerts";
}

const ALL_ROLES: Role[] = ["faculty", "mentor", "placement-officer", "department-head", "administrator"];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL_ROLES },
  { href: "/upload", label: "Upload & Data Preview", icon: UploadCloud, roles: ALL_ROLES },
  { href: "/students", label: "Student Explorer", icon: Users2, roles: ALL_ROLES },
  { href: "/charts", label: "Interactive Charts", icon: PieChart, roles: ALL_ROLES },
  { href: "/departments", label: "Department Comparison", icon: Scale, roles: ["mentor", "department-head", "administrator"] },
  { href: "/interventions", label: "Intervention Planner", icon: LifeBuoy, roles: ["mentor", "department-head", "administrator"] },
  { href: "/placement", label: "Placement Readiness", icon: ShieldCheck, roles: ["placement-officer", "department-head", "administrator"] },
  { href: "/reports", label: "Reports & Exports", icon: FileDown, roles: ALL_ROLES, badgeSource: undefined },
  { href: "/tasks", label: "Tasks & Calendar", icon: CalendarClock, roles: ALL_ROLES, badgeSource: "tasks" },
  { href: "/alerts", label: "Alerts & Insights", icon: AlertTriangle, roles: ALL_ROLES, badgeSource: "alerts" },
];
