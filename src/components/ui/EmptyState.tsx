import { SearchX } from "lucide-react";

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-card border-border bg-surface flex flex-col items-center gap-3 border border-dashed px-6 py-16 text-center">
      <span className="bg-surface-soft text-dim grid size-14 place-items-center rounded-full">
        <SearchX className="size-7" />
      </span>
      <p className="text-base font-bold">{title}</p>
      {body && (
        <p className="text-muted max-w-sm text-sm leading-relaxed">{body}</p>
      )}
    </div>
  );
}
