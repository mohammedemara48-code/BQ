import { BadgeCheck } from "lucide-react";
import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  src,
  size = "md",
  online,
  verified,
  className,
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl" | "hero";
  online?: boolean;
  verified?: boolean;
  className?: string;
}) {
  const dim =
    size === "sm"
      ? "size-10 text-xs"
      : size === "lg"
        ? "size-16 text-lg"
        : size === "xl"
          ? "size-24 text-2xl"
          : size === "hero"
            ? "size-36 text-3xl"
            : "size-12 text-sm";
  const dot =
    size === "sm" ? "size-2.5" : size === "hero" || size === "xl" ? "size-4" : "size-3";
  const badge =
    size === "sm" ? "size-3.5" : size === "hero" || size === "xl" ? "size-6" : "size-4";

  return (
    <span className={cn("relative inline-grid shrink-0", className)}>
      <span
        className={cn(
          "rounded-full",
          verified
            ? "bg-primary p-[3px] shadow-[var(--shadow-glow)]"
            : "p-px",
        )}
      >
        {src ? (
          <img
            src={src}
            alt=""
            className={cn("rounded-full object-cover bg-elevated", dim)}
            style={{ objectPosition: "50% 28%" }}
          />
        ) : (
          <span
            className={cn(
              "grid place-items-center rounded-full bg-secondary/40 font-medium text-fg",
              dim,
            )}
          >
            {initials(name)}
          </span>
        )}
      </span>
      {verified ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -end-0.5 grid place-items-center rounded-full bg-primary text-primary-fg ring-2 ring-bg",
            badge,
          )}
        >
          <BadgeCheck className="size-[70%]" />
        </span>
      ) : online ? (
        <span
          className={cn(
            "absolute bottom-0 start-0 rounded-full bg-online ring-2 ring-bg",
            dot,
          )}
        />
      ) : null}
    </span>
  );
}
