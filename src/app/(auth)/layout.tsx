import { Container } from "@/components/layout/Container";

/**
 * Signing in is a step in a flow, not a destination.
 *
 * No header, and `isImmersiveRoute` stands the bottom nav down here too. The
 * menu was offering «الرئيسية · بحث · طلبات · حسابي» halfway through the funnel
 * — four ways out of a form the visitor is two taps from finishing, and while
 * the site is held every one of those destinations is closed. The back bar at
 * the top is the one way back, which is the only one that makes sense here.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <main className="flex flex-1 items-center py-10">
        <Container className="max-w-md">
          <div className="rounded-card border-border bg-surface shadow-soft border p-6">
            {children}
          </div>
        </Container>
      </main>
    </>
  );
}
