import type { Metadata } from "next";
import { BellRing } from "lucide-react";
import { requirePermission } from "@/server/auth";
import { countRecipients } from "@/server/broadcast";
import { adminDb } from "@/lib/firebase/admin";
import { formatFullDateTime } from "@/lib/datetime";
import { BroadcastPanel } from "@/components/admin/BroadcastPanel";

export const metadata: Metadata = {
  title: "إشعار عام",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Past = {
  id: string;
  title: string;
  body: string;
  sentAt: number;
  sent: number;
  users: number;
};

/** The last few, so the screen shows what has already been said to everyone. */
async function recent(): Promise<Past[]> {
  try {
    const snap = await adminDb()
      .collection("broadcasts")
      .orderBy("sentAt", "desc")
      .limit(10)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Past);
  } catch (error) {
    console.error("[broadcast] history read failed:", error);
    return [];
  }
}

export default async function NotificationsPage() {
  await requirePermission("push.broadcast", "/admin/notifications");

  // Both wrapped by their own readers: a count that fails must not take the
  // screen down, since the send itself does not depend on it.
  const [reach, history] = await Promise.all([
    countRecipients().catch(() => ({ users: 0, devices: 0 })),
    recent(),
  ]);

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-black">
        <BellRing className="size-6" />
        إشعار عام
      </h1>
      <p className="text-muted mt-1 text-sm leading-relaxed">
        رسالة وحدة توصل لكل واحد فعّل التنبيهات. تظهرلو على الهاتف حتى كي يكون
        الموقع مسكّر.
      </p>

      <BroadcastPanel users={reach.users} devices={reach.devices} />

      {history.length > 0 && (
        <section className="mt-8">
          <h2 className="font-extrabold">اللي تبعث من قبل</h2>
          <ul className="mt-3 space-y-2">
            {history.map((b) => (
              <li
                key={b.id}
                className="rounded-card border-border bg-surface border p-3.5"
              >
                <p className="text-[15px] font-extrabold">{b.title}</p>
                <p className="text-muted mt-1 text-sm leading-relaxed">
                  {b.body}
                </p>
                <p className="text-dim ltr-nums mt-1.5 text-xs font-semibold">
                  {formatFullDateTime(b.sentAt)} · وصل {b.sent} جهاز · {b.users}{" "}
                  حساب
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
