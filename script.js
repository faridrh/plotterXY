const fileInput = document.getElementById('fileInput');
const traceBtn = document.getElementById('traceBtn');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const speedRange = document.getElementById('speedRange');
const exportGcodeBtn = document.getElementById('exportGcodeBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const progressText = document.getElementById('progressText');

const inputCanvas = document.getElementById('inputCanvas');
const inputCtx = inputCanvas.getContext('2d');

const plotterCanvas = document.getElementById('plotterCanvas');
const plotterCtx = plotterCanvas.getContext('2d');

const svgContainer = document.getElementById('svgContainer');

let svgString = null;
let pathsPoints = [];
let animReq = null;
let isPlaying = false;
let currentPathIndex = 0;
let currentPointIndex = 0;
let speed = 1;
let penDown = false; // pen state: true = drawing, false = traveling

// -----------------------------
// 1. Load image into canvas
// -----------------------------
fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    const scale = Math.min(300 / img.width, 300 / img.height);
    const w = img.width * scale;
    const h = img.height * scale;

    inputCtx.clearRect(0, 0, 300, 300);
    inputCtx.drawImage(img, (300 - w) / 2, (300 - h) / 2, w, h);

    window._uploadedImage = img;   // IMPORTANT FIX
    traceBtn.disabled = false;
  };

  img.src = URL.createObjectURL(file);
});

// -----------------------------
// 2. Trace with ImageTracer.js
// -----------------------------
traceBtn.addEventListener('click', () => {
  if (!window._uploadedImage) return;

  const options = {
    ltres: 0.5,
    qtres: 0.5,
    pathomit: 0,
    numberofcolors: 2,
    strokewidth: 1,
    linefilter: true,
    scale: 1
  };
  
  const dataURL = inputCanvas.toDataURL("image/png");
  ImageTracer.imageToSVG(
    dataURL,
    svg => {
      svgString = svg;
      svgContainer.innerHTML = svgString;
      extractPathsFromSVG(svgString);
      resetSimulation();
      playBtn.disabled = false;
      pauseBtn.disabled = false;
      exportGcodeBtn.disabled = false;
      exportJsonBtn.disabled = false;
    },
    options
  );
});

// -----------------------------
// 3. Extract SVG paths → points
// -----------------------------
function extractPathsFromSVG(svg) {
  pathsPoints = [];
  const pathRegex = /<path[^>]*d="([^"]+)"[^>]*>/g;
  let match;

  while ((match = pathRegex.exec(svg)) !== null) {
    const d = match[1];
    const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g);
    if (!tokens) continue;

    let i = 0;
    let cmd = null;
    let x = 0, y = 0;
    let startX = 0, startY = 0;
    const pts = [];

    function addPoint(px, py) {
      pts.push({ x: px, y: py });
      x = px; y = py;
    }

    while (i < tokens.length) {
      const t = tokens[i];

      if (/[a-zA-Z]/.test(t)) {
        cmd = t;
        i++;
        continue;
      }

      switch (cmd) {
        case 'M':
          x = parseFloat(tokens[i++]);
          y = parseFloat(tokens[i++]);
          startX = x; startY = y;
          addPoint(x, y);
          break;

        case 'L':
          x = parseFloat(tokens[i++]);
          y = parseFloat(tokens[i++]);
          addPoint(x, y);
          break;

        case 'C': {
          let x1 = parseFloat(tokens[i++]);
          let y1 = parseFloat(tokens[i++]);
          let x2 = parseFloat(tokens[i++]);
          let y2 = parseFloat(tokens[i++]);
          let x3 = parseFloat(tokens[i++]);
          let y3 = parseFloat(tokens[i++]);

          // flatten cubic Bézier into 20 segments
          for (let t = 0; t <= 1; t += 0.05) {
            const xt = (1-t)**3 * x + 3*(1-t)**2 * t * x1 + 3*(1-t)*t**2 * x2 + t**3 * x3;
            const yt = (1-t)**3 * y + 3*(1-t)**2 * t * y1 + 3*(1-t)*t**2 * y2 + t**3 * y3;
            addPoint(xt, yt);
          }
          x = x3; y = y3;
          break;
        }

        case 'Q': {
          let x1 = parseFloat(tokens[i++]);
          let y1 = parseFloat(tokens[i++]);
          let x2 = parseFloat(tokens[i++]);
          let y2 = parseFloat(tokens[i++]);

          // flatten quadratic Bézier
          for (let t = 0; t <= 1; t += 0.05) {
            const xt = (1-t)**2 * x + 2*(1-t)*t * x1 + t**2 * x2;
            const yt = (1-t)**2 * y + 2*(1-t)*t * y1 + t**2 * y2;
            addPoint(xt, yt);
          }
          x = x2; y = y2;
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

    if (pts.length > 1) pathsPoints.push(pts);
  }

  normalizePaths(pathsPoints, 300, 300);
}

function normalizePaths(paths, w, h) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  paths.forEach(path => {
    path.forEach(p => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
  });

  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;
  const scale = 0.9 * Math.min(w / dx, h / dy);
  const offsetX = (w - dx * scale) / 2;
  const offsetY = (h - dy * scale) / 2;

  paths.forEach(path => {
    path.forEach(p => {
      p.x = (p.x - minX) * scale + offsetX;
      p.y = (p.y - minY) * scale + offsetY;
    });
  });
}

// -----------------------------
// 4. XY Plotter Simulation
// -----------------------------
function resetSimulation() {
  cancelAnimationFrame(animReq);
  isPlaying = false;
  currentPathIndex = 0;
  currentPointIndex = 0;
  penDown = false;

  plotterCtx.clearRect(0, 0, 300, 300);
  plotterCtx.lineWidth = 1;
  plotterCtx.strokeStyle = '#00ff88';
  plotterCtx.lineCap = 'round';
  plotterCtx.lineJoin = 'round';

  updateProgress();
}

function updateProgress() {
  if (!pathsPoints.length) {
    progressText.textContent = 'Progress: 0%';
    return;
  }

  let totalPoints = 0;
  let completedPoints = 0;

  for (let i = 0; i < pathsPoints.length; i++) {
    totalPoints += pathsPoints[i].length;
    if (i < currentPathIndex) {
      completedPoints += pathsPoints[i].length;
    } else if (i === currentPathIndex) {
      completedPoints += currentPointIndex;
    }
  }

  const percent = totalPoints > 0 ? Math.floor((completedPoints / totalPoints) * 100) : 0;
  progressText.textContent = `Progress: ${percent}%`;
}

function stepSimulation() {
  if (!isPlaying || pathsPoints.length === 0) return;

  const path = pathsPoints[currentPathIndex];
  if (!path) { isPlaying = false; return; }

  for (let s = 0; s < speed; s++) {
    if (currentPointIndex === 0) {
      // PEN DOWN: start drawing this path
      plotterCtx.beginPath();
      plotterCtx.moveTo(path[0].x, path[0].y);
      penDown = true;
      currentPointIndex = 1;
    } else if (currentPointIndex < path.length) {
      const p = path[currentPointIndex];
      if (penDown) {
        plotterCtx.lineTo(p.x, p.y);
        plotterCtx.stroke();
      }
      currentPointIndex++;
    } else {
      // PEN UP: finish this path, move to next
      penDown = false;
      currentPathIndex++;
      currentPointIndex = 0;
      break;
    }
  }

  updateProgress();
  animReq = requestAnimationFrame(stepSimulation);
}

playBtn.addEventListener('click', () => {
  if (!pathsPoints.length) return;
  if (!isPlaying) {
    isPlaying = true;
    animReq = requestAnimationFrame(stepSimulation);
  }
});

pauseBtn.addEventListener('click', () => {
  isPlaying = false;
  cancelAnimationFrame(animReq);
});

speedRange.addEventListener('input', () => {
  speed = parseFloat(speedRange.value);
});

// -----------------------------
// 5. Export Functions (G-code + JSON)
// -----------------------------
function generateGcode(paths) {
  let gcode = [];
  gcode.push('; XY Plotter G-code Export');
  gcode.push('; Generated from SVG trace');
  gcode.push('G21 ; Set units to mm');
  gcode.push('G90 ; Absolute positioning');
  gcode.push('G28 ; Home all axes');
  gcode.push('');

  const scale = 0.2;      // pixel to mm scaling
  const penUpZ = 5;
  const penDownZ = 0;

  paths.forEach((path, idx) => {
    if (path.length === 0) return;

    // Pen up, move to start
    const start = path[0];
    gcode.push(`G0 Z${penUpZ} ; Pen up`);
    gcode.push(`G0 X${(start.x * scale).toFixed(2)} Y${(start.y * scale).toFixed(2)} ; Move to start`);
    gcode.push(`G0 Z${penDownZ} ; Pen down`);

    // Draw the path
    for (let i = 1; i < path.length; i++) {
      const p = path[i];
      gcode.push(`G1 X${(p.x * scale).toFixed(2)} Y${(p.y * scale).toFixed(2)} F800`);
    }
  });

  gcode.push('G0 Z' + penUpZ + ' ; Pen up at end');
  gcode.push('G28 ; Return home');
  gcode.push('M30 ; End program');

  return gcode.join('\n');
}

function generateJson(paths) {
  const commands = [];
  const scale = 0.2;

  paths.forEach(path => {
    if (path.length === 0) return;

    commands.push({ cmd: 'pen_up' });
    commands.push({
      cmd: 'move',
      x: parseFloat((path[0].x * scale).toFixed(2)),
      y: parseFloat((path[0].y * scale).toFixed(2))
    });
    commands.push({ cmd: 'pen_down' });

    for (let i = 1; i < path.length; i++) {
      commands.push({
        cmd: 'line',
        x: parseFloat((path[i].x * scale).toFixed(2)),
        y: parseFloat((path[i].y * scale).toFixed(2))
      });
    }
  });

  commands.push({ cmd: 'pen_up' });
  return JSON.stringify(commands, null, 2);
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

exportGcodeBtn.addEventListener('click', () => {
  if (!pathsPoints.length) return;
  const gcode = generateGcode(pathsPoints);
  downloadFile(gcode, 'plotter_output.gcode', 'text/plain');
});

exportJsonBtn.addEventListener('click', () => {
  if (!pathsPoints.length) return;
  const json = generateJson(pathsPoints);
  downloadFile(json, 'plotter_output.json', 'application/json');
});

speed = parseFloat(speedRange.value);
