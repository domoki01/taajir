import { AppBar } from "@/components/app/AppBar";
import { Header } from "@/components/layout/Header";
import { requireStaff } from "@/server/auth";

/**
 * The admin shell.
 *
 * requireStaff redirects anyone holding no permission at all before any child
 * renders. Every page under here guards itself again, and so does every Server
 * Action behind it — reaching this layout is never treated as proof of
 * anything.
 *
 * There is no navigation in the shell any more. It carried thirteen identical
 * pills, then a desktop sidebar, and both were the same mistake in different
 * clothes: furniture from a web page wrapped around what people open on a
 * phone. The destinations live on the admin's own home screen as grouped rows,
 * and every screen inside the section has one way back to it.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff();

  return (
    <>
      <Header />
      <AppBar root="/admin" label="الإشراف" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-10">
        {children}
      </main>
    </>
  );
}
