"use client";

import { useRouter } from "next/navigation";
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

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-muted hover:text-danger text-sm font-bold transition-colors"
    >
      خروج
    </button>
  );
}
