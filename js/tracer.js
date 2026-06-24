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

  if (useFaceMesh) {
    try {
      const landmarks = await detectFaceLandmarks(dom.inputCanvas);

      // Build paths DIRECTLY from landmarks (exact face features from the selfie)
      // This ensures the lines accurately represent the uploaded face, without raster artifacts from ImageTracer.
      let facePaths = buildFacePathsFromLandmarks(landmarks);

      // Normalize to canvas (same as other paths)
      SvgParser.normalizePaths(facePaths, CANVAS_SIZE, CANVAS_SIZE);

      // Show clean direct SVG preview
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
