// js/library.js
import { AVAILABLE_IMAGES } from './config.js';
import { dom } from './dom.js';
import { state } from './state.js';
import { ImageLoader } from './imageLoader.js';
import { downloadFileToSave } from './utils.js';

export function enableSimulationControls() {
  for (const button of [dom.playBtn, dom.pauseBtn, dom.exportGcodeBtn, dom.exportJsonBtn]) {
    button.disabled = false;
  }
}

export function addSessionImageFromFile(file, objectUrl) {
  state.sessionImages = state.sessionImages.filter(s => s.name !== file.name);
  state.sessionImages.unshift({ name: file.name, url: objectUrl, file });
  renderLibrary();
}

export function renderLibrary() {
  if (!dom.libraryThumbnails) return;
  dom.libraryThumbnails.innerHTML = '';

  // 1. Folder images
  for (const filename of AVAILABLE_IMAGES) {
    const thumb = createThumbnail(`images/${filename}`, filename, () => {
      ImageLoader.loadFromUrl(`images/${filename}`, filename);
    });
    dom.libraryThumbnails.appendChild(thumb);
  }

  // 2. Session uploads
  for (const sess of state.sessionImages) {
    const thumb = createThumbnail(sess.url, sess.name + ' (session)', () => {
      ImageLoader.loadFromUrl(sess.url, sess.name);
      state.lastUploadedFile = sess.file || null;
      if (dom.saveToLibraryBtn) {
        dom.saveToLibraryBtn.disabled = !sess.file;
      }
    });
    thumb.style.borderColor = '#ffaa00';
    dom.libraryThumbnails.appendChild(thumb);
  }
}

export function createThumbnail(src, label, onClick) {
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
