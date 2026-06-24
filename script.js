const CANVAS_SIZE = 300;
const PIXEL_TO_MM = 0.2;
const STROKE_COLOR = '#00ff88';
let BEZIER_STEPS = 10;
const NORMALIZE_PADDING = 0.9;

const DEFAULT_PARAMS = {
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

let currentParams = { ...DEFAULT_PARAMS };

const PRESETS = {
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

const GCODE_CONFIG = {
  penUpZ: 5,
  penDownZ: 0,
  feedRate: 800,
};

// Images available in the ./images/ folder
const AVAILABLE_IMAGES = [
  'apple_vector.jpg',
  'man_face.jpg',
];

const dom = {
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

const inputCtx = dom.inputCanvas.getContext('2d');
const plotterCtx = dom.plotterCanvas.getContext('2d');

const state = {
  uploadedImage: null,
  pathsPoints: [],
  animReq: null,
  isPlaying: false,
  currentPathIndex: 0,
  currentPointIndex: 0,
  speed: 1,
  penDown: false,
  lastUploadedFile: null,
  sessionImages: [], // { name, url } for uploads made this session
};

const SvgParser = {
  TOKEN_REGEX: /[a-zA-Z]|-?\d*\.?\d+/g,

  extractPaths(svg, postOpts = {}) {
    const opts = {
      simplifyTolerance: 0.9,
      minPoints: 3,
      minLength: 3.5,
      sortByLength: true,
      ...postOpts,
    };

    const paths = [];
    const pathRegex = /<path[^>]*d="([^"]+)"[^>]*>/g;
    let match;

    while ((match = pathRegex.exec(svg)) !== null) {
      const points = this.parsePathData(match[1]);
      if (points.length > 1) paths.push(points);
    }

    this.normalizePaths(paths, CANVAS_SIZE, CANVAS_SIZE);

    // === Configurable post-processing ===
    let filtered = this.filterShortPaths(paths, opts.minPoints, opts.minLength);

    filtered = filtered.map(p => this.simplifyPath(p, opts.simplifyTolerance))
                       .filter(p => p.length > 1);

    if (opts.sortByLength) {
      filtered.sort((a, b) => this.computePathLength(b) - this.computePathLength(a));
    }

    return filtered;
  },

  // Returns approximate total length of a path
  computePathLength(path) {
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      len += Math.hypot(dx, dy);
    }
    return len;
  },

  // Basic filter using point count + path length
  filterShortPaths(paths, minPoints = 3, minLength = 3.5) {
    return paths.filter(path => {
      if (path.length < minPoints) return false;
      return this.computePathLength(path) >= minLength;
    });
  },

  // Light path simplification: drops points that are close to the line between neighbors.
  // tolerance controls aggressiveness (higher = more aggressive simplification)
  simplifyPath(points, tolerance = 1.0) {
    if (points.length <= 2) return points.slice();

    const result = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const prev = result[result.length - 1];
      const curr = points[i];
      const next = points[i + 1];
      if (this.perpendicularDistance(curr, prev, next) > tolerance) {
        result.push(curr);
      }
    }
    result.push(points[points.length - 1]);
    return result;
  },

  perpendicularDistance(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    return Math.hypot(p.x - projX, p.y - projY);
  },

  parsePathData(d) {
    const tokens = d.match(this.TOKEN_REGEX);
    if (!tokens) return [];

    let i = 0;
    let cmd = null;
    let x = 0;
    let y = 0;
    let startX = 0;
    let startY = 0;
    const points = [];

    const addPoint = (px, py) => {
      points.push({ x: px, y: py });
      x = px;
      y = py;
    };

    while (i < tokens.length) {
      const token = tokens[i];

      if (/[a-zA-Z]/.test(token)) {
        cmd = token;
        i++;
        continue;
      }

      switch (cmd) {
        case 'M':
          x = parseFloat(tokens[i++]);
          y = parseFloat(tokens[i++]);
          startX = x;
          startY = y;
          addPoint(x, y);
          break;

        case 'L':
          addPoint(parseFloat(tokens[i++]), parseFloat(tokens[i++]));
          break;

        case 'C': {
          const x1 = parseFloat(tokens[i++]);
          const y1 = parseFloat(tokens[i++]);
          const x2 = parseFloat(tokens[i++]);
          const y2 = parseFloat(tokens[i++]);
          const x3 = parseFloat(tokens[i++]);
          const y3 = parseFloat(tokens[i++]);
          this.flattenCubicBezier(x, y, x1, y1, x2, y2, x3, y3, addPoint);
          x = x3;
          y = y3;
          break;
        }

        case 'Q': {
          const x1 = parseFloat(tokens[i++]);
          const y1 = parseFloat(tokens[i++]);
          const x2 = parseFloat(tokens[i++]);
          const y2 = parseFloat(tokens[i++]);
          this.flattenQuadraticBezier(x, y, x1, y1, x2, y2, addPoint);
          x = x2;
          y = y2;
          break;
        }

        case 'Z':
        case 'z':
          addPoint(startX, startY);
          break;

        default:
          i++;
      }
    }

    return points;
  },

  flattenCubicBezier(x0, y0, x1, y1, x2, y2, x3, y3, addPoint) {
    const step = 1 / BEZIER_STEPS;
    for (let t = 0; t <= 1; t += step) {
      const mt = 1 - t;
      addPoint(
        mt ** 3 * x0 + 3 * mt ** 2 * t * x1 + 3 * mt * t ** 2 * x2 + t ** 3 * x3,
        mt ** 3 * y0 + 3 * mt ** 2 * t * y1 + 3 * mt * t ** 2 * y2 + t ** 3 * y3
      );
    }
  },

  flattenQuadraticBezier(x0, y0, x1, y1, x2, y2, addPoint) {
    const step = 1 / BEZIER_STEPS;
    for (let t = 0; t <= 1; t += step) {
      const mt = 1 - t;
      addPoint(
        mt ** 2 * x0 + 2 * mt * t * x1 + t ** 2 * x2,
        mt ** 2 * y0 + 2 * mt * t * y1 + t ** 2 * y2
      );
    }
  },

  normalizePaths(paths, width, height) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const path of paths) {
      for (const point of path) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }

    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;
    const scale = NORMALIZE_PADDING * Math.min(width / dx, height / dy);
    const offsetX = (width - dx * scale) / 2;
    const offsetY = (height - dy * scale) / 2;

    for (const path of paths) {
      for (const point of path) {
        point.x = (point.x - minX) * scale + offsetX;
        point.y = (point.y - minY) * scale + offsetY;
      }
    }
  },
};

const PlotterSimulator = {
  reset() {
    cancelAnimationFrame(state.animReq);
    state.isPlaying = false;
    state.currentPathIndex = 0;
    state.currentPointIndex = 0;
    state.penDown = false;

    plotterCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    plotterCtx.lineWidth = 1;
    plotterCtx.strokeStyle = STROKE_COLOR;
    plotterCtx.lineCap = 'round';
    plotterCtx.lineJoin = 'round';

    this.updateProgress();
  },

  updateProgress() {
    if (!state.pathsPoints.length) {
      dom.progressText.textContent = 'Progress: 0%';
      return;
    }

    let totalPoints = 0;
    let completedPoints = 0;

    for (let i = 0; i < state.pathsPoints.length; i++) {
      const pathLength = state.pathsPoints[i].length;
      totalPoints += pathLength;

      if (i < state.currentPathIndex) {
        completedPoints += pathLength;
      } else if (i === state.currentPathIndex) {
        completedPoints += state.currentPointIndex;
      }
    }

    const percent = totalPoints > 0 ? Math.floor((completedPoints / totalPoints) * 100) : 0;
    const pathIdx = Math.min(state.currentPathIndex, state.pathsPoints.length);
    dom.progressText.textContent = `Progress: ${percent}% (${pathIdx}/${state.pathsPoints.length} paths)`;
  },

  step() {
    if (!state.isPlaying || state.pathsPoints.length === 0) return;

    const path = state.pathsPoints[state.currentPathIndex];
    if (!path) {
      state.isPlaying = false;
      return;
    }

    for (let s = 0; s < state.speed; s++) {
      if (state.currentPointIndex === 0) {
        plotterCtx.beginPath();
        plotterCtx.moveTo(path[0].x, path[0].y);
        state.penDown = true;
        state.currentPointIndex = 1;
      } else if (state.currentPointIndex < path.length) {
        const point = path[state.currentPointIndex];
        if (state.penDown) {
          plotterCtx.lineTo(point.x, point.y);
          plotterCtx.stroke();
        }
        state.currentPointIndex++;
      } else {
        state.penDown = false;
        state.currentPathIndex++;
        state.currentPointIndex = 0;
        break;
      }
    }

    this.updateProgress();
    state.animReq = requestAnimationFrame(() => this.step());
  },

  play() {
    if (!state.pathsPoints.length || state.isPlaying) return;
    state.isPlaying = true;
    state.animReq = requestAnimationFrame(() => this.step());
  },

  pause() {
    state.isPlaying = false;
    cancelAnimationFrame(state.animReq);
  },
};

const Exporter = {
  toMm(pixels) {
    return pixels * PIXEL_TO_MM;
  },

  toMmFixed(pixels) {
    return this.toMm(pixels).toFixed(2);
  },

  toMmNumber(pixels) {
    return parseFloat(this.toMmFixed(pixels));
  },

  forEachDrawSegment(paths, handlers) {
    for (const path of paths) {
      if (path.length === 0) continue;

      handlers.penUp();
      handlers.moveTo(path[0]);

      for (let i = 1; i < path.length; i++) {
        handlers.drawTo(path[i]);
      }
    }

    handlers.penUp();
  },

  generateGcode(paths) {
    const lines = [
      '; XY Plotter G-code Export',
      '; Generated from SVG trace',
      'G21 ; Set units to mm',
      'G90 ; Absolute positioning',
      'G28 ; Home all axes',
      '',
    ];

    const { penUpZ, penDownZ, feedRate } = GCODE_CONFIG;

    this.forEachDrawSegment(paths, {
      penUp: () => lines.push(`G0 Z${penUpZ} ; Pen up`),
      moveTo: (point) => {
        lines.push(`G0 X${this.toMmFixed(point.x)} Y${this.toMmFixed(point.y)} ; Move to start`);
        lines.push(`G0 Z${penDownZ} ; Pen down`);
      },
      drawTo: (point) => {
        lines.push(`G1 X${this.toMmFixed(point.x)} Y${this.toMmFixed(point.y)} F${feedRate}`);
      },
    });

    lines.push(`G0 Z${penUpZ} ; Pen up at end`);
    lines.push('G28 ; Return home');
    lines.push('M30 ; End program');

    return lines.join('\n');
  },

  generateJson(paths) {
    const commands = [];

    this.forEachDrawSegment(paths, {
      penUp: () => commands.push({ cmd: 'pen_up' }),
      moveTo: (point) => {
        commands.push({
          cmd: 'move',
          x: this.toMmNumber(point.x),
          y: this.toMmNumber(point.y),
        });
        commands.push({ cmd: 'pen_down' });
      },
      drawTo: (point) => {
        commands.push({
          cmd: 'line',
          x: this.toMmNumber(point.x),
          y: this.toMmNumber(point.y),
        });
      },
    });

    return JSON.stringify(commands, null, 2);
  },

  download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },
};

const ImageLoader = {
  drawCentered(img, ctx) {
    const scale = Math.min(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
    const width = img.width * scale;
    const height = img.height * scale;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.drawImage(
      img,
      (CANVAS_SIZE - width) / 2,
      (CANVAS_SIZE - height) / 2,
      width,
      height
    );
  },

  loadFromFile(file) {
    const img = new Image();
    img.onload = () => {
      state.uploadedImage = img;
      state.lastUploadedFile = file;
      this.drawCentered(img, inputCtx);
      dom.traceBtn.disabled = false;
      if (dom.saveToLibraryBtn) dom.saveToLibraryBtn.disabled = false;
      // Auto-trace for easy experimentation with tuning params
      performTrace().catch(console.error);
    };
    img.src = URL.createObjectURL(file);
  },

  loadFromUrl(url, displayName = null) {
    const img = new Image();
    img.onload = () => {
      state.uploadedImage = img;
      // When loading from library we don't have a File to save
      state.lastUploadedFile = null;
      this.drawCentered(img, inputCtx);
      dom.traceBtn.disabled = false;
      if (dom.saveToLibraryBtn) dom.saveToLibraryBtn.disabled = true;
      // Auto-trace for easy experimentation
      performTrace().catch(console.error);
    };
    img.onerror = () => {
      alert('Failed to load image: ' + (displayName || url));
    };
    img.src = url;
  },
};

function enableSimulationControls() {
  for (const button of [dom.playBtn, dom.pauseBtn, dom.exportGcodeBtn, dom.exportJsonBtn]) {
    button.disabled = false;
  }
}

function downloadFileToSave(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name || 'image.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function addSessionImageFromFile(file, objectUrl) {
  // Add to session images so user can re-select it easily this session
  state.sessionImages = state.sessionImages.filter(s => s.name !== file.name);
  state.sessionImages.unshift({ name: file.name, url: objectUrl, file });
  renderLibrary();
}

function renderLibrary() {
  if (!dom.libraryThumbnails) return;
  dom.libraryThumbnails.innerHTML = '';

  // 1. Folder images
  for (const filename of AVAILABLE_IMAGES) {
    const thumb = createThumbnail(`images/${filename}`, filename, () => {
      ImageLoader.loadFromUrl(`images/${filename}`, filename);
    });
    dom.libraryThumbnails.appendChild(thumb);
  }

  // 2. Session uploads (from this run)
  for (const sess of state.sessionImages) {
    const thumb = createThumbnail(sess.url, sess.name + ' (session)', () => {
      ImageLoader.loadFromUrl(sess.url, sess.name);
      // Restore ability to save this uploaded file
      state.lastUploadedFile = sess.file || null;
      if (dom.saveToLibraryBtn) {
        dom.saveToLibraryBtn.disabled = !sess.file;
      }
    });
    // Mark as session
    thumb.style.borderColor = '#ffaa00';
    dom.libraryThumbnails.appendChild(thumb);
  }
}

function createThumbnail(src, label, onClick) {
  const wrapper = document.createElement('div');
  wrapper.className = 'thumbnail';

  const img = document.createElement('img');
  img.src = src;
  img.alt = label;
  img.loading = 'lazy';

  const labelEl = document.createElement('div');
  labelEl.className = 'label';
  labelEl.textContent = label;

  wrapper.appendChild(img);
  wrapper.appendChild(labelEl);

  wrapper.addEventListener('click', onClick);

  return wrapper;
}

// =====================
// Tuning parameter helpers
// =====================

function getCurrentParamsFromUI() {
  const p = { ...currentParams };
  if (dom.paramLtres) p.ltres = parseFloat(dom.paramLtres.value);
  if (dom.paramQtres) p.qtres = parseFloat(dom.paramQtres.value);
  if (dom.paramPathomit) p.pathomit = parseFloat(dom.paramPathomit.value);
  if (dom.paramNumColors) p.numberofcolors = parseInt(dom.paramNumColors.value, 10);
  if (dom.paramBlur) p.blurradius = parseInt(dom.paramBlur.value, 10);
  if (dom.paramBezier) p.bezierSteps = parseInt(dom.paramBezier.value, 10);
  if (dom.paramSimplify) p.simplifyTolerance = parseFloat(dom.paramSimplify.value);
  if (dom.paramMinLen) p.minLength = parseFloat(dom.paramMinLen.value);
  if (dom.paramMinPts) p.minPoints = parseInt(dom.paramMinPts.value, 10);
  if (dom.paramSort) p.sortByLength = !!dom.paramSort.checked;
  return p;
}

function updateParamLabels(p = currentParams) {
  if (dom.valLtres) dom.valLtres.textContent = Number(p.ltres).toFixed(1);
  if (dom.valQtres) dom.valQtres.textContent = Number(p.qtres).toFixed(1);
  if (dom.valPathomit) dom.valPathomit.textContent = p.pathomit;
  if (dom.valNumColors) dom.valNumColors.textContent = p.numberofcolors;
  if (dom.valBlur) dom.valBlur.textContent = p.blurradius;
  if (dom.valBezier) dom.valBezier.textContent = p.bezierSteps;
  if (dom.valSimplify) dom.valSimplify.textContent = Number(p.simplifyTolerance).toFixed(1);
  if (dom.valMinLen) dom.valMinLen.textContent = Number(p.minLength).toFixed(1);
  if (dom.valMinPts) dom.valMinPts.textContent = p.minPoints;
}

function syncUIFromParams(p) {
  if (dom.paramLtres) dom.paramLtres.value = p.ltres;
  if (dom.paramQtres) dom.paramQtres.value = p.qtres;
  if (dom.paramPathomit) dom.paramPathomit.value = p.pathomit;
  if (dom.paramNumColors) dom.paramNumColors.value = p.numberofcolors;
  if (dom.paramBlur) dom.paramBlur.value = p.blurradius;
  if (dom.paramBezier) dom.paramBezier.value = p.bezierSteps;
  if (dom.paramSimplify) dom.paramSimplify.value = p.simplifyTolerance;
  if (dom.paramMinLen) dom.paramMinLen.value = p.minLength;
  if (dom.paramMinPts) dom.paramMinPts.value = p.minPoints;
  if (dom.paramSort) dom.paramSort.checked = !!p.sortByLength;
  updateParamLabels(p);
}

function resetToDefaultParams() {
  currentParams = { ...DEFAULT_PARAMS };
  syncUIFromParams(currentParams);
  if (state.uploadedImage) {
    performTrace().catch(console.error);
  }
}

function applyPreset(name) {
  if (!PRESETS[name]) return;
  currentParams = {
    ...currentParams,
    ...PRESETS[name],
  };
  syncUIFromParams(currentParams);
  if (state.uploadedImage) {
    performTrace().catch(console.error);
  }
}

let retraceTimeout = null;
function debouncedRetrace() {
  if (!state.uploadedImage) return;
  clearTimeout(retraceTimeout);
  retraceTimeout = setTimeout(() => {
    performTrace().catch(console.error);
  }, 260);
}

function initTuningParams() {
  currentParams = { ...DEFAULT_PARAMS };
  syncUIFromParams(currentParams);

  // Attach listeners for all range inputs
  const rangeIds = [
    'paramLtres', 'paramQtres', 'paramPathomit', 'paramNumColors',
    'paramBlur', 'paramBezier', 'paramSimplify', 'paramMinLen', 'paramMinPts'
  ];
  rangeIds.forEach(id => {
    const el = dom[id];
    if (el) {
      el.addEventListener('input', () => {
        currentParams = getCurrentParamsFromUI();
        updateParamLabels(currentParams);
        debouncedRetrace();
      });
    }
  });

  if (dom.paramSort) {
    dom.paramSort.addEventListener('change', () => {
      currentParams = getCurrentParamsFromUI();
      debouncedRetrace();
    });
  }

  if (dom.resetParamsBtn) {
    dom.resetParamsBtn.addEventListener('click', resetToDefaultParams);
  }

  // Wire quick preset buttons (Simple / Balanced / Detailed)
  const presetButtons = document.querySelectorAll('#tuningPanel [data-preset]');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      applyPreset(btn.dataset.preset);
    });
  });

  // FaceMesh checkbox - retrace when toggled
  if (dom.useFaceMesh) {
    dom.useFaceMesh.addEventListener('change', () => {
      if (state.uploadedImage) {
        performTrace().catch(console.error);
      }
    });
  }
}

// =====================
// MediaPipe FaceMesh / FaceLandmarker support (optional)
// =====================

let faceLandmarker = null;

async function ensureFaceLandmarker() {
  if (faceLandmarker) return faceLandmarker;

  // Load the bundle on demand (only when user enables the checkbox)
  if (!window.FilesetResolver || !window.FaceLandmarker) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.js';
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load MediaPipe library. Check your internet connection.'));
      document.head.appendChild(script);
    });
  }

  const vision = await window.FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
  );

  faceLandmarker = await window.FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    },
    runningMode: 'IMAGE',
    numFaces: 1,
  });

  return faceLandmarker;
}

async function detectFaceLandmarks(imageSource) {
  const landmarker = await ensureFaceLandmarker();
  const results = landmarker.detect(imageSource);
  if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
    throw new Error('No face detected. Try a clearer front-facing selfie.');
  }
  return results.faceLandmarks[0];
}

// Standard MediaPipe face landmark connections for clean line art
const FACE_CONNECTIONS = [
  // Face oval
  [10,338],[338,297],[297,332],[332,284],[284,251],[251,389],[389,356],[356,454],[454,323],[323,361],[361,288],[288,397],[397,365],[365,379],[379,378],[378,400],[400,377],[377,152],[152,148],[148,176],[176,149],[149,150],[150,136],[136,172],[172,58],[58,132],[132,93],[93,234],[234,127],[127,162],[162,21],[21,54],[54,103],[103,67],[67,109],[109,10],
  // Outer lips
  [61,146],[146,91],[91,181],[181,84],[84,17],[17,314],[314,405],[405,321],[321,375],[375,291],[291,409],[409,270],[270,269],[269,267],[267,0],[0,37],[37,39],[39,40],[40,185],[185,61],
  // Left eye
  [263,249],[249,390],[390,373],[373,374],[374,380],[380,381],[381,382],[382,362],[362,263],
  // Right eye
  [33,7],[7,163],[163,144],[144,145],[145,153],[153,154],[154,155],[155,133],[133,33],
  // Left eyebrow
  [276,283],[283,282],[282,295],[295,285],[285,300],[300,293],[293,334],[334,296],[296,336],
  // Right eyebrow
  [46,53],[53,52],[52,65],[65,55],[55,70],[70,63],[63,105],[105,66],[66,107],
  // Nose
  [168,6],[6,197],[197,195],[195,5],[5,4],[4,1],[1,275],[275,274],[274,455],[455,308]
];

function drawFaceLines(ctx, landmarks, size) {
  // White background + clean black lines = excellent input for ImageTracer
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  FACE_CONNECTIONS.forEach(([start, end]) => {
    const p1 = landmarks[start];
    const p2 = landmarks[end];
    if (p1 && p2) {
      ctx.beginPath();
      ctx.moveTo(p1.x * size, p1.y * size);
      ctx.lineTo(p2.x * size, p2.y * size);
      ctx.stroke();
    }
  });
}

async function processWithFaceMesh() {
  const landmarks = await detectFaceLandmarks(dom.inputCanvas);

  // Build a clean black & white line drawing from the detected face contours
  const procCanvas = document.createElement('canvas');
  procCanvas.width = CANVAS_SIZE;
  procCanvas.height = CANVAS_SIZE;
  const pctx = procCanvas.getContext('2d', { willReadFrequently: true });

  drawFaceLines(pctx, landmarks, CANVAS_SIZE);

  return procCanvas.toDataURL('image/png');
}

// =====================
// End MediaPipe support
// =====================

async function performTrace() {
  if (!state.uploadedImage) return;

  const useFaceMesh = !!(dom.useFaceMesh && dom.useFaceMesh.checked);

  if (useFaceMesh) {
    try {
      // Process with MediaPipe first to generate a clean face line drawing
      const processedDataUrl = await processWithFaceMesh();

      const traceOpts = buildTraceOptions();
      BEZIER_STEPS = currentParams.bezierSteps || 10;

      ImageTracer.imageToSVG(
        processedDataUrl,
        (svg) => {
          dom.svgContainer.innerHTML = svg;
          const postOpts = {
            bezierSteps: currentParams.bezierSteps,
            simplifyTolerance: currentParams.simplifyTolerance,
            minPoints: currentParams.minPoints,
            minLength: currentParams.minLength,
            sortByLength: currentParams.sortByLength,
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
      // continue to normal flow below
    }
  }

  // === Normal ImageTracer path (when FaceMesh is off or failed) ===
  const dataURL = dom.inputCanvas.toDataURL('image/png');
  const traceOpts = buildTraceOptions();

  BEZIER_STEPS = currentParams.bezierSteps || 10;

  ImageTracer.imageToSVG(
    dataURL,
    (svg) => {
      dom.svgContainer.innerHTML = svg;
      const postOpts = {
        bezierSteps: currentParams.bezierSteps,
        simplifyTolerance: currentParams.simplifyTolerance,
        minPoints: currentParams.minPoints,
        minLength: currentParams.minLength,
        sortByLength: currentParams.sortByLength,
      };
      state.pathsPoints = SvgParser.extractPaths(svg, postOpts);
      PlotterSimulator.reset();
      enableSimulationControls();
    },
    traceOpts
  );
}

function buildTraceOptions() {
  const p = currentParams;
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

function init() {
  dom.fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Create a stable object URL for the session gallery
    const objectUrl = URL.createObjectURL(file);

    ImageLoader.loadFromFile(file);

    // Add/replace in session images so user can pick it again easily
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

  // Render selectable images from the images/ folder + any session uploads
  renderLibrary();

  // Initialize tuning UI + currentParams
  initTuningParams();
}

init();