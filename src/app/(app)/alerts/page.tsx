"use client";

import { useApp, useRecords } from "@/context/AppContext";
import { UploadArea } from "@/components/upload/UploadArea";
import { NaturalLanguageBox } from "@/components/dashboard/NaturalLanguageBox";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { AlertsList } from "@/components/dashboard/AlertsList";

export default function AlertsPage() {
  const { state, activeSheet } = useApp();
  const records = useRecords();

  if (!activeSheet) return <UploadArea />;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <NaturalLanguageBox resetToken={state.loadNonce} records={records} />
        <InsightsPanel records={records} bands={state.scoreBands} supportThreshold={state.thresholdSupport} />
      </div>
      <AlertsList records={records} thresholdSupport={state.thresholdSupport} />
    </div>
  );
}
