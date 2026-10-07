import { cn } from "@/lib/utils";

/**
 * The Duka Magic Expressway logo mark (public/logo.png artwork).
 * Uses the 192px favicon export - sharp at header sizes on retina screens,
 * and ~46 KB instead of the 600 KB original.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src="/favicon_io/android-chrome-192x192.png"
      alt="Duka Magic Expressway"
      width={48}
      height={48}
      className={cn("size-11 shrink-0 rounded-xl object-cover shadow-sm", className)}
    />
  );
}
