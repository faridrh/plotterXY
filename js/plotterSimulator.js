// js/plotterSimulator.js
import { CANVAS_SIZE, STROKE_COLOR } from './config.js';
import { dom, plotterCtx } from './dom.js';
import { state } from './state.js';

export const PlotterSimulator = {
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
