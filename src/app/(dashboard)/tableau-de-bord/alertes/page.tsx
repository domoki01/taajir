import type { Metadata } from "next";
import {
  AlertsManager,
  type AlertRow,
} from "@/components/dashboard/AlertsManager";
import { requireUser } from "@/server/auth";
import { countMyDevices, listMySavedSearches } from "@/server/savedSearches";
import { formatFullDateTime } from "@/lib/datetime";
import { searchHref } from "@/lib/searchHref";
import { kMaxSavedSearches } from "@/lib/constants";

export const metadata: Metadata = {
  title: "تنبيهاتي",
  robots: { index: false, follow: false },
};

export default async function AlertsPage() {
  const user = await requireUser("/tableau-de-bord/alertes");
  const [searches, devices] = await Promise.all([
    listMySavedSearches(user.uid),
    countMyDevices(user.uid),
  ]);

  // Dates are formatted here, in Africa/Algiers, and handed down as strings —
  // formatting inside the client component renders UTC on the server and local
  // time in the browser, which React reports as a hydration mismatch.
  const alerts: AlertRow[] = searches.map((s) => ({
    id: s.id,
    label: s.label,
    notify: s.notify,
    matchCount: s.matchCount ?? 0,
    createdAtLabel: formatFullDateTime(s.createdAt),
    lastNotifiedLabel: s.lastNotifiedAt
      ? formatFullDateTime(s.lastNotifiedAt)
      : null,
    href: searchHref(s),
  }));

  return (
    <div>
      <h1 className="text-2xl font-extrabold">تنبيهاتي</h1>
      <p className="text-muted mt-2 text-sm">
        نبّهني بالإعلانات الجديدة اللي تشبه بحثك المحفوظ.
      </p>

      <AlertsManager
        alerts={alerts}
        deviceCount={devices}
        max={kMaxSavedSearches}
      />
    </div>
  );
}
