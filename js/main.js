// js/main.js - Main entry point and glue code
import { CANVAS_SIZE, setBezierSteps } from './config.js';
import { dom, inputCtx, plotterCtx } from './dom.js';
import { state } from './state.js';
import { SvgParser } from './svgParser.js';
import { PlotterSimulator } from './plotterSimulator.js';
import { Exporter } from './exporter.js';
import { ImageLoader } from './imageLoader.js';
import {
  renderLibrary,
  addSessionImageFromFile,
  downloadFileToSave,
  enableSimulationControls
} from './library.js';
import {
  initTuningParams,
  getCurrentParams,
} from './tuning.js';
import { processWithFaceMesh } from './faceMesh.js';

// Re-export for other modules that need to trigger trace safely
export function performTraceSafe() {
  performTrace().catch(console.error);
}

// Bridge for modules loaded before full init (used by imageLoader)
window.performTraceSafe = performTraceSafe;

// Core trace logic (moved from old monolithic script)
async function performTrace() {
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

function buildTraceOptions() {
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

function handleTrace() {
  performTrace().catch(console.error);
}

// ==================== Initialization ====================
export function init() {
  // File input
  dom.fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    ImageLoader.loadFromFile(file);
    addSessionImageFromFile(file, objectUrl);
  });

  if (dom.saveToLibraryBtn) {
    dom.saveToLibraryBtn.addEventListener('click', () => {
      if (state.lastUploadedFile) {
        downloadFileToSave(state.lastUploadedFile);
      }
    });
  }

  dom.traceBtn.addEventListener('click', handleTrace);

  dom.playBtn.addEventListener('click', () => PlotterSimulator.play());
  dom.pauseBtn.addEventListener('click', () => PlotterSimulator.pause());

  dom.speedRange.addEventListener('input', () => {
    state.speed = parseFloat(dom.speedRange.value);
  });

  dom.exportGcodeBtn.addEventListener('click', () => {
    if (!state.pathsPoints.length) return;
    Exporter.download(
      Exporter.generateGcode(state.pathsPoints),
      'plotter_output.gcode',
      'text/plain'
    );
  });

  dom.exportJsonBtn.addEventListener('click', () => {
    if (!state.pathsPoints.length) return;
    Exporter.download(
      Exporter.generateJson(state.pathsPoints),
      'plotter_output.json',
      'application/json'
    );
  });

  state.speed = parseFloat(dom.speedRange.value);

  // Render image library
  renderLibrary();

  // Initialize tuning panel (sliders + presets + FaceMesh checkbox)
  initTuningParams();
}

// Start the app
init();
