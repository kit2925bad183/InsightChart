// The full journey for a person an administrator adds: account created → sign-in details
// emailed → sign in with them → password changed only after the emailed OTP is verified.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db";
import { addUser, captureMail, codeFrom, cookieFor, freshDb, request } from "./helpers";
import { firstLoginComplete, firstLoginSendOtp, firstLoginVerifyOtp, login } from "../auth/service";
import { getSessionByToken } from "../auth/sessions";
import { setMailTransportForTests, type MailMessage } from "../email/mailer";
import { generateInitialPassword } from "../users";
import { validateInitialPassword } from "../auth/passwords";
import * as usersRoute from "@/app/api/users/route";
import * as resendRoute from "@/app/api/users/[id]/resend-details/route";

const PASSWORD = "Test#Pass2026";
const meta = { ip: "127.0.0.1" };
let db: Db;
let mail: MailMessage[];
let creator: string;

beforeEach(async () => {
  db = await freshDb();
  mail = captureMail();
  await addUser(db, { username: "creator", role: "CREATOR_ADMIN", password: PASSWORD, email: "c@gmail.com", verified: true });
  creator = await cookieFor(db, "creator", PASSWORD);
});

afterEach(() => setMailTransportForTests(null));

const detail = (msg: MailMessage, label: string) => new RegExp(`^${label}: (.+)$`, "m").exec(msg.text)?.[1];

async function create(body: Record<string, unknown>) {
  const res = await usersRoute.POST(request("POST", "/api/users", { cookie: creator, body }), undefined);
  return { status: res.status, body: (await res.json()) as { user: { id: number; username: string }; email: { sent: boolean; to: string; error?: string } } };
}

const resend = (id: number, cookie = creator) =>
  resendRoute.POST(request("POST", `/api/users/${id}/resend-details`, { cookie }), { params: Promise.resolve({ id: String(id) }) });

const failingMail = (code: string) =>
  setMailTransportForTests({
    async send() {
      throw Object.assign(new Error("send failed"), { code });
    },
  });

describe("creating an account emails the sign-in details", () => {
  it("sends username, generated password and sign-in link; the person signs in and changes it only via the OTP", async () => {
    const { status, body } = await create({ displayName: "Meena R", email: "Meena.R@gmail.com", role: "HOD" });
    expect(status).toBe(201);
    expect(body.email).toEqual({ sent: true, to: "meena.r@gmail.com" });

    expect(mail).toHaveLength(1);
    const welcome = mail[0];
    expect(welcome.to).toBe("meena.r@gmail.com");
    expect(welcome.subject).toBe("Your InsightChart account is ready");
    expect(detail(welcome, "Username")).toBe(body.user.username);
    expect(detail(welcome, "Sign-in page")).toBe("http://localhost:3000/login");
    expect(detail(welcome, "Role")).toBe("Head of Department");
    const password = detail(welcome, "Initial password")!;
    expect(welcome.html).toContain(password);

    // Signs in with the emailed details → first-login stage only.
    const r = await login(db, { identifier: body.user.username, password }, meta);
    expect(r.stage).toBe("pending");
    const ctx = (await getSessionByToken(db, r.token))!;

    // The password changes only after the code emailed to the registered address is verified.
    await firstLoginSendOtp(db, ctx, { email: "meena.r@gmail.com" });
    expect(mail[1].to).toBe("meena.r@gmail.com");
    const code = codeFrom(mail[1]);
    await expect(firstLoginVerifyOtp(db, ctx, { code: code === "000000" ? "111111" : "000000" })).rejects.toThrow();
    const { verificationToken } = await firstLoginVerifyOtp(db, ctx, { code });
    await firstLoginComplete(db, ctx, { verificationToken, password: "Meena-Own-2026", confirmPassword: "Meena-Own-2026" }, meta);

    await expect(login(db, { identifier: body.user.username, password }, meta)).rejects.toThrow();
    expect((await login(db, { identifier: "meena.r@gmail.com", password: "Meena-Own-2026" }, meta)).stage).toBe("active");
  });

  it("emails the password the admin typed when one is given", async () => {
    await create({ displayName: "Ravi K", email: "ravi@gmail.com", role: "FACULTY", initialPassword: "Ravi@Start1" });
    expect(detail(mail[0], "Initial password")).toBe("Ravi@Start1");
  });

  it("still creates the account and reports why when the email can't be sent", async () => {
    failingMail("EAUTH");
    const { status, body } = await create({ displayName: "Ravi K", email: "ravi@gmail.com", role: "FACULTY" });
    expect(status).toBe(201);
    expect(body.email.sent).toBe(false);
    expect(body.email.error).toMatch(/SMTP_USER and SMTP_PASS/);
    expect(await db.one("SELECT 1 FROM users WHERE email = $1", ["ravi@gmail.com"])).toBeTruthy();
  });

  it("makes an admin-created Administrator confirm the address the details were sent to", async () => {
    const { body } = await create({ displayName: "New Admin", email: "newadmin@gmail.com", role: "ADMINISTRATOR" });
    const r = await login(db, { identifier: body.user.username, password: detail(mail[0], "Initial password")! }, meta);
    const ctx = (await getSessionByToken(db, r.token))!;
    await expect(firstLoginSendOtp(db, ctx, { email: "someoneelse@gmail.com" })).rejects.toMatchObject({ code: "email_mismatch" });
  });
});

describe("resending sign-in details", () => {
  it("emails a fresh password and retires the old one", async () => {
    const { body } = await create({ displayName: "Ravi K", email: "ravi@gmail.com", role: "FACULTY" });
    const oldPassword = detail(mail[0], "Initial password")!;
    expect((await resend(body.user.id)).status).toBe(200);
    expect(mail[1].subject).toBe("Your new InsightChart sign-in details");
    const newPassword = detail(mail[1], "Initial password")!;
    expect(newPassword).not.toBe(oldPassword);
    await expect(login(db, { identifier: "ravi@gmail.com", password: oldPassword }, meta)).rejects.toThrow();
    expect((await login(db, { identifier: "ravi@gmail.com", password: newPassword }, meta)).stage).toBe("pending");
  });

  it("keeps the old password when the email fails", async () => {
    const { body } = await create({ displayName: "Ravi K", email: "ravi@gmail.com", role: "FACULTY" });
    const oldPassword = detail(mail[0], "Initial password")!;
    failingMail("ETIMEDOUT");
    expect((await resend(body.user.id)).status).toBe(502);
    expect((await login(db, { identifier: "ravi@gmail.com", password: oldPassword }, meta)).stage).toBe("pending");
  });

  it("refuses once the person has set their own password, and refuses read-only roles", async () => {
    const done = await addUser(db, { username: "done", role: "FACULTY", password: PASSWORD, email: "d@gmail.com", verified: true });
    expect((await resend(done)).status).toBe(400);
    await addUser(db, { username: "hod", role: "HOD", password: PASSWORD, email: "h@gmail.com", verified: true });
    expect((await resend(done, await cookieFor(db, "hod", PASSWORD))).status).toBe(403);
  });
});

describe("generated initial passwords", () => {
  it("are 12 characters, valid, include letters and digits, avoid look-alikes, and differ each time", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const p = generateInitialPassword();
      expect(p).toHaveLength(12);
      expect(validateInitialPassword(p)).toBeNull();
      expect(p).toMatch(/[A-Za-z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).not.toMatch(/[0O1lI]/);
      seen.add(p);
    }
    expect(seen.size).toBe(50);
  });
});
