import type { LandmarkPoint } from "@/lib/rendering/pose-renderer";

type Center = { x: number; y: number };
export type TrackedPose = {
  id: number;
  landmarks: LandmarkPoint[];
  center: Center;
  opacity: number;
  missedFrames: number;
  ageFrames: number;
};

type TrackState = TrackedPose & { velocity: Center };
type PoseTrackOptions = {
  maxPeople?: number;
  maxOccludedFrames?: number;
  predictFrames?: number;
  maxMatchDistance?: number;
  smoothing?: number;
};

const ROOT_KEYPOINTS = [11, 12, 23, 24];
const VISIBLE_THRESHOLD = 0.2;

function poseCenter(landmarks: LandmarkPoint[]): Center {
  const root = ROOT_KEYPOINTS
    .map((index) => landmarks[index])
    .filter((point) => point && (point.visibility ?? 1) >= VISIBLE_THRESHOLD);
  if (root.length) {
    return {
      x: root.reduce((sum, point) => sum + point.x, 0) / root.length,
      y: root.reduce((sum, point) => sum + point.y, 0) / root.length,
    };
  }
  const visible = landmarks.filter((point) => point && (point.visibility ?? 1) >= VISIBLE_THRESHOLD);
  if (!visible.length) return { x: 0.5, y: 0.5 };
  return {
    x: visible.reduce((sum, point) => sum + point.x, 0) / visible.length,
    y: visible.reduce((sum, point) => sum + point.y, 0) / visible.length,
  };
}

function distance(a: Center, b: Center) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function blendPose(previous: LandmarkPoint[], next: LandmarkPoint[], alpha: number): LandmarkPoint[] {
  return next.map((point, index) => {
    const old = previous[index];
    if (!old) return { ...point };
    if ((point.visibility ?? 1) < VISIBLE_THRESHOLD) return { ...old, visibility: point.visibility };
    return {
      ...point,
      x: old.x + (point.x - old.x) * alpha,
      y: old.y + (point.y - old.y) * alpha,
    };
  });
}

function translatePose(landmarks: LandmarkPoint[], dx: number, dy: number): LandmarkPoint[] {
  return landmarks.map((point) => ({
    ...point,
    x: Math.max(0, Math.min(1, point.x + dx)),
    y: Math.max(0, Math.min(1, point.y + dy)),
  }));
}

/**
 * Petit tracker local pour le prototype à deux personnes.
 * Il associe les poses à leur centre prédit et choisit la meilleure permutation
 * globale au lieu de supposer que l'ordre MediaPipe reste fixe d'une image à l'autre.
 */
export class PoseTrackManager {
  private readonly maxPeople: number;
  private readonly maxOccludedFrames: number;
  private readonly predictFrames: number;
  private readonly maxMatchDistance: number;
  private readonly smoothing: number;
  private tracks = new Map<number, TrackState>();
  private nextId = 1;

  constructor(options: PoseTrackOptions = {}) {
    this.maxPeople = options.maxPeople ?? 2;
    this.maxOccludedFrames = options.maxOccludedFrames ?? 12;
    this.predictFrames = options.predictFrames ?? 3;
    this.maxMatchDistance = options.maxMatchDistance ?? 0.32;
    this.smoothing = options.smoothing ?? 0.55;
  }

  reset() {
    this.tracks.clear();
    this.nextId = 1;
  }

  update(detections: LandmarkPoint[][]): TrackedPose[] {
    const poses = detections
      .filter((landmarks) => landmarks.length >= 29 && landmarks.some((point) => (point.visibility ?? 1) >= VISIBLE_THRESHOLD))
      .slice(0, this.maxPeople);
    const centers = poses.map(poseCenter);
    const active = [...this.tracks.values()].filter((track) => track.missedFrames <= this.maxOccludedFrames);
    const assignment = this.bestAssignment(active, centers);
    const matchedDetections = new Set<number>();
    const updated = new Map<number, TrackState>();

    active.forEach((track, trackIndex) => {
      const detectionIndex = assignment[trackIndex];
      if (detectionIndex >= 0) {
        matchedDetections.add(detectionIndex);
        const detection = poses[detectionIndex];
        const detectionCenter = centers[detectionIndex];
        const instantaneousVelocity = {
          x: detectionCenter.x - track.center.x,
          y: detectionCenter.y - track.center.y,
        };
        const velocity = {
          x: track.velocity.x * 0.68 + instantaneousVelocity.x * 0.32,
          y: track.velocity.y * 0.68 + instantaneousVelocity.y * 0.32,
        };
        const landmarks = blendPose(track.landmarks, detection, this.smoothing);
        updated.set(track.id, {
          ...track,
          landmarks,
          center: poseCenter(landmarks),
          velocity,
          opacity: 1,
          missedFrames: 0,
          ageFrames: track.ageFrames + 1,
        });
      } else {
        const missedFrames = track.missedFrames + 1;
        const dx = missedFrames <= this.predictFrames ? track.velocity.x : 0;
        const dy = missedFrames <= this.predictFrames ? track.velocity.y : 0;
        const landmarks = translatePose(track.landmarks, dx, dy);
        updated.set(track.id, {
          ...track,
          landmarks,
          center: poseCenter(landmarks),
          opacity: Math.max(0, 1 - missedFrames / (this.maxOccludedFrames + 1)),
          missedFrames,
          ageFrames: track.ageFrames + 1,
        });
      }
    });

    poses.forEach((landmarks, index) => {
      if (matchedDetections.has(index)) return;
      const id = this.nextId++;
      updated.set(id, {
        id,
        landmarks: landmarks.map((point) => ({ ...point })),
        center: centers[index],
        velocity: { x: 0, y: 0 },
        opacity: 1,
        missedFrames: 0,
        ageFrames: 1,
      });
    });

    this.tracks = new Map(
      [...updated.entries()].filter(([, track]) => track.missedFrames <= this.maxOccludedFrames)
    );
    return [...this.tracks.values()]
      .sort((a, b) => a.id - b.id)
      .map(({ id, landmarks, center, opacity, missedFrames, ageFrames }) => ({
        id,
        landmarks: landmarks.map((point) => ({ ...point })),
        center: { ...center },
        opacity,
        missedFrames,
        ageFrames,
      }));
  }

  private bestAssignment(tracks: TrackState[], centers: Center[]): number[] {
    if (!tracks.length) return [];
    const unmatchedCost = 0.18;
    let bestCost = Number.POSITIVE_INFINITY;
    let best = tracks.map(() => -1);
    const current = tracks.map(() => -1);

    const visit = (trackIndex: number, used: Set<number>, cost: number) => {
      if (cost >= bestCost) return;
      if (trackIndex === tracks.length) {
        const newTrackCost = cost + (centers.length - used.size) * unmatchedCost;
        if (newTrackCost < bestCost) {
          bestCost = newTrackCost;
          best = [...current];
        }
        return;
      }

      current[trackIndex] = -1;
      visit(trackIndex + 1, used, cost + unmatchedCost);
      const track = tracks[trackIndex];
      const predictionSteps = Math.min(track.missedFrames + 1, this.predictFrames + 1);
      const predicted = {
        x: track.center.x + track.velocity.x * predictionSteps,
        y: track.center.y + track.velocity.y * predictionSteps,
      };
      centers.forEach((candidate, detectionIndex) => {
        if (used.has(detectionIndex)) return;
        const matchCost = distance(predicted, candidate);
        if (matchCost > this.maxMatchDistance) return;
        current[trackIndex] = detectionIndex;
        used.add(detectionIndex);
        visit(trackIndex + 1, used, cost + matchCost);
        used.delete(detectionIndex);
      });
      current[trackIndex] = -1;
    };

    visit(0, new Set<number>(), 0);
    return best;
  }
}
