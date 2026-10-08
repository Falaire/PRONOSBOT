export type Point2D = { x: number; y: number; z?: number; visibility?: number };
export type SubtitleCue = { start: number; end: number; text: string };
export type PoseFrame = { timestamp: number; landmarks: Point2D[]; mouthOpen: number; personId?: number };
export type ProcessingSettings = { width: number; height: number; fps: number; smoothing: number; background: string; lineColor: string; lineWidth: number; showSubtitles: boolean; showMicrophone: boolean };
