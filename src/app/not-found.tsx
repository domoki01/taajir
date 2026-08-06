import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="flex-1 py-20">
        <Container className="max-w-md text-center">
          <p className="text-primary ltr-nums text-5xl font-black">404</p>
          <h1 className="mt-4 text-xl font-extrabold">ما لقيناش هذه الصفحة</h1>
          <p className="text-muted mt-2 leading-relaxed">
            يمكن الإعلان تحيّد ولا الرابط فيه غلطة.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="bg-accent rounded-input px-5 py-3 text-sm font-bold text-white"
            >
              الصفحة الرئيسية
            </Link>
            <Link
              href="/vente"
              className="rounded-input border-border bg-surface border px-5 py-3 text-sm font-bold"
            >
              تصفّح الإعلانات
            </Link>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
