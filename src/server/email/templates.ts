import type { MailMessage } from "./mailer";
import type { OtpPurpose } from "../auth/otp";

const PURPOSE_COPY: Record<OtpPurpose, { subject: string; lead: string }> = {
  first_login: {
    subject: "Your InsightChart verification code",
    lead: "Use this code to verify your email address and finish setting up your InsightChart account.",
  },
  change_password: {
    subject: "Confirm your InsightChart password change",
    lead: "Use this code to confirm the password change you started in InsightChart.",
  },
  reset_password: {
    subject: "Reset your InsightChart password",
    lead: "Use this code to reset your InsightChart password.",
  },
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#eef3fb;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0b1f3a">
<table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #dde6f3;border-radius:12px">
<tr><td style="padding:24px">
<p style="margin:0 0 16px;font-weight:700;font-size:16px">InsightChart</p>
<h1 style="margin:0 0 12px;font-size:18px">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr></table></body></html>`;
}

export function otpEmail(opts: { to: string; name: string; purpose: OtpPurpose; code: string; minutes: number }): MailMessage {
  const copy = PURPOSE_COPY[opts.purpose];
  const text = [
    `Hi ${opts.name},`,
    "",
    copy.lead,
    "",
    `Your code: ${opts.code}`,
    "",
    `It expires in ${opts.minutes} minutes and can be used once. InsightChart staff will never ask you for this code.`,
    "If you didn't request it, you can ignore this email — your account is unchanged.",
  ].join("\n");
  const html = layout(
    copy.subject,
    `<p style="margin:0 0 12px;font-size:14px">Hi ${escapeHtml(opts.name)},</p>
<p style="margin:0 0 16px;font-size:14px;color:#3d5372">${escapeHtml(copy.lead)}</p>
<p style="margin:0 0 16px;font-size:30px;font-weight:700;letter-spacing:6px;font-family:ui-monospace,Consolas,monospace">${escapeHtml(opts.code)}</p>
<p style="margin:0 0 8px;font-size:12px;color:#7186a3">Expires in ${opts.minutes} minutes and can be used once. InsightChart staff will never ask you for this code.</p>
<p style="margin:0;font-size:12px;color:#7186a3">If you didn't request it, ignore this email — your account is unchanged.</p>`
  );
  return { to: opts.to, subject: copy.subject, text, html };
}

export function passwordChangedEmail(opts: { to: string; name: string }): MailMessage {
  const subject = "Your InsightChart password was changed";
  const text = `Hi ${opts.name},\n\nThe password for your InsightChart account was just changed and other signed-in sessions were signed out.\n\nIf this wasn't you, use "Forgot password" on the sign-in page right away and contact your administrator.`;
  const html = layout(
    subject,
    `<p style="margin:0 0 12px;font-size:14px">Hi ${escapeHtml(opts.name)},</p>
<p style="margin:0 0 12px;font-size:14px;color:#3d5372">The password for your InsightChart account was just changed and other signed-in sessions were signed out.</p>
<p style="margin:0;font-size:12px;color:#7186a3">If this wasn't you, use “Forgot password” on the sign-in page right away and contact your administrator.</p>`
  );
  return { to: opts.to, subject, text, html };
}

export function accountCreatedEmail(opts: {
  to: string;
  name: string;
  roleLabel: string;
  username: string;
  password: string;
  loginUrl: string;
  /** True when an administrator re-sent the details with a fresh password. */
  resent?: boolean;
}): MailMessage {
  const subject = opts.resent ? "Your new InsightChart sign-in details" : "Your InsightChart account is ready";
  const lead = opts.resent
    ? "Your administrator has sent you new sign-in details. The earlier initial password no longer works."
    : `An account has been created for you on InsightChart as ${opts.roleLabel}.`;
  const steps = [
    `Open ${opts.loginUrl} and choose "${opts.roleLabel}".`,
    "Sign in with the username (or this email address) and the initial password below.",
    `Choose "Change password by email", confirm this address (${opts.to}), and enter the 6-digit code we email you.`,
    "Set your own new password. The initial password stops working as soon as you do.",
  ];
  const text = [
    `Hi ${opts.name},`,
    "",
    lead,
    "",
    `Sign-in page: ${opts.loginUrl}`,
    `Username: ${opts.username}`,
    `Email: ${opts.to}`,
    `Initial password: ${opts.password}`,
    `Role: ${opts.roleLabel}`,
    "",
    "Next steps:",
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    "Keep this password private. InsightChart staff will never ask you for it or for a verification code.",
    "If you weren't expecting this email, you can ignore it.",
  ].join("\n");
  const row = (label: string, value: string, mono = false) =>
    `<tr><td style="padding:4px 12px 4px 0;font-size:13px;color:#7186a3;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:4px 0;font-size:14px;font-weight:600;${
      mono ? "font-family:ui-monospace,Consolas,monospace;letter-spacing:1px" : ""
    }">${escapeHtml(value)}</td></tr>`;
  const html = layout(
    subject,
    `<p style="margin:0 0 12px;font-size:14px">Hi ${escapeHtml(opts.name)},</p>
<p style="margin:0 0 16px;font-size:14px;color:#3d5372">${escapeHtml(lead)}</p>
<table role="presentation" style="margin:0 0 16px;border-collapse:collapse;background:#f5f8fd;border:1px solid #dde6f3;border-radius:8px;width:100%"><tr><td style="padding:12px">
<table role="presentation" style="border-collapse:collapse">
${row("Username", opts.username)}
${row("Email", opts.to)}
${row("Initial password", opts.password, true)}
${row("Role", opts.roleLabel)}
</table></td></tr></table>
<p style="margin:0 0 16px"><a href="${escapeHtml(opts.loginUrl)}" style="display:inline-block;background:#2a78d6;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px">Sign in to InsightChart</a></p>
<p style="margin:0 0 6px;font-size:13px;font-weight:600">Next steps</p>
<ol style="margin:0 0 16px;padding-left:20px;font-size:13px;color:#3d5372">${steps.map((s) => `<li style="margin:0 0 4px">${escapeHtml(s)}</li>`).join("")}</ol>
<p style="margin:0 0 8px;font-size:12px;color:#7186a3">Keep this password private. InsightChart staff will never ask you for it or for a verification code.</p>
<p style="margin:0;font-size:12px;color:#7186a3">If you weren't expecting this email, you can ignore it.</p>`
  );
  return { to: opts.to, subject, text, html };
}
