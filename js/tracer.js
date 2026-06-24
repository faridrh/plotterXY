// js/tracer.js
// Handles image tracing logic (both normal ImageTracer and FaceMesh path)

import { setBezierSteps } from './config.js';
import { dom } from './dom.js';
import { state } from './state.js';
import { SvgParser } from './svgParser.js';
import { PlotterSimulator } from './plotterSimulator.js';
import { enableSimulationControls } from './library.js';
import { getCurrentParams } from './tuning.js';
import { processWithFaceMesh } from './faceMesh.js';

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
      const processedDataUrl = await processWithFaceMesh();

      const traceOpts = buildTraceOptions();
      const params = getCurrentParams();
      setBezierSteps(params.bezierSteps || 10);

      ImageTracer.imageToSVG(
        processedDataUrl,
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
      return;
    } catch (err) {
      console.warn('FaceMesh processing failed, falling back to normal tracing:', err);
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
