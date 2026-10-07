"use client";

import { useEffect } from "react";

/** Enregistre le service worker minimal (voir public/sw.js) nécessaire à l'installabilité PWA. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Pas grave si ça échoue (ex: navigateur ancien) : le site reste utilisable normalement,
        // seule l'option "Installer" risque de ne pas apparaître.
      });
    }
  }, []);

  return null;
}
