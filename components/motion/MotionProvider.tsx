"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Applique à toutes les animations motion-primitives la préférence « réduire les animations » du
 * système (reducedMotion="user") : les mouvements et transformations sont désactivés pour les
 * personnes qui le demandent, sans toucher au reste de l'interface.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
