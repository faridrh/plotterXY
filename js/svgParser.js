// js/svgParser.js
import { CANVAS_SIZE, BEZIER_STEPS, NORMALIZE_PADDING } from './config.js';

export const SvgParser = {
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

  // Light path simplification
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
