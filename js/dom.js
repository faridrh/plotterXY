// js/dom.js
// DOM element references and canvas contexts

export const dom = {
  fileInput: document.getElementById('fileInput'),
  traceBtn: document.getElementById('traceBtn'),
  playBtn: document.getElementById('playBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  speedRange: document.getElementById('speedRange'),
  exportGcodeBtn: document.getElementById('exportGcodeBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  progressText: document.getElementById('progressText'),
  inputCanvas: document.getElementById('inputCanvas'),
  plotterCanvas: document.getElementById('plotterCanvas'),
  svgContainer: document.getElementById('svgContainer'),
  faceMeshContainer: document.getElementById('faceMeshContainer'),
  libraryThumbnails: document.getElementById('libraryThumbnails'),
  saveToLibraryBtn: document.getElementById('saveToLibraryBtn'),
  // Tuning params
  resetParamsBtn: document.getElementById('resetParamsBtn'),
  paramLtres: document.getElementById('paramLtres'),
  paramQtres: document.getElementById('paramQtres'),
  paramPathomit: document.getElementById('paramPathomit'),
  paramNumColors: document.getElementById('paramNumColors'),
  paramBlur: document.getElementById('paramBlur'),
  paramBezier: document.getElementById('paramBezier'),
  paramSimplify: document.getElementById('paramSimplify'),
  paramMinLen: document.getElementById('paramMinLen'),
  paramMinPts: document.getElementById('paramMinPts'),
  paramSort: document.getElementById('paramSort'),
  useFaceMesh: document.getElementById('useFaceMesh'),
  valLtres: document.getElementById('valLtres'),
  valQtres: document.getElementById('valQtres'),
  valPathomit: document.getElementById('valPathomit'),
  valNumColors: document.getElementById('valNumColors'),
  valBlur: document.getElementById('valBlur'),
  valBezier: document.getElementById('valBezier'),
  valSimplify: document.getElementById('valSimplify'),
  valMinLen: document.getElementById('valMinLen'),
  valMinPts: document.getElementById('valMinPts'),
};

export const inputCtx = dom.inputCanvas.getContext('2d');
export const plotterCtx = dom.plotterCanvas.getContext('2d');
