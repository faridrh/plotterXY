# Architecture

This document describes the modular architecture of the XY Plotter Simulator after refactoring `script.js` into smaller, focused ES modules.

## Goals of the Refactoring

- Reduce the size of the single large `script.js` file (previously >1000 lines).
- Improve maintainability, readability, and separation of concerns.
- Make it easier to add new features (e.g. more image processors, different export formats, new UI controls).
- Prepare the codebase for potential future use of a build tool (Vite, esbuild, etc.) without major rewrites.
- Keep the project runnable as a simple static site (no bundler required).

The refactoring uses native ES Modules (`type="module"`) so it works directly in modern browsers.

## High-Level Structure

```
project-root/
├── index.html          # Loads CDN scripts + the module entry point
├── style.css
├── images/             # Sample images + user-added library images
├── ARCHITECTURE.md     # This file
├── js/
│   ├── main.js         # Application entry point & initialization
│   ├── config.js       # Constants, defaults, presets
│   ├── dom.js          # DOM references + canvas contexts
│   ├── state.js        # Shared runtime state
│   ├── utils.js        # Small shared pure helpers
│   ├── tracer.js       # Core tracing orchestration
│   ├── svgParser.js    # SVG → points + post-processing
│   ├── plotterSimulator.js
│   ├── exporter.js
│   ├── imageLoader.js
│   ├── library.js      # Image library thumbnails & session handling
│   ├── tuning.js       # Parameter UI, sliders, presets, FaceMesh toggle
│   ├── faceMesh.js     # MediaPipe FaceLandmarker integration
│   ├── index.js        # (Optional) barrel file for cleaner imports
│   └── README.md       # Module-by-module quick reference
└── (old script.js can be deleted)
```

## Module Responsibilities

### Entry & Glue
- **main.js**  
  The single file loaded by `index.html` via `<script type="module">`.  
  It wires event listeners, calls initialization functions from other modules, and starts the application.  
  It should stay relatively small and focused on "plumbing".

### Shared Infrastructure
- **config.js**  
  All magic numbers and default configuration:
  - Canvas dimensions
  - Default tuning parameters (`DEFAULT_PARAMS`)
  - Preset definitions (`PRESETS`)
  - G-code settings
  - List of images available in the `images/` folder
  - Mutable `BEZIER_STEPS` helper

- **dom.js**  
  Single place that does all `getElementById` calls. Exports a `dom` object and the two canvas contexts.  
  Prevents repeated DOM queries and makes testing/mocking easier later.

- **state.js**  
  The single source of truth for mutable application state (`uploadedImage`, `pathsPoints`, animation state, session images, etc.).

- **utils.js**  
  Tiny, pure, reusable helper functions that don't belong to any particular domain (e.g. `downloadFileToSave`, `debounce`).

### Domain / Core Logic
- **tracer.js** (new dedicated module)  
  Contains the main tracing workflow:
  - `performTrace()`
  - `buildTraceOptions()`
  - `performTraceSafe()` (error-wrapped version used by UI)
  
  It decides whether to use the normal ImageTracer path or the FaceMesh-processed image, then feeds the result into `SvgParser` + `PlotterSimulator`.

- **svgParser.js**  
  Converts SVG path data (produced by ImageTracer) into arrays of `{x, y}` points.  
  Also responsible for post-processing steps: length filtering, geometric simplification, sorting by length, and normalization to the canvas bounds.

- **plotterSimulator.js**  
  The XY plotter animation engine (stepping, pen up/down, progress, play/pause).

- **exporter.js**  
  Generates G-code and JSON command lists from the normalized point paths. Handles file downloads.

### Feature & UI Modules
- **faceMesh.js**  
  Encapsulates everything related to MediaPipe FaceLandmarker:
  - Lazy loading of the CDN script + model
  - Landmark detection
  - Drawing clean face contours onto a temporary canvas
  - Producing a data URL that can be fed to the tracer

- **imageLoader.js**  
  Loads images (file upload or from the built-in library), draws them centered on the input canvas, and triggers auto-tracing.

- **library.js**  
  Renders the "Choose from images folder" thumbnail grid and manages "session uploads" (images uploaded during the current browser session).

- **tuning.js**  
  All logic that powers the Tuning Parameters panel:
  - Reading slider values
  - Updating displayed values
  - Applying presets
  - Debounced re-tracing
  - Handling the FaceMesh checkbox

### Barrel (optional)
- **index.js**  
  A very lightweight barrel file. It re-exports the most commonly used pieces so other modules can do:
  ```js
  import { SvgParser, performTraceSafe } from './index.js';
  ```
  Not mandatory — only use it if it improves readability.

## Data Flow (Simplified)

1. User selects image → `imageLoader.js` → draws on input canvas + calls tracer.
2. User clicks "Trace" or changes tuning → `tracer.js` decides path:
   - Normal: feed photo directly to ImageTracer
   - FaceMesh enabled: `faceMesh.js` → clean line drawing → feed that to ImageTracer
3. ImageTracer produces SVG → `svgParser.js` → array of point paths (with post-processing).
4. `state.pathsPoints` is updated → `plotterSimulator.js` can animate, `exporter.js` can export.
5. UI (tuning, library, progress) reacts to state changes.

All modules import only what they need. Shared mutable state lives in `state.js` and is explicitly imported.

## Key Design Decisions

- **No bundler required** — Uses native ES modules so the project can be opened with a simple static server.
- **Lazy loading for heavy features** — MediaPipe is only downloaded when the user first enables the FaceMesh checkbox.
- **Single source of truth for tuning** — `tuning.js` owns `currentParams`. Other modules ask for it via `getCurrentParams()`.
- **Tracer as a clear boundary** — All logic that decides "how to turn the image into paths" lives in `tracer.js`. This makes it easy to add new processors later (e.g. edge detection, potrace, etc.).
- **Minimal globals** — Only the CDN-loaded libraries (`ImageTracer`, dynamically loaded MediaPipe) remain global. Everything else is properly imported/exported.

## Adding New Features

- New constant or default value → `config.js`
- New shared helper → `utils.js`
- New image processing method → add code to `tracer.js` (or a new processor module) and expose via the existing FaceMesh-style toggle
- New UI panel → create a new module, import `dom` + `state`, call initialization from `main.js`
- Complex post-processing → extend `svgParser.js` or create a dedicated `postProcessor.js`

## Future Migration Path

The current structure maps directly to a modern build setup:

- Vite / esbuild / Rollup can take `js/main.js` as entry point with zero changes to the module organization.
- You can later add TypeScript, tree-shaking, minification, etc. without rewriting logic.

## Running the Project

Use any local static server, for example:

```bash
python -m http.server 8000
# or
npx serve .
```

Open `http://localhost:8000`. Direct `file://` URLs may cause problems with dynamic script loading (MediaPipe) and certain canvas operations.

---

This architecture keeps the project simple for a static site while giving clear boundaries between concerns.