import { AppProvider } from "@/context/AppContext";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function Home() {
  return (
    <AppProvider>
      <DashboardShell />
    </AppProvider>
  );
}
