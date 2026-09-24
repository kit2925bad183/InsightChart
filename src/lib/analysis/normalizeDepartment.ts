// Real-world department/class fields are messy free text (Google Forms responses, manual
// entry, inconsistent casing/abbreviations). This collapses common variants into a small
// set of canonical branch codes so charts group students the way a person would expect.

const FULL_NAMES: Record<string, string> = {
  CSE: "Computer Science and Engineering",
  ECE: "Electronics and Communication Engineering",
  EEE: "Electrical and Electronics Engineering",
  CSBS: "Computer Science and Business Systems",
  AIDS: "Artificial Intelligence and Data Science",
  AIML: "Artificial Intelligence and Machine Learning",
  IT: "Information Technology",
  MECH: "Mechanical Engineering",
  CIVIL: "Civil Engineering",
  CSD: "Computer Science and Design",
};

interface Rule {
  code: string;
  test: RegExp;
}

// Order matters: more specific / less ambiguous branches first.
const RULES: Rule[] = [
  { code: "ECE", test: /\bece\b/i },
  { code: "CSBS", test: /\bcsbs\b/i },
  { code: "EEE", test: /\beee\b/i },
  { code: "CIVIL", test: /\bcivil\b/i },
  { code: "MECH", test: /\bmech(anical)?\b/i },
  { code: "IT", test: /\binformation technology\b|\bit\b/i },
  { code: "CSD", test: /\bcsd\b|computer science.{0,15}design/i },
  // AI&ML and AI&DS are distinct branches — checked before plain CSE, since
  // "CSE(AI&ML)" free-text responses in practice refer to the specialization,
  // not core CSE. Order matters: ML checked before DS so "AI&ML" never falls
  // through to the DS bucket.
  { code: "AIML", test: /\baiml\b|\bai\W*ml\b|machine learning/i },
  { code: "AIDS", test: /\baids\b|\bai\W*ds\b|data science/i },
  { code: "CSE", test: /\bcse\b|computer science/i },
];

function stripNoise(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface DepartmentInfo {
  code: string;
  fullName: string;
}

/** Best-effort canonicalization of one raw department/class value. Unmatched input passes through as its own code. */
export function canonicalizeDepartment(raw: string | null | undefined): DepartmentInfo {
  if (!raw || !String(raw).trim()) return { code: "Unlabeled", fullName: "Unlabeled" };
  const cleaned = stripNoise(String(raw));
  for (const rule of RULES) {
    if (rule.test.test(cleaned)) {
      return { code: rule.code, fullName: FULL_NAMES[rule.code] ?? rule.code };
    }
  }
  const trimmed = String(raw).trim();
  return { code: trimmed, fullName: FULL_NAMES[trimmed.toUpperCase()] ?? trimmed };
}

export function canonicalDepartmentLabel(raw: string | null | undefined): string {
  return canonicalizeDepartment(raw).code;
}

/** Same as canonicalDepartmentLabel, but a user-supplied override (raw value -> code)
 * wins over the heuristic when present — lets someone correct a bad guess. */
export function resolveDepartment(raw: string | null | undefined, overrides: Record<string, string>): string {
  const trimmed = raw != null ? String(raw).trim() : "";
  if (trimmed && overrides[trimmed]) return overrides[trimmed];
  return canonicalDepartmentLabel(raw);
}

/** Full name for a known branch code, falling back to the code itself. */
export function departmentFullName(code: string): string {
  return FULL_NAMES[code.toUpperCase()] ?? code;
}
