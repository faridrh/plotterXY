// js/tuning.js
import { dom } from './dom.js';
import { state } from './state.js';
import {
  DEFAULT_PARAMS,
  PRESETS,
  currentParams as _currentParams,
  setBezierSteps,
} from './config.js';

// Use the window bridge set by main.js to avoid circular imports
function performTraceSafe() {
  if (window.performTraceSafe) {
    window.performTraceSafe();
  }
}

// We keep a local reference and sync back
let currentParams = _currentParams;

export function getCurrentParams() {
  return currentParams;
}

export function setCurrentParams(newParams) {
  currentParams = newParams;
}

export function getCurrentParamsFromUI() {
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

export function updateParamLabels(p = currentParams) {
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

export function syncUIFromParams(p) {
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

export function resetToDefaultParams() {
  currentParams = { ...DEFAULT_PARAMS };
  syncUIFromParams(currentParams);
  if (state.uploadedImage) {
    performTraceSafe();
  }
}

export function applyPreset(name) {
  if (!PRESETS[name]) return;
  currentParams = {
    ...currentParams,
    ...PRESETS[name],
  };
  syncUIFromParams(currentParams);
  if (state.uploadedImage) {
    performTraceSafe();
  }
}

let retraceTimeout = null;

export function debouncedRetrace() {
  if (!state.uploadedImage) return;
  clearTimeout(retraceTimeout);
  retraceTimeout = setTimeout(() => {
    performTraceSafe();
  }, 260);
}

export function initTuningParams() {
  currentParams = { ...DEFAULT_PARAMS };
  syncUIFromParams(currentParams);

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

  // Wire quick preset buttons
  const presetButtons = document.querySelectorAll('#tuningPanel [data-preset]');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      applyPreset(btn.dataset.preset);
    });
  });

  // FaceMesh checkbox
  if (dom.useFaceMesh) {
    dom.useFaceMesh.addEventListener('change', () => {
      if (state.uploadedImage) {
        performTraceSafe();
      }
    });
  }
}

// Note: currentParams is managed locally here. Use getCurrentParams() from outside.
