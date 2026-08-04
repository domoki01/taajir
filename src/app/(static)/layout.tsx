import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";

/** Shared shell for the legal and help pages, which are all prose. */
export default function StaticLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-1 py-10">
        <Container className="max-w-3xl">
          <div className="[&_h1]:mb-6 [&_h1]:text-2xl [&_h1]:font-black md:[&_h1]:text-3xl [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-extrabold [&_li]:leading-loose [&_p]:leading-loose [&_p]:text-[color:var(--color-muted)] [&_ul]:list-disc [&_ul]:ps-5">
            {children}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
