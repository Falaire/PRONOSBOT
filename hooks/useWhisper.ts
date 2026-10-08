"use client";
import { useCallback, useState } from "react";
import type { SubtitleCue } from "@/lib/vision/types";

export function useWhisper() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const transcribe = useCallback(async (audio: Float32Array): Promise<SubtitleCue[]> => {
    setLoading(true); setProgress(0);
    try {
      const { pipeline } = await import("@xenova/transformers");
      const recognizer = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
        progress_callback: (event: { progress?: number }) => event.progress !== undefined && setProgress(event.progress),
      });
      const result = await recognizer(audio, { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 }) as { chunks?: Array<{ timestamp?: [number, number]; text?: string }> };
      return (result.chunks ?? []).map((chunk) => ({ start: chunk.timestamp?.[0] ?? 0, end: chunk.timestamp?.[1] ?? (chunk.timestamp?.[0] ?? 0) + 2, text: (chunk.text ?? "").trim() })).filter((cue) => cue.text.length > 0);
    } finally { setLoading(false); }
  }, []);
  return { transcribe, loading, progress };
}
