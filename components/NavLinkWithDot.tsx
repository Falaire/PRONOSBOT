"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NavDot, markNavSeen } from "@/components/NavDot";

/**
 * Lien de navigation avec un point de nouveauté (voir components/NavDot.tsx).
 * Au clic, l'horodatage `latestAt` est mémorisé : le point disparaît jusqu'à la prochaine nouveauté.
 */
export function NavLinkWithDot({
  href,
  storageKey,
  latestAt,
  className,
  dotClassName,
  children,
}: {
  href: string;
  storageKey: string;
  latestAt: string | null;
  className?: string;
  dotClassName?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() => markNavSeen(storageKey, latestAt)}
      className={cn("relative", className)}
    >
      {children}
      <NavDot href={href} storageKey={storageKey} latestAt={latestAt} className={dotClassName} />
    </Link>
  );
}
