"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The pre-launch countdown, plus the poll that lets the page open itself.
 *
 * The clock starts at null and fills in after mount. A countdown computed
 * during render is a different number on the server than in the browser, which
 * React reports as a hydration mismatch and repairs by throwing away the server
 * HTML — so the first paint deliberately shows nothing rather than a number
 * that is wrong by the length of the request.
 */
export function Countdown({ launchAt }: { launchAt: number | null }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Someone can be sitting on this page when the admin throws the switch, and
  // the whole point of the page is that they do not have to guess. Polled
  // rather than pushed: one small request every fifteen seconds costs less than
  // holding a socket open for every visitor waiting for a launch.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/launch-state", { cache: "no-store" });
        const data = await res.json();
        if (data.state === "active") router.push("/");
      } catch {
        // Offline, or the request lost a race with a deploy. Try again next tick.
      }
    }, 15_000);
    return () => clearInterval(id);
  }, [router]);

  if (launchAt == null) {
    return (
      <p className="text-muted text-sm font-semibold">
        ما زال ما تحدّدش التاريخ بالضبط — نبّهوك كي يتفتح.
      </p>
    );
  }

  const left = now == null ? null : Math.max(0, launchAt - now);

  const parts =
    left == null
      ? null
      : {
          d: Math.floor(left / 86_400_000),
          h: Math.floor((left / 3_600_000) % 24),
          m: Math.floor((left / 60_000) % 60),
          s: Math.floor((left / 1000) % 60),
        };

  if (parts && left === 0) {
    return (
      <p
        role="status"
        className="text-primary text-lg font-extrabold"
        aria-live="polite"
      >
        الوقت كمل — الموقع راه يتفتح، اصبر شويّة.
      </p>
    );
  }

  return (
    <div
      className="flex items-stretch justify-center gap-2"
      role="timer"
      aria-live="off"
    >
      {(
        [
          ["يوم", parts?.d],
          ["ساعة", parts?.h],
          ["دقيقة", parts?.m],
          ["ثانية", parts?.s],
        ] as const
      ).map(([label, value]) => (
        <div
          key={label}
          className="rounded-card bg-primary min-w-16 px-3 py-3 text-center text-white"
        >
          <span className="ltr-nums block text-2xl font-black tabular-nums">
            {value == null ? "—" : String(value).padStart(2, "0")}
          </span>
          <span className="block text-[11px] font-bold opacity-75">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
