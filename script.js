const CANVAS_SIZE = 300;
const PIXEL_TO_MM = 0.2;
const STROKE_COLOR = '#00ff88';
const BEZIER_STEPS = 20;
const NORMALIZE_PADDING = 0.9;

const TRACE_OPTIONS = {
  ltres: 0.5,
  qtres: 0.5,
  pathomit: 0,
  numberofcolors: 2,
  strokewidth: 1,
  linefilter: true,
  scale: 1,
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

  extractPaths(svg) {
    const paths = [];
    const pathRegex = /<path[^>]*d="([^"]+)"[^>]*>/g;
    let match;

    while ((match = pathRegex.exec(svg)) !== null) {
      const points = this.parsePathData(match[1]);
      if (points.length > 1) paths.push(points);
    }

    this.normalizePaths(paths, CANVAS_SIZE, CANVAS_SIZE);
    return paths;
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
    dom.progressText.textContent = `Progress: ${percent}%`;
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

function handleTrace() {
  if (!state.uploadedImage) return;

  const dataURL = dom.inputCanvas.toDataURL('image/png');
  ImageTracer.imageToSVG(
    dataURL,
    (svg) => {
      dom.svgContainer.innerHTML = svg;
      state.pathsPoints = SvgParser.extractPaths(svg);
      PlotterSimulator.reset();
      enableSimulationControls();
    },
    TRACE_OPTIONS
  );
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
}

init();