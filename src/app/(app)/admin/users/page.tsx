"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus, RefreshCcw, Mail } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormMessage, PasswordField, TextField } from "@/components/auth/fields";
import { ROLE_LABELS, canManageUser, type Role } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import { api } from "@/lib/api";
import { BulkCreateAccounts } from "@/components/admin/BulkCreateAccounts";

interface ListedUser {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  email: string | null;
  emailVerified: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: number;
}

type EmailResult = { sent: true; to: string } | { sent: false; to: string; error: string };

interface ListResponse {
  users: ListedUser[];
  creatableRoles: Role[];
  allowedEmailDomains: string[] | null;
}

function CreateUserForm({ roles, onCreated }: { roles: Role[]; onCreated: (u: ListedUser) => void }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(roles.includes("FACULTY") ? "FACULTY" : roles[0]);
  const [initialPassword, setInitialPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ user: ListedUser; email: EmailResult } | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const res = await api<{ user: ListedUser; email: EmailResult }>("/api/users", { method: "POST", body: { displayName, email, role, initialPassword, username } });
      const { user } = res;
      setCreated(res);
      onCreated(user);
      setDisplayName("");
      setEmail("");
      setInitialPassword("");
      setUsername("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {created &&
        (created.email.sent ? (
          <FormMessage tone="success">
            <span data-testid="create-result">
              Created <strong>{created.user.displayName}</strong> ({ROLE_LABELS[created.user.role]}) and emailed their sign-in details to <strong>{created.email.to}</strong>: username{" "}
              <strong>{created.user.username}</strong>, the initial password and a sign-in link. At first sign-in they verify that address with a 6-digit code before choosing their own password.
            </span>
          </FormMessage>
        ) : (
          <FormMessage tone="error">
            <span data-testid="create-result">
              Created <strong>{created.user.displayName}</strong> (username <strong>{created.user.username}</strong>), but the email to {created.email.to} couldn&apos;t be sent: {created.email.error} Fix
              the email settings, then use <strong>Resend login details</strong> in the list below.
            </span>
          </FormMessage>
        ))}
      <div className="grid sm:grid-cols-2 gap-4">
        <TextField label="Full name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={busy} autoComplete="off" />
        <TextField
          label="Email address"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          autoComplete="off"
          hint="Their sign-in details are emailed here, and they confirm it with a code at first sign-in."
        />
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={busy}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        <TextField
          label="Username (optional)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={busy}
          autoComplete="off"
          hint="Leave blank to derive it from the email."
        />
        <div className="sm:col-span-2">
          <PasswordField
            label="Initial password (optional)"
            value={initialPassword}
            onChange={(e) => setInitialPassword(e.target.value)}
            disabled={busy}
            autoComplete="new-password"
            hint="Leave blank to generate a strong one. Either way it's emailed to them; at least 8 characters if you set it."
          />
        </div>
      </div>
      <Button type="submit" variant="primary" disabled={busy || !displayName || !email}>
        <UserPlus size={15} /> {busy ? "Creating & emailing…" : "Create account & email details"}
      </Button>
    </form>
  );
}

export default function UserManagementPage() {
  const { user: me, can } = useSession();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<ListedUser | null>(null);
  const [confirmResend, setConfirmResend] = useState<ListedUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setData(await api<ListResponse>("/api/users"));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load accounts.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const resend = async (u: ListedUser) => {
    setPendingId(u.id);
    setActionError(null);
    setNotice(null);
    try {
      const { to } = await api<{ user: ListedUser; to: string }>(`/api/users/${u.id}/resend-details`, { method: "POST" });
      setNotice(`New sign-in details sent to ${to}. The previous initial password no longer works.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't send the details.");
    } finally {
      setPendingId(null);
    }
  };

  const patch = async (u: ListedUser, body: { isActive?: boolean; role?: Role }) => {
    setPendingId(u.id);
    setActionError(null);
    setNotice(null);
    try {
      const { user } = await api<{ user: ListedUser }>(`/api/users/${u.id}`, { method: "PATCH", body });
      setData((d) => (d ? { ...d, users: d.users.map((x) => (x.id === user.id ? user : x)) } : d));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {can("users:create") && data && (
        <Card>
          <CardHeader
            title="Create an account"
            subtitle={data.creatableRoles.includes("ADMINISTRATOR") ? "Add an Administrator, HOD or Faculty member" : "Add an HOD or Faculty member — they get view and download access only"}
          />
          <CreateUserForm roles={data.creatableRoles} onCreated={(u) => setData((d) => (d ? { ...d, users: [...d.users, u] } : d))} />
        </Card>
      )}

      {can("users:create") && data && (
        <Card>
          <CardHeader title="Add many accounts" subtitle="Upload a staff list — everyone gets their own sign-in details by email" />
          <BulkCreateAccounts roles={data.creatableRoles} existing={data.users} allowedDomains={data.allowedEmailDomains} onDone={load} />
        </Card>
      )}

      <Card>
        <CardHeader
          title="Accounts"
          subtitle={data ? `${data.users.length} account${data.users.length === 1 ? "" : "s"}` : "Loading…"}
          actions={
            <Button size="sm" variant="ghost" onClick={load} aria-label="Refresh account list">
              <RefreshCcw size={13} />
            </Button>
          }
        />
        {loadError && <FormMessage tone="error">{loadError}</FormMessage>}
        {actionError && (
          <div className="mb-3">
            <FormMessage tone="error">{actionError}</FormMessage>
          </div>
        )}
        {notice && (
          <div className="mb-3">
            <FormMessage tone="success">{notice}</FormMessage>
          </div>
        )}
        {!data && !loadError && <p className="text-sm text-[var(--text-muted)]">Loading accounts…</p>}
        {data && (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--surface-muted)] text-left">
                  <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Name</th>
                  <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Username / email</th>
                  <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Role</th>
                  <th className="px-3 py-2 font-semibold text-[var(--text-secondary)]">Status</th>
                  <th className="px-3 py-2 font-semibold text-[var(--text-secondary)] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => {
                  const manageable = canManageUser({ id: me.id, role: me.role }, u);
                  const busy = pendingId === u.id;
                  return (
                    <tr key={u.id} className="border-t border-[var(--border)]" data-testid={`user-row-${u.username}`}>
                      <td className="px-3 py-2 font-medium text-[var(--text-primary)]">
                        {u.displayName}
                        {u.id === me.id && <span className="text-[var(--text-muted)] font-normal"> (you)</span>}
                      </td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">
                        <div>{u.username}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {u.email ?? "no email yet"} {u.emailVerified && "· verified"}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {manageable && data.creatableRoles.includes(u.role) ? (
                          <select
                            aria-label={`Role for ${u.displayName}`}
                            value={u.role}
                            disabled={busy}
                            onChange={(e) => patch(u, { role: e.target.value as Role })}
                            className="rounded border border-[var(--border-strong)] bg-[var(--surface)] px-1.5 py-1 text-xs"
                          >
                            {data.creatableRoles.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge tone={u.role === "CREATOR_ADMIN" || u.role === "ADMINISTRATOR" ? "accent" : "neutral"}>{ROLE_LABELS[u.role]}</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {!u.isActive ? (
                          <Badge tone="critical">Deactivated</Badge>
                        ) : u.mustChangePassword ? (
                          <Badge tone="warning">Awaiting first sign-in</Badge>
                        ) : (
                          <Badge tone="good">Active</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {manageable ? (
                          u.isActive ? (
                            <div className="inline-flex flex-wrap justify-end gap-1">
                              {u.mustChangePassword && u.email && (
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmResend(u)} aria-label={`Resend login details to ${u.displayName}`}>
                                  <Mail size={13} /> Resend login details
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmDeactivate(u)} className="!text-[var(--status-critical)]">
                                Deactivate
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => patch(u, { isActive: true })}>
                              Reactivate
                            </Button>
                          )
                        ) : (
                          <span className="text-[11px] text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {confirmResend && (
        <ConfirmDialog
          title={`Resend login details to ${confirmResend.displayName}?`}
          message={`A new initial password will be generated and emailed to ${confirmResend.email}. The one sent earlier will stop working.`}
          confirmLabel="Send new details"
          onCancel={() => setConfirmResend(null)}
          onConfirm={() => {
            const u = confirmResend;
            setConfirmResend(null);
            resend(u);
          }}
        />
      )}

      {confirmDeactivate && (
        <ConfirmDialog
          title={`Deactivate ${confirmDeactivate.displayName}?`}
          message="They'll be signed out everywhere immediately and won't be able to sign in until reactivated. Their account and history are kept."
          confirmLabel="Deactivate"
          onCancel={() => setConfirmDeactivate(null)}
          onConfirm={() => {
            const u = confirmDeactivate;
            setConfirmDeactivate(null);
            patch(u, { isActive: false });
          }}
        />
      )}
    </div>
  );
}
