export type VideoToVideoModel = {
  id: string;
  name: string;
  endpoint: string;
  description: string;
};

/** Modèles vidéo-à-vidéo connus dans le catalogue Open-Generative-AI. */
export const VIDEO_TO_VIDEO_MODELS: VideoToVideoModel[] = [
  {
    id: "runway-aleph-v2v",
    name: "Runway Aleph · vidéo-à-vidéo",
    endpoint: "runway-aleph-v2v",
    description: "Transformation de style guidée par prompt; la conservation exacte des personnes n’est pas garantie.",
  },
];
