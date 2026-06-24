// js/config.js
// All shared constants and configuration

export const CANVAS_SIZE = 300;
export const PIXEL_TO_MM = 0.2;
export const STROKE_COLOR = '#00ff88';
export let BEZIER_STEPS = 10;   // mutable, updated by tuning
export const NORMALIZE_PADDING = 0.9;

export const DEFAULT_PARAMS = {
  // "Simple" preset defaults (clean, minimal lines for plotter)
  ltres: 2,
  qtres: 2,
  pathomit: 20,
  numberofcolors: 2,
  blurradius: 0,
  blurdelta: 20,
  bezierSteps: 8,
  simplifyTolerance: 1.0,
  minPoints: 4,
  minLength: 4,
  sortByLength: true,
};

export let currentParams = { ...DEFAULT_PARAMS };

export const PRESETS = {
  simple: {
    ltres: 2,
    qtres: 2,
    pathomit: 20,
    numberofcolors: 2,
    blurradius: 0,
    bezierSteps: 8,
    simplifyTolerance: 1.0,
    minPoints: 4,
    minLength: 4,
    sortByLength: true,
  },
  balanced: {
    ltres: 1,
    qtres: 1,
    pathomit: 10,
    numberofcolors: 3,
    blurradius: 0,
    bezierSteps: 10,
    simplifyTolerance: 0.7,
    minPoints: 3,
    minLength: 3,
    sortByLength: true,
  },
  detailed: {
    ltres: 0.5,
    qtres: 0.5,
    pathomit: 4,
    numberofcolors: 4,
    blurradius: 0,
    bezierSteps: 12,
    simplifyTolerance: 0.4,
    minPoints: 2,
    minLength: 1.5,
    sortByLength: true,
  },
};

export const GCODE_CONFIG = {
  penUpZ: 5,
  penDownZ: 0,
  feedRate: 800,
};

// Images available in the ./images/ folder (relative to index.html)
export const AVAILABLE_IMAGES = [
  'apple_vector.jpg',
  'man_face.jpg',
];

// Helper to update BEZIER_STEPS from outside
export function setBezierSteps(steps) {
  BEZIER_STEPS = steps;
}
