import { describe, expect, it } from "vitest";
import { can, canAccessPage, canManageUser, creatableRoles, ROLES, type Permission } from "./permissions";
import { navItemsFor } from "../nav";

describe("role permission matrix", () => {
  const editOnly: Permission[] = ["records:edit", "users:view", "users:create", "users:manage"];

  it("gives HOD and Faculty view/download access only", () => {
    for (const role of ["HOD", "FACULTY"] as const) {
      expect(can(role, "data:view")).toBe(true);
      expect(can(role, "reports:download")).toBe(true);
      for (const p of editOnly) expect(can(role, p), `${role} ${p}`).toBe(false);
      expect(can(role, "app:manage")).toBe(false);
    }
  });

  it("lets Administrator edit records and manage users but not the app", () => {
    for (const p of editOnly) expect(can("ADMINISTRATOR", p)).toBe(true);
    expect(can("ADMINISTRATOR", "app:manage")).toBe(false);
  });

  it("gives Creator Admin every permission", () => {
    for (const p of [...editOnly, "data:view", "reports:download", "analysis:departments", "analysis:placement", "app:manage"] as Permission[]) {
      expect(can("CREATOR_ADMIN", p)).toBe(true);
    }
  });

  it("denies everything to a missing role", () => {
    expect(can(null, "data:view")).toBe(false);
    expect(can(undefined, "data:view")).toBe(false);
  });
});

describe("account creation and management rules", () => {
  it("limits which roles each actor can create", () => {
    expect(creatableRoles("CREATOR_ADMIN")).toEqual(["ADMINISTRATOR", "HOD", "FACULTY"]);
    expect(creatableRoles("ADMINISTRATOR")).toEqual(["HOD", "FACULTY"]);
    expect(creatableRoles("HOD")).toEqual([]);
    expect(creatableRoles("FACULTY")).toEqual([]);
  });

  it("never lets anyone manage themselves (so no one changes their own role)", () => {
    for (const role of ROLES) expect(canManageUser({ id: 1, role }, { id: 1, role })).toBe(false);
  });

  it("protects the Creator Admin and stops administrators managing administrators", () => {
    expect(canManageUser({ id: 2, role: "ADMINISTRATOR" }, { id: 1, role: "CREATOR_ADMIN" })).toBe(false);
    expect(canManageUser({ id: 2, role: "ADMINISTRATOR" }, { id: 3, role: "ADMINISTRATOR" })).toBe(false);
    expect(canManageUser({ id: 2, role: "ADMINISTRATOR" }, { id: 4, role: "HOD" })).toBe(true);
    expect(canManageUser({ id: 1, role: "CREATOR_ADMIN" }, { id: 2, role: "ADMINISTRATOR" })).toBe(true);
    expect(canManageUser({ id: 4, role: "HOD" }, { id: 5, role: "FACULTY" })).toBe(false);
  });
});

describe("page access and navigation share the same rules", () => {
  it("blocks user management and restricted analysis pages for view-only roles", () => {
    expect(canAccessPage("FACULTY", "/admin/users")).toBe(false);
    expect(canAccessPage("HOD", "/admin/users")).toBe(false);
    expect(canAccessPage("FACULTY", "/departments")).toBe(false);
    expect(canAccessPage("HOD", "/departments")).toBe(true);
    expect(canAccessPage("ADMINISTRATOR", "/admin/users")).toBe(true);
    expect(canAccessPage("FACULTY", "/dashboard")).toBe(true);
  });

  it("denies unknown pages by default", () => {
    expect(canAccessPage("CREATOR_ADMIN", "/some-new-page")).toBe(false);
  });

  it("never shows a nav link to a page the role can't open", () => {
    for (const role of ROLES) {
      for (const item of navItemsFor(role)) expect(canAccessPage(role, item.href), `${role} → ${item.href}`).toBe(true);
    }
    expect(navItemsFor("FACULTY").map((i) => i.href)).not.toContain("/admin/users");
    expect(navItemsFor("ADMINISTRATOR").map((i) => i.href)).toContain("/admin/users");
  });
});
