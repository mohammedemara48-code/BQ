import { cn } from "@/lib/utils";

export function BqMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("shrink-0 rounded-[22%] bg-elevated ring-1 ring-border", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#10101c" />
      <rect x="8" y="7" width="6" height="18" rx="1.6" fill="#FF3D9A" />
      <circle cx="17" cy="12.2" r="5.5" fill="#FF3D9A" />
      <circle cx="17.4" cy="20.4" r="6.1" fill="#FF3D9A" />
      <circle cx="16.6" cy="12.2" r="2.25" fill="#10101c" />
      <circle cx="17" cy="20.5" r="2.55" fill="#10101c" />
    </svg>
  );
}

export function BqWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <BqMark className="size-9" />
      <span className="font-display text-xl font-semibold tracking-tight text-fg">
        BQ
      </span>
    </div>
  );
}
