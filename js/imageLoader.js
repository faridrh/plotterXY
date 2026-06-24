// js/imageLoader.js
import { CANVAS_SIZE } from './config.js';
import { dom, inputCtx } from './dom.js';
import { state } from './state.js';

export const ImageLoader = {
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

      // Auto-trace using dynamic import to avoid tight coupling
      import('./tracer.js').then(m => m.performTraceSafe()).catch(console.error);
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

      import('./tracer.js').then(m => m.performTraceSafe()).catch(console.error);
    };
    img.onerror = () => {
      alert('Failed to load image: ' + (displayName || url));
    };
    img.src = url;
  },
};
