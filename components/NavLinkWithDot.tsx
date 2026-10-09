"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Préfixe des clés localStorage : une clé par lien de navigation (ex: kp_nav_seen_matchs). */
const STORAGE_PREFIX = "kp_nav_seen_";

/**
 * Lien de navigation avec un petit point coloré tant qu'il y a du nouveau.
 *
 * - `latestAt` : horodatage (ISO) du dernier élément « nouveau » pour ce lien, calculé côté serveur.
 * - Le point apparaît si `latestAt` est postérieur à la valeur mémorisée dans localStorage
 *   (clé `storageKey`). Au clic sur le lien (ou si on est déjà sur la page), on mémorise
 *   `latestAt` : le point disparaît jusqu'à la prochaine nouveauté.
 *
 * Le point est calculé après le montage (useEffect) pour éviter tout décalage d'hydratation,
 * puisque localStorage n'existe pas côté serveur.
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
  const pathname = usePathname();
  const [hasDot, setHasDot] = useState(false);
  const fullKey = `${STORAGE_PREFIX}${storageKey}`;

  useEffect(() => {
    if (!latestAt) {
      setHasDot(false);
      return;
    }
    // Déjà sur la page du lien : on considère le contenu comme vu.
    if (pathname === href) {
      markSeen(fullKey, latestAt);
      setHasDot(false);
      return;
    }
    const seen = readSeen(fullKey);
    setHasDot(!seen || new Date(latestAt) > new Date(seen));
  }, [latestAt, pathname, href, fullKey]);

  function handleClick() {
    if (latestAt) markSeen(fullKey, latestAt);
    setHasDot(false);
  }

  return (
    <Link href={href} onClick={handleClick} className={cn("relative", className)}>
      {children}
      {hasDot && (
        <span
          aria-label="Nouveautés"
          className={cn(
            "absolute h-2 w-2 rounded-full bg-accent-500 ring-2 ring-ink-950 shadow-glow-accent",
            dotClassName ?? "top-1.5 right-[30%]"
          )}
        />
      )}
    </Link>
  );
}

function readSeen(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Stockage indisponible (navigation privée stricte, etc.) : on considère rien comme vu.
    return null;
  }
}

function markSeen(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignoré : le point réapparaîtra au prochain chargement, ce qui reste sans gravité.
  }
}
