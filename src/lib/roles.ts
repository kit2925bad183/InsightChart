// Client-side "acting as" role simulation. InsightChart has no backend, no accounts,
// and no server session — this can never be real access control, only a local UI filter
// so different staff workflows see a nav tailored to them. Never treat this as security.

export type Role = "faculty" | "mentor" | "placement-officer" | "department-head" | "administrator";

export const ROLES: Role[] = ["faculty", "mentor", "placement-officer", "department-head", "administrator"];

export const ROLE_LABELS: Record<Role, string> = {
  faculty: "Faculty",
  mentor: "Mentor",
  "placement-officer": "Placement Officer",
  "department-head": "Department Head",
  administrator: "Administrator",
};
