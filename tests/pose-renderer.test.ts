import test from "node:test";
import assert from "node:assert/strict";
import { createMultiPoseTransform, createSceneTransform, estimatePoseScaleReference, mapPoseToCanvas, retargetPoseToSlot } from "../lib/rendering/pose-renderer";
import type { LandmarkPoint } from "../lib/rendering/pose-renderer";

function centeredPose(centerX = 0.5, headY = 0.2, feetY = 0.8): LandmarkPoint[] {
  const pose = Array.from({ length: 33 }, () => ({ x: centerX, y: 0.5, visibility: 1 }));
  for (const index of [11, 12, 23, 24]) pose[index] = { x: centerX, y: 0.5, visibility: 1 };
  pose[0] = { x: centerX, y: headY, visibility: 1 };
  pose[7] = { x: centerX - 0.035, y: headY, visibility: 1 };
  pose[8] = { x: centerX + 0.035, y: headY, visibility: 1 };
  pose[27] = { x: centerX, y: feetY, visibility: 1 };
  pose[28] = { x: centerX, y: feetY, visibility: 1 };
  return pose;
}

test("camera auto-centre une personne dans une sortie verticale depuis une source horizontale", () => {
  const pose = centeredPose(0.5, 0.2, 0.8);
  const transform = createSceneTransform(1920, 1080, 1080, 1920, pose);
  const [center] = mapPoseToCanvas([{ x: 0.5, y: 0.5 }], 1920, 1080, transform);
  assert.equal(transform.scale, 1920 / 1080);
  assert.ok(Math.abs(center.x - 540) < 1e-8);
  assert.ok(Math.abs(center.y - 960) < 1e-8);
});

test("camera garde une source portrait au ratio natif 9:16", () => {
  const transform = createSceneTransform(1080, 1920, 1080, 1920, centeredPose());
  assert.equal(transform.scale, 1);
  assert.equal(transform.offsetX, 0);
  assert.equal(transform.offsetY, 0);
});

test("camera recentre le sujet même s'il est décalé dans la vidéo d'origine", () => {
  const pose = centeredPose(0.68, 0.25, 0.85);
  const transform = createSceneTransform(1080, 1920, 1080, 1920, pose);
  const subject = mapPoseToCanvas([{ x: 0.68, y: 0.55 }], 1080, 1920, transform)[0];
  assert.ok(Math.abs(subject.x - 540) < 1e-8);
});

test("cadrage multi-personnes inclut les deux centres dans le canvas 9:16", () => {
  const poses = [centeredPose(0.25, 0.2, 0.8), centeredPose(0.75, 0.2, 0.8)];
  const transform = createMultiPoseTransform(1920, 1080, 1080, 1920, poses);
  const centers = poses.map((pose) => mapPoseToCanvas([pose[0]], 1920, 1080, transform)[0]);
  assert.ok(centers[0].x > 0 && centers[1].x < 1080);
  assert.ok(centers[0].x < centers[1].x);
  assert.ok(centers.every((center) => center.y > 0 && center.y < 1920));
});

test("retargeting vertical donne une taille lisible à deux personnes d'une source horizontale", () => {
  const left = centeredPose(0.25, 0.2, 0.8);
  const right = centeredPose(0.75, 0.2, 0.8);
  const mappedLeft = retargetPoseToSlot(left, 1920, 1080, 1080, 1920, 0, 2, 0.25);
  const mappedRight = retargetPoseToSlot(right, 1920, 1080, 1080, 1920, 1, 2, 0.75);
  assert.ok(Math.abs(mappedLeft[0].x - 1080 * 0.24) < 1e-8);
  assert.ok(Math.abs(mappedRight[0].x - 1080 * 0.76) < 1e-8);
  assert.ok(mappedLeft[27].y - mappedLeft[0].y > 900);
  assert.ok(mappedRight[27].y < 1920);
});

test("référence de cadrage garde l'échelle et laisse passer le mouvement vertical", () => {
  const original = centeredPose(0.4, 0.2, 0.8);
  const reference = estimatePoseScaleReference(original, 1920, 1080);
  const shifted = original.map((point) => ({ ...point, y: point.y + 0.02 }));
  const first = retargetPoseToSlot(original, 1920, 1080, 1080, 1920, 0, 2, 0.4, reference, 0.24);
  const next = retargetPoseToSlot(shifted, 1920, 1080, 1080, 1920, 0, 2, 0.4, reference, 0.24);
  assert.ok(next[0].y > first[0].y);
  assert.ok(Math.abs((next[27].y - next[0].y) - (first[27].y - first[0].y)) < 1e-8);
});
