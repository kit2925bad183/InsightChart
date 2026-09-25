"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { can as canRole, type Permission, type Role } from "./permissions";

/** The signed-in user as the browser sees them. Used only to decide what to *show* —
 * every action is independently authorised by the API. */
export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  email: string | null;
  emailVerified: boolean;
  /** Still using the initial password set by an administrator / the environment. */
  mustChangePassword: boolean;
}

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useSession must be used inside SessionProvider");
  const can = useCallback((p: Permission) => canRole(user.role, p), [user.role]);
  return useMemo(() => ({ user, can }), [user, can]);
}

/** Non-throwing variant for components that also render outside the signed-in shell. */
export function useOptionalSession() {
  return useContext(SessionContext);
}
