import test from "node:test";
import assert from "node:assert/strict";
import { createSceneTransform, mapPoseToCanvas } from "../lib/rendering/pose-renderer";
import type { LandmarkPoint } from "../lib/rendering/pose-renderer";

function centeredPose(centerX = 0.5, headY = 0.2, feetY = 0.8): LandmarkPoint[] {
  const pose = Array.from({ length: 33 }, () => ({ x: centerX, y: 0.5, visibility: 1 }));
  for (const index of [11, 12, 23, 24]) pose[index] = { x: centerX, y: 0.5, visibility: 1 };
  pose[0] = { x: centerX, y: headY, visibility: 1 };
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
