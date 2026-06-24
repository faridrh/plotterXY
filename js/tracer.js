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

  const useFaceMesh = !!(dom.useFaceMesh && dom.useFaceMesh.checked);

  // Clear FaceMesh (raw) box only when not using FaceMesh.
  // When using FaceMesh we will populate it directly with the initial detection result.
  if (dom.faceMeshContainer) {
    if (!useFaceMesh) {
      dom.faceMeshContainer.innerHTML = '';
    }
  }

  if (useFaceMesh) {
    try {
      // FaceMesh is applied **only** to the original full-resolution image.
      // The raw/initial detection (with ears, hairline etc.) goes to FaceMesh (raw) box.
      // A normalized version goes to Vector (SVG) for final output / G-code / simulation.
      const landmarks = await detectFaceLandmarks();

      // Build direct paths from landmarks (this is the "initial processing" result)
      let facePaths = buildFacePathsFromLandmarks(landmarks);

      // Show the direct/unprocessed FaceMesh result in the dedicated "FaceMesh (raw)" box.
      // This is what the user wants to see for the face line detection (no extra normalize).
      if (dom.faceMeshContainer) {
        dom.faceMeshContainer.innerHTML = pathsToSVG(facePaths);
      }

      // Normalize for the final Vector view (and state used by simulator/G-code export).
      // This keeps Vector as the "final result".
      SvgParser.normalizePaths(facePaths, CANVAS_SIZE, CANVAS_SIZE);

      // Vector gets the (normalized) FaceMesh result
      dom.svgContainer.innerHTML = pathsToSVG(facePaths);

      state.pathsPoints = facePaths;
      PlotterSimulator.reset();
      enableSimulationControls();
      return;
    } catch (err) {
      console.warn('FaceMesh processing failed, falling back to normal tracing:', err);
      // Clean up raw box since FaceMesh path failed
      if (dom.faceMeshContainer) {
        dom.faceMeshContainer.innerHTML = '';
      }
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
