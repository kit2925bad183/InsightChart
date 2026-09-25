// Each signed-out page renders its own <AuthFrame> so the sign-in page alone can use the
// branded background.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
