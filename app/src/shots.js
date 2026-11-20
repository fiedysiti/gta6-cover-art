// Fixed scenes for screenshots.
//
// `?shot=editor` shows the editor with sample photos loaded; `?shot=cover`
// shows the finished cover alone, full frame. Query knobs: `size` (square,
// portrait, wide), `layout` and `grade`, `photo` / `photo2` (the samples),
// `caption` / `subtitle`. `window.__shotReady` is set once the scene has
// been painted, so the screenshot harness knows when to capture.

import { EXPORT_SIZES } from './cover.js';

// Per-panel framing for the cover scenes, so a single photo fills the whole
// cover without every panel showing the same crop.
const SCENE_FRAMING = [
  { ox: 0, oy: 0, zoom: 1 },
  { ox: -0.12, oy: 0, zoom: 1 },
  { ox: 0, oy: 0.1, zoom: 1 },
  { ox: 0.14, oy: 0, zoom: 1.15 },
];

function readScene(query) {
  return {
    layout: query.get('layout') || 'hero',
    grade: query.get('grade') || 'sunset',
    photo: query.get('photo') || 'boulevard',
    photo2: query.get('photo2') || 'pier',
    caption: query.get('caption') || 'Neon Bay',
    subtitle: query.get('subtitle') || 'Vice City Nights',
    size: EXPORT_SIZES[query.get('size')] ? query.get('size') : 'square',
  };
}

function syncPickers(scene) {
  document.querySelectorAll('#layouts .layout-btn').forEach((b) => {
    const on = b.dataset.layout === scene.layout;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  document.querySelectorAll('#grades .grade-btn').forEach((b) => {
    const on = b.dataset.grade === scene.grade;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

export async function runShot(shot, query, app) {
  const { state, loadSample, setPreviewSize, redraw, titleInput, subtitleInput } = app;
  const scene = readScene(query);

  state.layout = scene.layout;
  state.grade = scene.grade;
  state.title = scene.caption;
  state.subtitle = scene.subtitle;
  titleInput.value = scene.caption;
  subtitleInput.value = scene.subtitle;
  syncPickers(scene);

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    setPreviewSize(scene.size);
  }

  await loadSample(scene.photo, [0]);
  await loadSample(scene.photo2, [1, 2, 3]);
  SCENE_FRAMING.forEach((frame, i) => {
    Object.assign(state.panels[i], frame);
  });
  redraw();
  // The paint above is synchronous, so the scene is already on the canvas;
  // flag readiness directly instead of waiting on requestAnimationFrame,
  // which a headless browser only fires when a frame is produced on demand.
  window.__shotReady = true;
}
