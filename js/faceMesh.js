// js/faceMesh.js
import { CANVAS_SIZE } from './config.js';
import { dom } from './dom.js';

let faceLandmarker = null;

export async function ensureFaceLandmarker() {
  if (faceLandmarker) return faceLandmarker;

  if (!window.FilesetResolver || !window.FaceLandmarker) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.js';
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load MediaPipe library. Check your internet connection.'));
      document.head.appendChild(script);
    });
  }

  const vision = await window.FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
  );

  faceLandmarker = await window.FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    },
    runningMode: 'IMAGE',
    numFaces: 1,
  });

  return faceLandmarker;
}

export async function detectFaceLandmarks(imageSource) {
  const landmarker = await ensureFaceLandmarker();
  const results = landmarker.detect(imageSource);
  if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
    throw new Error('No face detected. Try a clearer front-facing selfie.');
  }
  return results.faceLandmarks[0];
}

const FACE_CONNECTIONS = [
  [10,338],[338,297],[297,332],[332,284],[284,251],[251,389],[389,356],[356,454],[454,323],[323,361],[361,288],[288,397],[397,365],[365,379],[379,378],[378,400],[400,377],[377,152],[152,148],[148,176],[176,149],[149,150],[150,136],[136,172],[172,58],[58,132],[132,93],[93,234],[234,127],[127,162],[162,21],[21,54],[54,103],[103,67],[67,109],[109,10],
  [61,146],[146,91],[91,181],[181,84],[84,17],[17,314],[314,405],[405,321],[321,375],[375,291],[291,409],[409,270],[270,269],[269,267],[267,0],[0,37],[37,39],[39,40],[40,185],[185,61],
  [263,249],[249,390],[390,373],[373,374],[374,380],[380,381],[381,382],[382,362],[362,263],
  [33,7],[7,163],[163,144],[144,145],[145,153],[153,154],[154,155],[155,133],[133,33],
  [276,283],[283,282],[282,295],[295,285],[285,300],[300,293],[293,334],[334,296],[296,336],
  [46,53],[53,52],[52,65],[65,55],[55,70],[70,63],[63,105],[105,66],[66,107],
  [168,6],[6,197],[197,195],[195,5],[5,4],[4,1],[1,275],[275,274],[274,455],[455,308]
];

export function drawFaceLines(ctx, landmarks, size) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  FACE_CONNECTIONS.forEach(([start, end]) => {
    const p1 = landmarks[start];
    const p2 = landmarks[end];
    if (p1 && p2) {
      ctx.beginPath();
      ctx.moveTo(p1.x * size, p1.y * size);
      ctx.lineTo(p2.x * size, p2.y * size);
      ctx.stroke();
    }
  });
}

export async function processWithFaceMesh() {
  const landmarks = await detectFaceLandmarks(dom.inputCanvas);

  const procCanvas = document.createElement('canvas');
  procCanvas.width = CANVAS_SIZE;
  procCanvas.height = CANVAS_SIZE;
  const pctx = procCanvas.getContext('2d', { willReadFrequently: true });

  drawFaceLines(pctx, landmarks, CANVAS_SIZE);

  return procCanvas.toDataURL('image/png');
}
