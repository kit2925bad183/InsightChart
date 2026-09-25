import bcrypt from "bcryptjs";

const COST = 12;
// bcrypt only considers the first 72 bytes of input; reject longer passwords rather
// than silently ignoring their tail.
const MAX_BYTES = 72;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function hashPasswordSync(plain: string): string {
  return bcrypt.hashSync(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Compared against when a username doesn't exist, so "no such user" and "wrong
// password" take the same time and can't be told apart by response latency.
const DUMMY_HASH = bcrypt.hashSync("insightchart-timing-equaliser", COST);
export async function burnPasswordCheck(plain: string) {
  await bcrypt.compare(plain, DUMMY_HASH);
}

/** Rules for a password a person chooses themselves. Returns an error message or null. */
export function validateNewPassword(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (Buffer.byteLength(password, "utf8") > MAX_BYTES) return "Use at most 72 bytes (about 72 plain characters).";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "Include at least one letter and one number.";
  return null;
}

/** Rules for an initial password set by an administrator or seeded from the environment. */
export function validateInitialPassword(password: string): string | null {
  if (password.length < 8) return "Initial password must be at least 8 characters.";
  if (Buffer.byteLength(password, "utf8") > MAX_BYTES) return "Initial password must be at most 72 bytes.";
  return null;
}
