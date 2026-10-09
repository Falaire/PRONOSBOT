export type LandmarkPoint = { x: number; y: number; visibility?: number };
export type PoseRendererSettings = {
  outlineColor: string;
  headScale: number;
  characterScale: number;
  characterOffsetX: number;
  characterOffsetY: number;
};

export type SceneTransform = { scale: number; offsetX: number; offsetY: number };

const BONES: [number, number, number][] = [
  [11, 13, 25], [13, 15, 23], [12, 14, 25], [14, 16, 23],
  [23, 25, 34], [25, 27, 32], [24, 26, 34], [26, 28, 32],
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const point = (points: LandmarkPoint[], index: number) => points[index];

export function createSceneTransform(
  videoWidth: number,
  videoHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  landmarks: LandmarkPoint[]
): SceneTransform {
  const scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
  const average = (indices: number[], axis: "x" | "y", fallback: number) => {
    const visible = indices.map((index) => point(landmarks, index)).filter((p) => p && (p.visibility ?? 1) >= 0.25);
    return visible.length ? visible.reduce((sum, p) => sum + p[axis], 0) / visible.length : fallback;
  };
  const centerX = average([11, 12, 23, 24], "x", 0.5);
  const headY = point(landmarks, 0)?.y ?? average([11, 12], "y", 0.35);
  const feetY = average([27, 28], "y", 0.9);
  const centerY = (headY + feetY) / 2;
  return {
    scale,
    offsetX: canvasWidth / 2 - centerX * videoWidth * scale,
    offsetY: canvasHeight / 2 - centerY * videoHeight * scale,
  };
}

export function mapPoseToCanvas(
  landmarks: LandmarkPoint[],
  videoWidth: number,
  videoHeight: number,
  transform: SceneTransform
): LandmarkPoint[] {
  return landmarks.map((p) => ({
    ...p,
    x: p.x * videoWidth * transform.scale + transform.offsetX,
    y: p.y * videoHeight * transform.scale + transform.offsetY,
  }));
}

export function drawVideoBackground(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, transform: SceneTransform) {
  ctx.drawImage(video, transform.offsetX, transform.offsetY, video.videoWidth * transform.scale, video.videoHeight * transform.scale);
}

export function drawImageCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#39414a";
  ctx.lineWidth = 12;
  // Table top in slight perspective.
  ctx.beginPath();
  ctx.moveTo(-100, 0); ctx.lineTo(94, -8); ctx.lineTo(128, 27); ctx.lineTo(-77, 38); ctx.closePath();
  ctx.fillStyle = "#edc98a"; ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "#b2824c"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-77, 38); ctx.lineTo(128, 27); ctx.stroke();
  ctx.strokeStyle = "#4d5965"; ctx.lineWidth = 13;
  ctx.beginPath(); ctx.moveTo(-62, 39); ctx.lineTo(-70, 150); ctx.moveTo(105, 30); ctx.lineTo(117, 140); ctx.stroke();
  // A simple chair, tucked beside the desk.
  ctx.fillStyle = "#74b8d1"; ctx.strokeStyle = "#46535e"; ctx.lineWidth = 9;
  roundedRect(ctx, -160, 67, 73, 70, 12); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-151, 137); ctx.lineTo(-155, 205); ctx.moveTo(-99, 137); ctx.lineTo(-95, 202); ctx.stroke();
  ctx.restore();
}

/** Fond de salle de classe dessiné en Canvas, sans image ni requête réseau. */
export function drawClassroomBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const wallEnd = height * 0.69;
  const wall = ctx.createLinearGradient(0, 0, 0, wallEnd);
  wall.addColorStop(0, "#faf8ef"); wall.addColorStop(1, "#e7e2d2");
  ctx.fillStyle = wall; ctx.fillRect(0, 0, width, height);
  // Mur, plinthe et plancher chaud.
  ctx.fillStyle = "#fffdf5"; ctx.fillRect(0, wallEnd - 26, width, 28);
  ctx.fillStyle = "#b58455"; ctx.fillRect(0, wallEnd, width, 20);
  const floor = ctx.createLinearGradient(0, wallEnd + 15, 0, height);
  floor.addColorStop(0, "#e9bd78"); floor.addColorStop(1, "#d99c51");
  ctx.fillStyle = floor; ctx.fillRect(0, wallEnd + 20, width, height - wallEnd - 20);
  ctx.strokeStyle = "rgba(132,85,42,.36)"; ctx.lineWidth = 5;
  for (let row = 1; row < 7; row++) {
    const y = wallEnd + 20 + (height - wallEnd - 20) * row / 7;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  for (let column = -2; column < 9; column++) {
    ctx.beginPath(); ctx.moveTo(width * column / 7, wallEnd + 20); ctx.lineTo(width * (column + 1) / 6, height); ctx.stroke();
  }

  // Fenêtre à gauche avec vue stylisée.
  ctx.fillStyle = "#d8e2dc"; ctx.strokeStyle = "#342f29"; ctx.lineWidth = 15;
  ctx.fillRect(width * 0.045, height * 0.13, width * 0.18, height * 0.23);
  ctx.strokeRect(width * 0.045, height * 0.13, width * 0.18, height * 0.23);
  ctx.fillStyle = "#b9e0cf"; ctx.fillRect(width * 0.06, height * 0.145, width * 0.15, height * 0.20);
  ctx.strokeStyle = "#fffdf5"; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(width * 0.135, height * 0.15); ctx.lineTo(width * 0.135, height * 0.34); ctx.moveTo(width * 0.06, height * 0.245); ctx.lineTo(width * 0.21, height * 0.245); ctx.stroke();
  ctx.fillStyle = "#f2efe6"; ctx.fillRect(width * 0.02, height * 0.36, width * 0.23, 18);

  // Tableau vert à cadre bois.
  const boardX = width * 0.255, boardY = height * 0.145, boardW = width * 0.69, boardH = height * 0.265;
  ctx.fillStyle = "#825233"; ctx.strokeStyle = "#37291f"; ctx.lineWidth = 12;
  roundedRect(ctx, boardX, boardY, boardW, boardH, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#087052"; ctx.fillRect(boardX + 18, boardY + 18, boardW - 36, boardH - 42);
  ctx.strokeStyle = "rgba(210,244,218,.18)"; ctx.lineWidth = 4;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(boardX + 40, boardY + 45 + i * 43); ctx.lineTo(boardX + boardW - 38, boardY + 40 + i * 43); ctx.stroke();
  }
  ctx.fillStyle = "#f6f0d6"; ctx.font = `italic 34px Georgia, serif`; ctx.textAlign = "left";
  ctx.fillText("A + B = C", boardX + 55, boardY + 100);
  ctx.fillText("A + B = C", boardX + 55, boardY + 150);
  ctx.textAlign = "center"; ctx.font = `bold 58px Arial, sans-serif`;
  ctx.fillText("STICKMAN", boardX + boardW * 0.62, boardY + boardH * 0.60);
  // Craie / plateau du tableau.
  ctx.fillStyle = "#d6b17a"; ctx.fillRect(boardX + 20, boardY + boardH - 21, boardW - 40, 16);
  ctx.fillStyle = "#f6f0d6"; ctx.fillRect(boardX + boardW * 0.58, boardY + boardH - 29, 60, 8);

  // Porte latérale, en partie derrière le mobilier.
  ctx.fillStyle = "#b67c45"; ctx.strokeStyle = "#44342a"; ctx.lineWidth = 11;
  ctx.fillRect(width * 0.02, height * 0.39, width * 0.20, height * 0.27);
  ctx.strokeRect(width * 0.02, height * 0.39, width * 0.20, height * 0.27);
  ctx.fillStyle = "#d7e7e4"; ctx.fillRect(width * 0.055, height * 0.42, width * 0.13, height * 0.13);
  ctx.strokeStyle = "#6f7771"; ctx.lineWidth = 5; ctx.strokeRect(width * 0.055, height * 0.42, width * 0.13, height * 0.13);
  ctx.beginPath(); ctx.arc(width * 0.19, height * 0.55, 9, 0, Math.PI * 2); ctx.fillStyle = "#f0d59b"; ctx.fill();

  // Bureaux d'élèves placés sur les côtés, laissant une zone claire au centre.
  drawDesk(ctx, width * 0.18, height * 0.60, 0.72);
  drawDesk(ctx, width * 0.87, height * 0.61, 0.72);
  drawDesk(ctx, width * 0.17, height * 0.80, 0.94);
  drawDesk(ctx, width * 0.88, height * 0.79, 0.94);
}

function drawBone(ctx: CanvasRenderingContext2D, a: LandmarkPoint, b: LandmarkPoint, width: number, color: string) {
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = color; ctx.lineWidth = width + 10;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = "#fffdf8"; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

function drawJoint(ctx: CanvasRenderingContext2D, p: LandmarkPoint, radius: number, color: string) {
  ctx.beginPath(); ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fillStyle = "#fffdf8"; ctx.fill();
}

function drawTorso(ctx: CanvasRenderingContext2D, pose: LandmarkPoint[], color: string, unit: number) {
  const leftShoulder = point(pose, 11), rightShoulder = point(pose, 12);
  const leftHip = point(pose, 23), rightHip = point(pose, 24);
  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return;
  ctx.beginPath();
  ctx.moveTo(leftShoulder.x, leftShoulder.y); ctx.lineTo(rightShoulder.x, rightShoulder.y);
  ctx.lineTo(rightHip.x, rightHip.y); ctx.lineTo(leftHip.x, leftHip.y); ctx.closePath();
  ctx.fillStyle = "#fffdf8"; ctx.strokeStyle = color; ctx.lineWidth = 10 * unit;
  ctx.lineJoin = "round"; ctx.fill(); ctx.stroke();

  // Col, cravate et boutons donnent au personnage le look illustré de professeur.
  const neckX = (leftShoulder.x + rightShoulder.x) / 2;
  const neckY = (leftShoulder.y + rightShoulder.y) / 2;
  const tieWidth = 13 * unit;
  ctx.fillStyle = "#fffdf8"; ctx.strokeStyle = color; ctx.lineWidth = 5 * unit;
  ctx.beginPath();
  ctx.moveTo(neckX - 25 * unit, neckY - 3 * unit);
  ctx.lineTo(neckX, neckY + 24 * unit);
  ctx.lineTo(neckX - 15 * unit, neckY + 39 * unit);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(neckX + 25 * unit, neckY - 3 * unit);
  ctx.lineTo(neckX, neckY + 24 * unit);
  ctx.lineTo(neckX + 15 * unit, neckY + 39 * unit);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(neckX - tieWidth / 2, neckY + 18 * unit);
  ctx.lineTo(neckX + tieWidth / 2, neckY + 18 * unit);
  ctx.lineTo(neckX + tieWidth * 0.62, neckY + 57 * unit);
  ctx.lineTo(neckX, neckY + 76 * unit);
  ctx.lineTo(neckX - tieWidth * 0.62, neckY + 57 * unit);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = color;
  for (let button = 0; button < 3; button++) {
    ctx.beginPath(); ctx.arc(neckX + 24 * unit, neckY + (58 + button * 23) * unit, 3.2 * unit, 0, Math.PI * 2); ctx.fill();
  }
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  pose: LandmarkPoint[],
  color: string,
  headScale: number,
  timeMs: number,
  audioLevel: number
) {
  const nose = point(pose, 0), leftEar = point(pose, 7), rightEar = point(pose, 8);
  if (!nose || !leftEar || !rightEar) return;
  const earDistance = Math.hypot(rightEar.x - leftEar.x, rightEar.y - leftEar.y);
  const radius = clamp(earDistance * 0.88 * headScale, 42, 240);
  const angle = Math.atan2(rightEar.y - leftEar.y, rightEar.x - leftEar.x);
  const centerY = nose.y - radius * 0.14;
  const blinking = timeMs % 3600 > 3450;
  const eyeW = radius * 0.13, eyeY = -radius * 0.12;
  const pupilShift = Math.sin(timeMs * 0.0008) * radius * 0.025;
  const browMotion = Math.sin(timeMs * 0.003) * radius * 0.018;
  const mouthOpen = audioLevel > 0.012 ? clamp(audioLevel * 7, 0.1, 0.68) : 0;
  ctx.save(); ctx.translate(nose.x, centerY); ctx.rotate(angle);

  ctx.beginPath(); ctx.ellipse(0, 0, radius * 0.84, radius, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#fffdf8"; ctx.strokeStyle = color; ctx.lineWidth = Math.max(7, radius * 0.075); ctx.fill(); ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(side * radius * 0.78, radius * 0.04, radius * 0.13, radius * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fffdf8"; ctx.strokeStyle = color; ctx.lineWidth = Math.max(5, radius * 0.05); ctx.fill(); ctx.stroke();
  }
  // Trois mèches donnent un contour illustré plutôt qu'un simple cercle.
  ctx.beginPath(); ctx.moveTo(-radius * 0.62, -radius * 0.58);
  ctx.quadraticCurveTo(-radius * 0.28, -radius * 1.02, radius * 0.18, -radius * 0.87);
  ctx.quadraticCurveTo(radius * 0.48, -radius * 0.94, radius * 0.68, -radius * 0.63);
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(6, radius * 0.06); ctx.lineCap = "round"; ctx.stroke();

  for (const side of [-1, 1]) {
    const eyeX = side * radius * 0.31;
    if (blinking) {
      ctx.beginPath(); ctx.moveTo(eyeX - eyeW, eyeY); ctx.lineTo(eyeX + eyeW, eyeY);
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(5, radius * 0.055); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(eyeX, eyeY, eyeW, radius * 0.18, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(4, radius * 0.035); ctx.stroke();
      ctx.beginPath(); ctx.arc(eyeX + pupilShift, eyeY + radius * 0.025, radius * 0.09, 0, Math.PI * 2); ctx.fillStyle = "#18232b"; ctx.fill();
      ctx.beginPath(); ctx.arc(eyeX + pupilShift - radius * 0.025, eyeY - radius * 0.015, radius * 0.025, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
    }
    const browY = -radius * 0.39 - browMotion;
    ctx.beginPath(); ctx.moveTo(eyeX - eyeW * 0.78, browY + side * radius * 0.025);
    ctx.quadraticCurveTo(eyeX, browY - radius * 0.075, eyeX + eyeW * 0.78, browY - side * radius * 0.025);
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(5, radius * 0.055); ctx.lineCap = "round"; ctx.stroke();
  }
  const mouthY = radius * 0.35;
  if (mouthOpen > 0.04) {
    ctx.beginPath(); ctx.ellipse(0, mouthY, radius * 0.2, radius * (0.035 + mouthOpen * 0.23), 0, 0, Math.PI * 2); ctx.fillStyle = "#171717"; ctx.fill();
    if (mouthOpen > 0.32) {
      ctx.beginPath(); ctx.ellipse(0, mouthY - radius * 0.04, radius * 0.12, radius * 0.035, 0, Math.PI, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
    }
  } else {
    ctx.beginPath(); ctx.moveTo(-radius * 0.22, mouthY); ctx.quadraticCurveTo(0, mouthY + radius * 0.19, radius * 0.22, mouthY);
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(5, radius * 0.055); ctx.lineCap = "round"; ctx.stroke();
  }
  ctx.restore();
}

export function drawCodeCartoon(
  ctx: CanvasRenderingContext2D,
  pose: LandmarkPoint[],
  settings: PoseRendererSettings,
  timeMs: number,
  audioLevel: number
) {
  const leftShoulder = point(pose, 11), rightShoulder = point(pose, 12);
  const shoulderWidth = leftShoulder && rightShoulder ? Math.hypot(rightShoulder.x - leftShoulder.x, rightShoulder.y - leftShoulder.y) : 120;
  const unit = clamp(shoulderWidth / 150, 0.65, 1.75);
  for (const [from, to, width] of BONES) {
    const a = point(pose, from), b = point(pose, to);
    if (!a || !b || Math.min(a.visibility ?? 1, b.visibility ?? 1) < 0.12) continue;
    drawBone(ctx, a, b, width * unit, settings.outlineColor);
    if (to === 15 || to === 16 || to === 27 || to === 28) drawJoint(ctx, b, width * unit * 0.48, settings.outlineColor);
  }
  drawTorso(ctx, pose, settings.outlineColor, unit);
  drawFace(ctx, pose, settings.outlineColor, settings.headScale, timeMs, audioLevel);
}

export function drawTrackedCharacter(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  pose: LandmarkPoint[],
  settings: PoseRendererSettings
) {
  const nose = point(pose, 0), leftEar = point(pose, 7), rightEar = point(pose, 8);
  if (!nose || !leftEar || !rightEar || !image.naturalWidth || !image.naturalHeight) return;
  const earDistance = Math.hypot(rightEar.x - leftEar.x, rightEar.y - leftEar.y);
  const headRadius = clamp(earDistance * 0.88 * settings.headScale, 42, 240);
  const visibleFeet = [point(pose, 27), point(pose, 28)].filter((p) => p && (p.visibility ?? 1) > 0.2);
  const bottom = visibleFeet.length ? Math.max(...visibleFeet.map((p) => p!.y)) : nose.y + headRadius * 4;
  const top = nose.y - headRadius * 1.18;
  const spriteHeight = Math.max(100, bottom - top) * settings.characterScale;
  const spriteWidth = spriteHeight * image.naturalWidth / image.naturalHeight;
  const shoulders = [point(pose, 11), point(pose, 12)].filter(Boolean) as LandmarkPoint[];
  const hips = [point(pose, 23), point(pose, 24)].filter(Boolean) as LandmarkPoint[];
  const centerX = shoulders.length && hips.length ? (shoulders[0].x + shoulders[1].x + hips[0].x + hips[1].x) / 4 : nose.x;
  const centerY = (top + bottom) / 2;
  const shoulderCenter = shoulders.length ? { x: (shoulders[0].x + shoulders[1].x) / 2, y: (shoulders[0].y + shoulders[1].y) / 2 } : { x: centerX, y: top + headRadius * 2 };
  const hipCenter = hips.length ? { x: (hips[0].x + hips[1].x) / 2, y: (hips[0].y + hips[1].y) / 2 } : { x: centerX, y: bottom };
  const tilt = clamp(Math.atan2(hipCenter.y - shoulderCenter.y, hipCenter.x - shoulderCenter.x) - Math.PI / 2, -0.4, 0.4);
  ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(tilt * 0.35);
  ctx.drawImage(image, -spriteWidth / 2 + settings.characterOffsetX * spriteHeight, -spriteHeight / 2 + settings.characterOffsetY * spriteHeight, spriteWidth, spriteHeight);
  ctx.restore();
}
