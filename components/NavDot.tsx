"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Préfixe des clés localStorage : une clé par lien de navigation (ex: kp_nav_seen_matchs). */
const STORAGE_PREFIX = "kp_nav_seen_";

export function navSeenKey(storageKey: string): string {
  return `${STORAGE_PREFIX}${storageKey}`;
}

/** Mémorise l'horodatage vu pour un lien : le point disparaît tant qu'aucune nouveauté plus récente n'arrive. */
export function markNavSeen(storageKey: string, latestAt: string | null) {
  if (!latestAt) return;
  try {
    window.localStorage.setItem(navSeenKey(storageKey), latestAt);
  } catch {
    // Stockage indisponible : le point réapparaîtra au prochain chargement, sans gravité.
  }
}

function readSeen(storageKey: string): string | null {
  try {
    return window.localStorage.getItem(navSeenKey(storageKey));
  } catch {
    return null;
  }
}

/**
 * Point de nouveauté pour un lien de navigation.
 * - Visible si `latestAt` est postérieur à la valeur mémorisée (localStorage, clé `storageKey`).
 * - Si l'utilisateur est déjà sur la page du lien (`href`), on considère le contenu comme vu.
 * Calculé après le montage (useEffect) : localStorage n'existe pas côté serveur, pas de décalage
 * d'hydratation.
 */
export function useNavDot(href: string, storageKey: string, latestAt: string | null): boolean {
  const pathname = usePathname();
  const [hasDot, setHasDot] = useState(false);

  useEffect(() => {
    if (!latestAt) {
      setHasDot(false);
      return;
    }
    if (pathname === href) {
      markNavSeen(storageKey, latestAt);
      setHasDot(false);
      return;
    }
    const seen = readSeen(storageKey);
    setHasDot(!seen || new Date(latestAt) > new Date(seen));
  }, [latestAt, pathname, href, storageKey]);

  return hasDot;
}

/** Petit point coloré à placer dans un élément `relative`. Rien n'est rendu s'il n'y a pas de nouveauté. */
export function NavDot({
  href,
  storageKey,
  latestAt,
  className,
}: {
  href: string;
  storageKey: string;
  latestAt: string | null;
  className?: string;
}) {
  const hasDot = useNavDot(href, storageKey, latestAt);
  if (!hasDot) return null;
  return (
    <span
      aria-label="Nouveautés"
      className={cn(
        "absolute h-2 w-2 rounded-full bg-accent-500 ring-2 ring-ink-950 shadow-glow-accent",
        className ?? "top-1.5 right-[30%]"
      )}
    />
  );
}
