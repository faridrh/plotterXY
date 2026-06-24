# JS Modules Overview

This directory contains the refactored modular version of the original `script.js`.

The app is loaded via ES Modules from `index.html`:
```html
<script type="module" src="js/main.js"></script>
```

## File Responsibilities

### Core / Infrastructure
- **config.js**  
  Central place for constants (`CANVAS_SIZE`, colors, `NORMALIZE_PADDING`), default tuning parameters (`DEFAULT_PARAMS`), preset definitions (`PRESETS`), G-code settings, and the list of available images from the `images/` folder.  
  Also exposes `setBezierSteps()` for runtime updates.

- **dom.js**  
  Queries and exports all DOM elements once (`dom` object) + the two canvas 2D contexts (`inputCtx`, `plotterCtx`).  
  Avoids repeated `getElementById` calls everywhere.

- **state.js**  
  Single source of truth for runtime application state (uploaded image, current paths, animation state, session images, etc.).

### Domain Logic
- **svgParser.js**  
  Parses SVG `<path>` data (from ImageTracer) into arrays of `{x, y}` points.  
  Also contains post-processing: length filtering, path simplification (Ramer-Douglas-Peucker style), and normalization to the canvas.

- **plotterSimulator.js**  
  Handles the XY plotter animation: stepping through points, pen up/down logic, progress calculation, play/pause/reset.

- **exporter.js**  
  Generates G-code and JSON output from the point paths. Contains the download helper.

- **tracer.js**  
  **New dedicated module** for the tracing step.  
  Contains:
  - `buildTraceOptions()` — builds options object for ImageTracer from current tuning params.
  - `performTrace()` — the main async function that decides between normal ImageTracer or FaceMesh-processed image, then calls ImageTracer and feeds results into `SvgParser` + `PlotterSimulator`.
  - `performTraceSafe()` — wrapped version that catches errors (used by UI event handlers).

### UI / Feature Modules
- **imageLoader.js**  
  Loads user images (from file or library), centers them on the input canvas, and triggers auto-trace.

- **library.js**  
  Renders the "Available Images" thumbnails (from `images/` folder + session uploads).  
  Handles adding uploaded images to the session list and the "Save to images/" download helper (now re-exported from utils).

- **tuning.js**  
  All logic related to the tuning panel:
  - Reading/writing slider values
  - Syncing labels
  - Applying presets (Simple / Balanced / Detailed)
  - Reset to defaults
  - Debounced re-tracing on change
  - FaceMesh checkbox listener

- **faceMesh.js**  
  MediaPipe FaceLandmarker integration (lazy-loaded).
  - `ensureFaceLandmarker()` — dynamically loads the CDN script + model on first use.
  - `detectFaceLandmarks()`
  - `drawFaceLines()` — draws clean black face contours (oval, eyes, brows, lips, nose) on a white canvas.
  - `processWithFaceMesh()` — produces a data URL of the clean line drawing used as input to the tracer when the checkbox is enabled.

- **utils.js**  
  Small shared pure helpers (`downloadFileToSave`, `debounce`, etc.).

- **tracer.js**  
  Extracted tracing orchestration (`performTrace`, `buildTraceOptions`, `performTraceSafe`).

- **main.js**  
  Application entry point. Wires up all event listeners, calls `initTuningParams()`, `renderLibrary()`, and starts the app.  
  Imports the high-level pieces and keeps the initialization code centralized.

## Optional Future Improvements
- A light barrel file `js/index.js` has been added. It re-exports core pieces. You can start importing from it when convenient:
  ```js
  import { SvgParser, performTraceSafe } from './index.js';
  ```
- When adopting a build tool (Vite, esbuild, etc.), this folder structure maps 1:1.
- When adopting a build tool (Vite, esbuild, etc.), this folder structure maps 1:1 with no changes needed.
- Remove the `window.performTraceSafe` bridge once all auto-trace call sites use dynamic `import()` (already done in most places).

## Running
Open `index.html` via a local server (e.g. `python -m http.server` or VS Code Live Server). Direct `file://` access may have issues loading MediaPipe WASM/models.
