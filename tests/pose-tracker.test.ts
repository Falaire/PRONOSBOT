import test from "node:test";
import assert from "node:assert/strict";
import { PoseTrackManager } from "../lib/tracking/pose-tracker";
import type { LandmarkPoint } from "../lib/rendering/pose-renderer";

function poseAt(centerX: number, centerY = 0.5): LandmarkPoint[] {
  const pose = Array.from({ length: 33 }, () => ({ x: centerX, y: centerY, visibility: 1 }));
  pose[11] = { x: centerX - 0.04, y: centerY - 0.12, visibility: 1 };
  pose[12] = { x: centerX + 0.04, y: centerY - 0.12, visibility: 1 };
  pose[23] = { x: centerX - 0.03, y: centerY + 0.12, visibility: 1 };
  pose[24] = { x: centerX + 0.03, y: centerY + 0.12, visibility: 1 };
  pose[0] = { x: centerX, y: centerY - 0.28, visibility: 1 };
  return pose;
}

test("PoseTrackManager garde les identifiants quand MediaPipe inverse l'ordre de sortie", () => {
  const tracker = new PoseTrackManager();
  const first = tracker.update([poseAt(0.2), poseAt(0.8)]);
  assert.deepEqual(first.map((track) => track.id), [1, 2]);

  const next = tracker.update([poseAt(0.76), poseAt(0.24)]);
  const left = next.find((track) => track.id === 1);
  const right = next.find((track) => track.id === 2);
  assert.ok(left && right);
  assert.ok(left.center.x < right.center.x, "les pistes ne doivent pas échanger d'identité");
});

test("PoseTrackManager prédit une courte occultation puis reprend la même piste", () => {
  const tracker = new PoseTrackManager({ maxOccludedFrames: 4, predictFrames: 2 });
  const first = tracker.update([poseAt(0.3)]);
  const id = first[0].id;
  tracker.update([poseAt(0.34)]);
  const hidden = tracker.update([]);
  assert.equal(hidden[0].id, id);
  assert.equal(hidden[0].missedFrames, 1);
  assert.ok(hidden[0].opacity < 1 && hidden[0].opacity > 0);

  const recovered = tracker.update([poseAt(0.39)]);
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].id, id);
  assert.equal(recovered[0].missedFrames, 0);
});

test("PoseTrackManager retire une piste après la fenêtre de rétention", () => {
  const tracker = new PoseTrackManager({ maxOccludedFrames: 2 });
  const first = tracker.update([poseAt(0.4)]);
  const id = first[0].id;
  tracker.update([]);
  tracker.update([]);
  const expired = tracker.update([]);
  assert.equal(expired.length, 0);
  const replacement = tracker.update([poseAt(0.4)]);
  assert.notEqual(replacement[0].id, id);
});
