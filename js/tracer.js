// js/tracer.js
// Handles image tracing logic (both normal ImageTracer and FaceMesh path)

import { setBezierSteps, CANVAS_SIZE } from './config.js';
import { dom } from './dom.js';
import { state } from './state.js';
import { SvgParser } from './svgParser.js';
import { PlotterSimulator } from './plotterSimulator.js';
import { enableSimulationControls } from './library.js';
import { getCurrentParams } from './tuning.js';
import { buildFacePathsFromLandmarks, pathsToSVG, detectFaceLandmarks } from './faceMesh.js';

export function buildTraceOptions() {
  const p = getCurrentParams();
  return {
    ltres: p.ltres,
    qtres: p.qtres,
    pathomit: p.pathomit,
    numberofcolors: p.numberofcolors,
    strokewidth: 1,
    linefilter: true,
    scale: 1,
    blurradius: p.blurradius || 0,
    blurdelta: p.blurdelta || 20,
  };
}

export async function performTrace() {
  if (!state.uploadedImage) return;

  // Clear FaceMesh box by default; will be set only if FaceMesh is active
  // Clear dedicated FaceMesh box at start of each trace (will be re-populated by update if enabled)
  if (dom.faceMeshContainer) {
    dom.faceMeshContainer.innerHTML = '';
  }

  const useFaceMesh = !!(dom.useFaceMesh && dom.useFaceMesh.checked);

  if (useFaceMesh) {
    try {
      // FaceMesh is applied **only** to the original full-resolution image.
      // The result (direct landmark contours) is placed straight into the Vector SVG.
      // ImageTracer is completely bypassed for this mode to preserve maximum quality.
      const landmarks = await detectFaceLandmarks();

      // Direct paths from original image landmarks → shown in Vector (SVG)
      let facePaths = buildFacePathsFromLandmarks(landmarks);

      // Normalize to canvas (same as other paths)
      SvgParser.normalizePaths(facePaths, CANVAS_SIZE, CANVAS_SIZE);

      // Pure FaceMesh output (direct from original image, no tracing at all) 
      // goes to the dedicated "FaceMesh (raw)" box
      import('./faceMesh.js').then(m => m.updateFaceMeshRawBox()).catch(console.error);

      // Vector also gets the raw FaceMesh (for now; can be changed to traced version of FaceMesh lines)
      dom.svgContainer.innerHTML = pathsToSVG(facePaths);

      state.pathsPoints = facePaths;
      PlotterSimulator.reset();
      enableSimulationControls();
      return;
    } catch (err) {
      console.warn('FaceMesh processing failed, falling back to normal tracing:', err);
      // Optional: brief UI feedback
      if (dom.progressText) {
        const prev = dom.progressText.textContent;
        dom.progressText.textContent = 'FaceMesh unavailable (see console) - normal trace';
        setTimeout(() => {
          if (dom.progressText && dom.progressText.textContent.includes('FaceMesh unavailable')) {
            dom.progressText.textContent = prev || 'Progress: 0%';
          }
        }, 2200);
      }
    }
  }

  // Normal ImageTracer flow
  const dataURL = dom.inputCanvas.toDataURL('image/png');
  const traceOpts = buildTraceOptions();
  const params = getCurrentParams();

  setBezierSteps(params.bezierSteps || 10);

  ImageTracer.imageToSVG(
    dataURL,
    (svg) => {
      dom.svgContainer.innerHTML = svg;
      const postOpts = {
        bezierSteps: params.bezierSteps,
        simplifyTolerance: params.simplifyTolerance,
        minPoints: params.minPoints,
        minLength: params.minLength,
        sortByLength: params.sortByLength,
      };
      state.pathsPoints = SvgParser.extractPaths(svg, postOpts);
      PlotterSimulator.reset();
      enableSimulationControls();
    },
    traceOpts
  );
}

export function performTraceSafe() {
  performTrace().catch(console.error);
}
