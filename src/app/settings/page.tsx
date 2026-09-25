"use client";

import { useApp } from "@/context/AppContext";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { SettingsPanel } from "@/components/dashboard/SettingsPanel";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import { useActingAsRole } from "@/lib/uiPrefs";

export default function SettingsPage() {
  const { activeSheet } = useApp();
  const [role, setRole] = useActingAsRole();

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Role" subtitle="Which sidebar pages you see in this browser" />
        <Select label="Acting as" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          This changes what you see in this browser only — InsightChart has no server or accounts, so it does not
          restrict or protect any data.
        </p>
      </Card>
      {activeSheet && <SettingsPanel />}
    </div>
  );
}
