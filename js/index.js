// js/index.js
// Optional barrel file for cleaner internal imports.
// Usage example (inside other modules):
//   import { SvgParser, performTraceSafe } from './index.js';

// Re-export commonly used modules
export * from './config.js';
export * from './dom.js';
export * from './state.js';
export * from './svgParser.js';
export * from './plotterSimulator.js';
export * from './exporter.js';
export * from './tracer.js';
export * from './tuning.js';

// Note: Not all modules are re-exported here to avoid pulling in side-effect heavy modules (imageLoader, faceMesh) unnecessarily.
