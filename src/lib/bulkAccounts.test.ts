import { describe, expect, it } from "vitest";
import { parseBulkAccounts, parseRole } from "./bulkAccounts";
import type { DataSheet } from "./types";

const sheet = (headers: string[], rows: string[][]): DataSheet => ({
  id: "s",
  name: "Sheet1",
  headers,
  rows: rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""]))),
});

const opts = {
  allowedRoles: ["HOD", "FACULTY"] as ("HOD" | "FACULTY")[],
  defaultRole: null,
  existingEmails: ["taken@gmail.com"],
  existingUsernames: ["admin123"],
  allowedDomains: ["gmail.com"],
};

describe("parseRole", () => {
  it("understands the ways staff lists name roles", () => {
    expect(["HOD", "Head of Department", "head of the department", "Faculty", "Assistant Professor", "teacher", "Administrator"].map(parseRole)).toEqual([
      "HOD",
      "HOD",
      "HOD",
      "FACULTY",
      "FACULTY",
      "FACULTY",
      "ADMINISTRATOR",
    ]);
    expect(parseRole("Principal")).toBeNull();
  });
});

describe("parseBulkAccounts", () => {
  it("reads flexible headers and flags every problem per row", () => {
    const r = parseBulkAccounts(
      sheet(
        ["Name", "E-mail ID", "Designation", "Login"],
        [
          ["Dr. Meena Rao", "Meena.Rao@gmail.com", "HOD", ""],
          ["Kavin", "kavin@gmail.com", "Assistant Professor", "kavin.cse"],
          ["", "x@gmail.com", "Faculty", ""],
          ["Dup One", "dup@gmail.com", "Faculty", ""],
          ["Dup Two", "DUP@gmail.com", "Faculty", ""],
          ["Yahoo User", "someone@yahoo.com", "Faculty", ""],
          ["Taken", "taken@gmail.com", "Faculty", ""],
          ["Boss", "boss@gmail.com", "Administrator", ""],
          ["Who", "who@gmail.com", "Principal", ""],
          ["Bad User", "bad@gmail.com", "Faculty", "a b"],
          ["Clash", "clash@gmail.com", "Faculty", "Admin123"],
          ["", "", "", ""],
        ]
      ),
      opts
    );
    expect(r.fileProblems).toEqual([]);
    expect(r.columns).toEqual({ name: "Name", email: "E-mail ID", role: "Designation", username: "Login" });
    expect(r.rows.map((x) => [x.line, x.email, x.role, x.problems])).toEqual([
      [2, "meena.rao@gmail.com", "HOD", []],
      [3, "kavin@gmail.com", "FACULTY", []],
      [4, "x@gmail.com", "FACULTY", ["Name is missing"]],
      [5, "dup@gmail.com", "FACULTY", ["Email appears more than once in this file"]],
      [6, "dup@gmail.com", "FACULTY", ["Email appears more than once in this file"]],
      [7, "someone@yahoo.com", "FACULTY", ["Use a @gmail.com address"]],
      [8, "taken@gmail.com", "FACULTY", ["An account with this email already exists"]],
      [9, "boss@gmail.com", "ADMINISTRATOR", ["You can't create Administrator accounts"]],
      [10, "who@gmail.com", null, ["Unknown role “Principal” — use HOD or Faculty"]],
      [11, "bad@gmail.com", "FACULTY", ["Username must be 3–32 letters, numbers, dots, dashes or underscores"]],
      [12, "clash@gmail.com", "FACULTY", ["Username is already taken"]],
    ]);
  });

  it("uses the chosen role when the file has no role column", () => {
    const r = parseBulkAccounts(sheet(["Full name", "Email"], [["A Person", "a@gmail.com"]]), { ...opts, defaultRole: "FACULTY" });
    expect(r.rows[0]).toMatchObject({ role: "FACULTY", problems: [] });
  });

  it("explains a file it can't use", () => {
    expect(parseBulkAccounts(sheet(["Staff", "Phone"], [["x", "1"]]), opts).fileProblems).toEqual([
      'No email column found. Name a column "Email" (found: Staff, Phone).',
      'No name column found. Name a column "Full name".',
      'No role column found. Add a "Role" column or choose a role for everyone.',
    ]);
    const big = sheet(["Name", "Email", "Role"], Array.from({ length: 301 }, (_, i) => [`P ${i}`, `p${i}@gmail.com`, "Faculty"]));
    expect(parseBulkAccounts(big, opts).fileProblems[0]).toMatch(/limit is 300/);
  });
});
