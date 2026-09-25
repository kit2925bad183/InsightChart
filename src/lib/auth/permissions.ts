// The single source of truth for who may do what. Imported by the proxy (page access),
// every API route (enforcement), and the client nav/controls (display only). Pure module:
// no Node or browser APIs, so it is safe to import from anywhere.

export const ROLES = ["CREATOR_ADMIN", "ADMINISTRATOR", "HOD", "FACULTY"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  CREATOR_ADMIN: "Creator Admin",
  ADMINISTRATOR: "Administrator",
  HOD: "Head of Department",
  FACULTY: "Faculty",
};

export type Permission =
  /** See dashboards, charts, student lists and every other analysis view. */
  | "data:view"
  /** Download reports, CSV exports, chart images/PDFs. */
  | "reports:download"
  /** Department comparison and intervention planning views. */
  | "analysis:departments"
  /** Placement readiness view. */
  | "analysis:placement"
  /** Upload/replace datasets, add/edit/delete rows, correct names/marks/departments, reset data. */
  | "records:edit"
  /** Open the user-management page and list accounts. */
  | "users:view"
  /** Create accounts (which roles is further limited by creatableRoles). */
  | "users:create"
  /** Deactivate/reactivate/change role of accounts (which targets is limited by canManageUser). */
  | "users:manage"
  /** Application-level administration reserved for the app creator. */
  | "app:manage";

const EVERYONE: readonly Role[] = ROLES;
const EDITORS: readonly Role[] = ["CREATOR_ADMIN", "ADMINISTRATOR"];

const GRANTS: Record<Permission, readonly Role[]> = {
  "data:view": EVERYONE,
  "reports:download": EVERYONE,
  "analysis:departments": ["CREATOR_ADMIN", "ADMINISTRATOR", "HOD"],
  "analysis:placement": ["CREATOR_ADMIN", "ADMINISTRATOR", "HOD"],
  "records:edit": EDITORS,
  "users:view": EDITORS,
  "users:create": EDITORS,
  "users:manage": EDITORS,
  "app:manage": ["CREATOR_ADMIN"],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && GRANTS[permission].includes(role);
}

/** Which roles an actor may assign when creating (or re-assigning) an account. */
export function creatableRoles(actor: Role): Role[] {
  if (actor === "CREATOR_ADMIN") return ["ADMINISTRATOR", "HOD", "FACULTY"];
  if (actor === "ADMINISTRATOR") return ["HOD", "FACULTY"];
  return [];
}

/** Whether an actor may deactivate/reactivate/re-role a target account. Nobody manages
 * themselves (so nobody can change their own role or lock themselves out), and the
 * Creator Admin account can't be managed by anyone. */
export function canManageUser(actor: { id: number; role: Role }, target: { id: number; role: Role }): boolean {
  if (actor.id === target.id) return false;
  if (target.role === "CREATOR_ADMIN") return false;
  if (!can(actor.role, "users:manage")) return false;
  return creatableRoles(actor.role).includes(target.role);
}

/** Page-access rules, matched by path prefix. Any authenticated page not listed here is
 * denied — adding a new page means adding it here, which is deliberate. */
const PAGE_RULES: { prefix: string; permission: Permission }[] = [
  { prefix: "/dashboard", permission: "data:view" },
  { prefix: "/upload", permission: "data:view" },
  { prefix: "/students", permission: "data:view" },
  { prefix: "/student-performance", permission: "data:view" },
  { prefix: "/charts", permission: "data:view" },
  { prefix: "/reports", permission: "reports:download" },
  { prefix: "/tasks", permission: "data:view" },
  { prefix: "/alerts", permission: "data:view" },
  { prefix: "/settings", permission: "data:view" },
  { prefix: "/account", permission: "data:view" },
  { prefix: "/forbidden", permission: "data:view" },
  { prefix: "/departments", permission: "analysis:departments" },
  { prefix: "/interventions", permission: "analysis:departments" },
  { prefix: "/placement", permission: "analysis:placement" },
  { prefix: "/admin/users", permission: "users:view" },
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function pagePermission(pathname: string): Permission | null {
  return PAGE_RULES.find((r) => matchesPrefix(pathname, r.prefix))?.permission ?? null;
}

export function canAccessPage(role: Role | null | undefined, pathname: string): boolean {
  const permission = pagePermission(pathname);
  return !!permission && can(role, permission);
}

/** Pages reachable without a full session. */
export const PUBLIC_PAGES = ["/welcome", "/login", "/forgot-password"];
/** The one page a signed-in-but-not-yet-activated (first login) session may use. */
export const FIRST_LOGIN_PAGE = "/first-login";

export function isPublicPage(pathname: string) {
  return PUBLIC_PAGES.some((p) => matchesPrefix(pathname, p));
}
