import { Header } from "@/components/layout/Header";
import { Container } from "@/components/layout/Container";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
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
