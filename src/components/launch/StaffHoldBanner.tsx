import Link from "next/link";
import { EyeOff } from "lucide-react";

/**
 * Shown to staff only, on every page, while the site is held.
 *
 * Staff walk through the pre-launch gate so they can review what is queued —
 * which means the site looks completely normal to the one group who most needs
 * to remember it is closed. This is the reminder, and a one-click way to the
 * switch.
 */
export function StaffHoldBanner() {
  return (
    <div className="bg-warning/10 text-warning border-warning/20 border-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2 text-xs font-bold">
        <EyeOff className="size-4 shrink-0" />
        الموقع مغلق للعموم — راك تشوفه لأنك من الإدارة.
        <Link href="/admin/lancement" className="ms-auto underline">
          لوحة الإطلاق
        </Link>
      </div>
    </div>
  );
}
