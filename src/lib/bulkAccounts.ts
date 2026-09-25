// Reads a list of people to create accounts for (CSV or Excel exported from a staff list)
// and checks every row before anything is created.

import type { CellValue, DataSheet } from "./types";
import { ROLE_LABELS, type Role } from "./auth/permissions";

export interface BulkRow {
  /** 1-based line number in the file (header = line 1), for messages. */
  line: number;
  displayName: string;
  email: string;
  role: Role | null;
  username: string;
  /** Why this row can't be created; empty = ready. */
  problems: string[];
}

export interface BulkParseResult {
  rows: BulkRow[];
  /** Problems with the file as a whole (e.g. no email column). */
  fileProblems: string[];
  columns: { name?: string; email?: string; role?: string; username?: string };
}

/** Most accounts one file may create — larger staff lists can be split. */
export const MAX_BULK_ROWS = 300;

export const TEMPLATE_CSV = [
  "Full name,Email,Role,Username",
  "Dr. Meena Rao,meena.rao@gmail.com,HOD,",
  "Kavin Kumar,kavin.kumar@gmail.com,Faculty,kavin.cse",
].join("\n");

const HEADER_PATTERNS: Record<keyof BulkParseResult["columns"], RegExp> = {
  name: /^(full\s*name|name|staff\s*name|faculty\s*name|display\s*name)$/i,
  email: /^(e-?mail|e-?mail\s*(id|address)|mail\s*id|gmail)$/i,
  role: /^(role|designation|position|account\s*type|type)$/i,
  username: /^(user\s*name|username|login|login\s*id|user\s*id)$/i,
};

const ROLE_WORDS: [RegExp, Role][] = [
  [/^(hod|head(\s+of\s+(the\s+)?department)?|head\s*-?\s*dept)$/i, "HOD"],
  [/^(faculty|staff|teacher|lecturer|assistant\s+professor|associate\s+professor|professor|ap|asp)$/i, "FACULTY"],
  [/^(admin|administrator)$/i, "ADMINISTRATOR"],
];

/** "HOD", "Head of Department", "faculty", "Assistant Professor", "Administrator" → role. */
export function parseRole(text: string): Role | null {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return null;
  for (const [re, role] of ROLE_WORDS) if (re.test(t)) return role;
  const byLabel = (Object.keys(ROLE_LABELS) as Role[]).find((r) => ROLE_LABELS[r].toLowerCase() === t.toLowerCase() || r.toLowerCase() === t.toLowerCase());
  return byLabel ?? null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9._-]{3,32}$/;
const text = (v: CellValue | undefined) => (v === null || v === undefined ? "" : String(v).trim());

/**
 * Turns the first sheet of an uploaded staff list into rows, each checked against:
 * the roles this admin may create, the allowed email domains, duplicates inside the file,
 * and emails/usernames that already have an account.
 */
export function parseBulkAccounts(
  sheet: DataSheet,
  opts: {
    allowedRoles: Role[];
    /** Role for rows that leave the role blank (or when the file has no role column). */
    defaultRole: Role | null;
    existingEmails: string[];
    existingUsernames: string[];
    /** Allowed email domains, or null for any. */
    allowedDomains: string[] | null;
  }
): BulkParseResult {
  const find = (key: keyof BulkParseResult["columns"]) => sheet.headers.find((h) => HEADER_PATTERNS[key].test(h.trim()));
  const columns = { name: find("name"), email: find("email"), role: find("role"), username: find("username") };
  const fileProblems: string[] = [];
  if (!columns.email) fileProblems.push(`No email column found. Name a column "Email" (found: ${sheet.headers.join(", ") || "none"}).`);
  if (!columns.name) fileProblems.push(`No name column found. Name a column "Full name".`);
  if (!columns.role && !opts.defaultRole) fileProblems.push(`No role column found. Add a "Role" column or choose a role for everyone.`);
  if (fileProblems.length) return { rows: [], fileProblems, columns };

  const dataRows = sheet.rows.filter((r) => sheet.headers.some((h) => text(r[h]) !== ""));
  if (dataRows.length > MAX_BULK_ROWS) {
    return { rows: [], fileProblems: [`This file has ${dataRows.length} people; the limit is ${MAX_BULK_ROWS} per file. Split it into smaller files.`], columns };
  }

  const existingEmails = new Set(opts.existingEmails.map((e) => e.toLowerCase()));
  const existingUsernames = new Set(opts.existingUsernames.map((u) => u.toLowerCase()));
  const emailCount = new Map<string, number>();
  const usernameCount = new Map<string, number>();
  const base = dataRows.map((r) => {
    const email = text(r[columns.email!]).toLowerCase();
    const username = columns.username ? text(r[columns.username]) : "";
    if (email) emailCount.set(email, (emailCount.get(email) ?? 0) + 1);
    if (username) usernameCount.set(username.toLowerCase(), (usernameCount.get(username.toLowerCase()) ?? 0) + 1);
    return { r, email, username };
  });

  const rows = base.map(({ r, email, username }): BulkRow => {
    const problems: string[] = [];
    const displayName = text(r[columns.name!]).replace(/\s+/g, " ");
    const roleText = columns.role ? text(r[columns.role]) : "";
    const role = roleText ? parseRole(roleText) : opts.defaultRole;

    if (displayName.length < 2) problems.push("Name is missing");
    else if (displayName.length > 100) problems.push("Name is too long");
    if (!email) problems.push("Email is missing");
    else if (!EMAIL_RE.test(email) || email.length > 254) problems.push("Email isn't valid");
    else {
      const domain = email.split("@")[1];
      if (opts.allowedDomains && !opts.allowedDomains.includes(domain)) problems.push(`Use a ${opts.allowedDomains.map((d) => "@" + d).join(" or ")} address`);
      if ((emailCount.get(email) ?? 0) > 1) problems.push("Email appears more than once in this file");
      if (existingEmails.has(email)) problems.push("An account with this email already exists");
    }
    if (roleText && !role) problems.push(`Unknown role “${roleText}” — use HOD or Faculty${opts.allowedRoles.includes("ADMINISTRATOR") ? " or Administrator" : ""}`);
    else if (!role) problems.push("Role is missing");
    else if (!opts.allowedRoles.includes(role)) problems.push(`You can't create ${ROLE_LABELS[role]} accounts`);
    if (username) {
      if (!USERNAME_RE.test(username)) problems.push("Username must be 3–32 letters, numbers, dots, dashes or underscores");
      else if ((usernameCount.get(username.toLowerCase()) ?? 0) > 1) problems.push("Username appears more than once in this file");
      else if (existingUsernames.has(username.toLowerCase())) problems.push("Username is already taken");
    }
    // +2: the header is line 1 and lines are 1-based.
    return { line: sheet.rows.indexOf(r) + 2, displayName, email, role, username, problems };
  });
  if (!rows.length) fileProblems.push("The file has no people in it.");
  return { rows, fileProblems, columns };
}
