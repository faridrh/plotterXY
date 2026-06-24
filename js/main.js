// js/main.js - Main entry point and glue code
import { dom } from './dom.js';
import { state } from './state.js';
import { PlotterSimulator } from './plotterSimulator.js';
import { Exporter } from './exporter.js';
import { ImageLoader } from './imageLoader.js';
import {
  renderLibrary,
  addSessionImageFromFile,
} from './library.js';
import { downloadFileToSave } from './utils.js';
import { initTuningParams } from './tuning.js';
import { performTraceSafe } from './tracer.js';

function handleTrace() {
  performTraceSafe();
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
