// js/faceMesh.js
import { CANVAS_SIZE } from './config.js';
import { dom } from './dom.js';
import { state } from './state.js';

let faceLandmarker = null;

export async function ensureFaceLandmarker() {
  if (faceLandmarker) return faceLandmarker;

  // Use the WASM Tasks API via ESM (no vision_bundle.js)
  // Correct entry point is the package root (not /tasks-vision.js)
  const { FilesetResolver, FaceLandmarker } = await import(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35"
  );

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
  );

  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    },
    runningMode: "IMAGE",
    numFaces: 1,
  });

  return faceLandmarker;
}

export async function detectFaceLandmarks(imageSource) {
  // Prefer an explicitly passed imageSource (supports reuse + unit testing without
  // mutating global state). Falls back to state.uploadedImage for normal app usage.
  // In the app, the caller relies on the fallback so that detection always runs on
  // the ORIGINAL full-resolution image (never the scaled/centered canvas version)
  // for maximum quality on outer features (ears, hairline, etc).
  const original = imageSource || state.uploadedImage;
  if (!original) {
    throw new Error('No original image available for FaceMesh detection.');
  }

  const landmarker = await ensureFaceLandmarker();
  const results = landmarker.detect(original);
  if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
    throw new Error('No face detected. Try a clearer front-facing selfie.');
  }

  const rawLms = results.faceLandmarks[0];

  // Map the landmarks from original image space into the same centered coordinate
  // space used for the 300x300 canvas (so the lines appear correctly in the Vector view).
  const scale = Math.min(CANVAS_SIZE / original.width, CANVAS_SIZE / original.height);
  const w = original.width * scale;
  const h = original.height * scale;
  const offX = (CANVAS_SIZE - w) / 2;
  const offY = (CANVAS_SIZE - h) / 2;

  return rawLms.map(lm => ({
    x: (offX + lm.x * w) / CANVAS_SIZE,
    y: (offY + lm.y * h) / CANVAS_SIZE
  }));
}

export function drawFaceLines(ctx, landmarks, size) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#000000';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Use the same feature groups for nice continuous strokes
  const featureIndices = {
    faceOval: [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10],
    hairline: [162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389],
    leftEar: [234, 227, 116, 117, 118, 119, 120, 121, 128, 245, 234],
    rightEar: [454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 454],
    rightEye: [33,7,163,144,145,153,154,155,133,33],
    leftEye: [263,249,390,373,374,380,381,382,362,263],
    rightEyebrow: [46,53,52,65,55,70,63,105,66,107],
    leftEyebrow: [276,283,282,295,285,300,293,334,296,336],
    lips: [61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185,61],
    noseBridge: [168,6,197,195,5,4,1],
    noseBase: [4,275,274,455,308]
  };

  for (const [name, indices] of Object.entries(featureIndices)) {
    const pts = indices.map(i => {
      const lm = landmarks[i];
      return lm ? { x: lm.x * size, y: lm.y * size } : null;
    }).filter(Boolean);

    if (pts.length < 2) continue;

    // Make hairline and ears more prominent
    if (name === 'hairline' || name.includes('Ear')) {
      ctx.lineWidth = 6;
    } else {
      ctx.lineWidth = 4.5;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  }
}

export async function processWithFaceMesh() {
  // Note: This helper (and detectFaceLandmarks) use the original via state fallback.
  // However, the main FaceMesh checkbox path (in tracer.js) bypasses this entirely
  // and goes direct from original landmarks → Vector SVG (no raster / ImageTracer).
  const landmarks = await detectFaceLandmarks();

  const procCanvas = document.createElement('canvas');
  procCanvas.width = CANVAS_SIZE;
  procCanvas.height = CANVAS_SIZE;
  const pctx = procCanvas.getContext('2d', { willReadFrequently: true });

  drawFaceLines(pctx, landmarks, CANVAS_SIZE);

  return procCanvas.toDataURL('image/png');
}

/**
 * Build clean vector paths directly from MediaPipe landmarks using feature contours.
 * This gives exact representation of the detected face lines without raster tracing.
 */
export function buildFacePathsFromLandmarks(landmarks, size = CANVAS_SIZE) {
  const featureIndices = {
    faceOval: [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10],
    hairline: [162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389],
    leftEar: [234, 227, 116, 117, 118, 119, 120, 121, 128, 245, 234],
    rightEar: [454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 454],
    rightEye: [33,7,163,144,145,153,154,155,133,33],
    leftEye: [263,249,390,373,374,380,381,382,362,263],
    rightEyebrow: [46,53,52,65,55,70,63,105,66,107],
    leftEyebrow: [276,283,282,295,285,300,293,334,296,336],
    lips: [61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185,61],
    noseBridge: [168,6,197,195,5,4,1],
    noseBase: [4,275,274,455,308]
  };

  const paths = [];
  for (const indices of Object.values(featureIndices)) {
    const pts = indices.map(i => {
      const lm = landmarks[i];
      return lm ? { x: lm.x * size, y: lm.y * size } : null;
    }).filter(Boolean);

    if (pts.length > 1) {
      paths.push(pts);
    }
  }
  return paths;
}

/**
 * Generate a simple SVG string from point paths for the Vector preview.
 */
export function pathsToSVG(paths) {
  const size = CANVAS_SIZE;
  // widths to highlight hairline and ears
  const widths = [1.5, 3, 3, 3, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  paths.forEach((path, idx) => {
    if (path.length < 2) return;
    const w = widths[idx] || 1.5;
    let d = `M ${path[0].x.toFixed(1)} ${path[0].y.toFixed(1)}`;
    for (let i = 1; i < path.length; i++) {
      d += ` L ${path[i].x.toFixed(1)} ${path[i].y.toFixed(1)}`;
    }
    svg += `<path d="${d}" fill="none" stroke="#00ff88" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  svg += `</svg>`;
  return svg;
}

export async function updateFaceMeshRawBox() {
  if (!dom.faceMeshContainer || !state.uploadedImage) {
    if (dom.faceMeshContainer) dom.faceMeshContainer.innerHTML = '';
    return;
  }

  const isEnabled = dom.useFaceMesh && dom.useFaceMesh.checked;
  if (!isEnabled) {
    dom.faceMeshContainer.innerHTML = '';
    return;
  }

  try {
    const landmarks = await detectFaceLandmarks();
    const facePaths = buildFacePathsFromLandmarks(landmarks);
    // Direct result of initial FaceMesh detection (ears, hairline, face lines etc.)
    // No normalize or other post-processing applied, for the "FaceMesh (raw)" preview.
    dom.faceMeshContainer.innerHTML = pathsToSVG(facePaths);
  } catch (err) {
    console.warn('FaceMesh raw box update failed:', err);
    dom.faceMeshContainer.innerHTML = '';
  }
}
