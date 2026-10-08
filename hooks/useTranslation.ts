"use client";

import { useCallback, useState } from "react";
import type { SubtitleCue } from "@/lib/vision/types";

/** Traduction locale des sous-titres via NLLB-200, sans API distante. */
export function useTranslation() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const translate = useCallback(async (cues: SubtitleCue[], sourceLanguage = "fra_Latn") => {
    setLoading(true);
    setProgress(0);
    setError(null);

    try {
      const { pipeline } = await import("@xenova/transformers");
      const translator = await pipeline(
        "translation",
        "Xenova/nllb-200-distilled-600M",
        { progress_callback: (event: { progress?: number }) => {
          if (event.progress !== undefined) setProgress(event.progress);
        } }
      );

      const translated: SubtitleCue[] = [];
      for (let index = 0; index < cues.length; index += 1) {
        const cue = cues[index];
        // Les options NLLB ne sont pas encore déclarées dans les types de Transformers.js 2.x.
        const result = await (translator as any)(cue.text, {
          src_lang: sourceLanguage,
          tgt_lang: "eng_Latn",
        });
        const text = Array.isArray(result) ? String(result[0]?.translation_text ?? "") : "";
        translated.push({ ...cue, text });
        setProgress(Math.round(((index + 1) / cues.length) * 100));
      }
      return translated;
    } catch (cause) {
      console.error(cause);
      setError("La traduction locale a échoué. Réessayez avec une connexion active au premier chargement.");
      throw cause;
    } finally {
      setLoading(false);
    }
  }, []);

  return { translate, loading, progress, error };
}
