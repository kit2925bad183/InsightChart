import { redirect } from "next/navigation";
import { AppProvider } from "@/context/AppContext";
import { AssessmentFilesProvider } from "@/context/AssessmentFilesContext";
import { AppShell } from "@/components/shell/AppShell";
import { SessionProvider } from "@/lib/auth/session";
import { getPageSession, toSessionUser } from "@/server/pageSession";

// Second line of defence behind the proxy: every page in this group renders only for a
// fully activated session, and the signed-in user is handed to the client from here.
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getPageSession();
  if (!ctx) redirect("/login");
  if (ctx.session.stage !== "active") redirect("/first-login");

  return (
    <SessionProvider user={toSessionUser(ctx.user)}>
      <AppProvider>
        <AssessmentFilesProvider>
          <AppShell>{children}</AppShell>
        </AssessmentFilesProvider>
      </AppProvider>
    </SessionProvider>
  );
}
