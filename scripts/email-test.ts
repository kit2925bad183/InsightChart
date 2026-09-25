// `npm run email:test -- you@gmail.com` — sends one test email using the SMTP settings in
// .env.local and says in plain words what's wrong if it fails. Use it after editing
// SMTP_USER / SMTP_PASS to confirm the one-time codes will actually be delivered.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { resolveSmtpSettings, smtpTransport, explainSmtpError } = await import("../src/server/email/mailer");
  const to = process.argv[2];
  if (!to || !to.includes("@")) {
    console.log("Usage: npm run email:test -- your.address@gmail.com");
    process.exit(1);
  }

  const r = resolveSmtpSettings();
  if (!("settings" in r)) {
    console.log(`✘ Email isn't configured. Set ${r.missing.join(" and ")} in .env.local.`);
    console.log("  For Gmail: SMTP_USER=your.address@gmail.com and SMTP_PASS=<16-letter App Password>");
    console.log("  Create the App Password at https://myaccount.google.com/apppasswords (2-Step Verification must be on).");
    process.exit(1);
  }
  const s = r.settings;
  console.log(`Sending via ${s.host}:${s.port} (${s.secure ? "TLS" : "STARTTLS/plain"}) as ${s.user ?? "(no login)"} from ${s.from} → ${to} …`);
  try {
    await smtpTransport(s).send({
      to,
      subject: "InsightChart test email",
      text: "This is a test from InsightChart. If you received it, verification codes will be delivered too.",
      html: "<p>This is a test from <strong>InsightChart</strong>. If you received it, verification codes will be delivered too.</p>",
    });
    console.log("✔ Sent. Check the inbox (and the Spam folder) of " + to + ".");
  } catch (err) {
    console.log("✘ " + explainSmtpError(err).message);
    console.log("  Server said: " + ((err as Error).message ?? String(err)).split("\n")[0]);
    process.exit(1);
  }
}

main();
