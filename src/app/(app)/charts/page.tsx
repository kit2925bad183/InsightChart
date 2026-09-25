"use client";

import { useApp } from "@/context/AppContext";
import { UploadArea } from "@/components/upload/UploadArea";
import { MappingPanel } from "@/components/mapping/MappingPanel";
import { ChartWorkspace } from "@/components/dashboard/ChartWorkspace";

export default function ChartsPage() {
  const { activeSheet } = useApp();

  if (!activeSheet) return <UploadArea />;

  return (
    <>
      <MappingPanel />
      <ChartWorkspace />
    </>
  );
}
