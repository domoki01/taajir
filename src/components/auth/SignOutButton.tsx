"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export function SignOutButton() {
  const router = useRouter();

  async function onClick() {
    // Clear both halves: the client SDK's own state and the server cookie.
    // Dropping only one leaves the user signed in from the other's point of view.
    await signOut(auth).catch(() => {});
    await fetch("/api/auth/session", { method: "DELETE" });
    router.replace("/");
    router.refresh();
  }

  // Shaped like the rows above it so the account screen reads as one list, and
  // in red because signing out is the one thing on that screen you cannot undo
  // with the back button.
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-card border-border bg-surface active:bg-surface-soft flex min-h-14 w-full items-center gap-3 border px-4 py-3 text-start transition-colors"
    >
      <span className="bg-danger/10 text-danger grid size-9 shrink-0 place-items-center rounded-[10px]">
        <LogOut className="size-[18px]" strokeWidth={2.3} />
      </span>
      <span className="text-danger flex-1 text-sm font-bold">خروج</span>
    </button>
  );
}
