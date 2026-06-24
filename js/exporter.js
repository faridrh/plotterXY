// js/exporter.js
import { PIXEL_TO_MM } from './config.js';
import { GCODE_CONFIG } from './config.js';

export const Exporter = {
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
