// js/state.js

export const state = {
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
