import type { Metadata } from "next";
import { PostForm } from "@/components/listing/PostForm";

export const metadata: Metadata = {
  title: "نشر إعلان",
  robots: { index: false, follow: false },
};

export default function PostPage() {
  return (
    <div className="rounded-card border-border bg-surface mx-auto max-w-3xl border p-4 sm:p-6">
      <h1 className="mb-6 text-2xl font-black">نشر إعلان جديد</h1>
      <PostForm />
    </div>
  );
}
