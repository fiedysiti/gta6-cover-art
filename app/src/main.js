// Wires Vice Cover Studio: photo library, layouts, grades, caption, per-panel
// drag/zoom on the live preview, and one-click PNG export in three post sizes.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover, renderCover, panelRects, EXPORT_SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const zoomInput = document.getElementById('zoom');
const grainInput = document.getElementById('grain');
const status = document.getElementById('status');
const libraryEl = document.getElementById('library');

const state = {
  layout: 'hero',
  grade: 'sunset',
  title: titleInput.value,
  subtitle: subtitleInput.value,
  grain: true,
  previewSize: 'square',
  panels: [
    { img: null, zoom: 1, ox: 0, oy: 0 },
    { img: null, zoom: 1, ox: 0, oy: 0 },
    { img: null, zoom: 1, ox: 0, oy: 0 },
    { img: null, zoom: 1, ox: 0, oy: 0 },
  ],
  selected: 0,
};

const library = [];
let librarySelected = -1;

function redraw() {
  // In a cover shot the frame is the exported art itself, so no selection
  // outline; in the editor the outline marks the selected panel.
  const highlight = document.body.classList.contains('shot-cover') ? null : state.selected;
  drawCover(canvas, state, { highlight });
}

/** Resizes the preview canvas to the chosen export aspect and redraws. */
function setPreviewSize(sizeKey) {
  state.previewSize = sizeKey;
  const size = EXPORT_SIZES[sizeKey];
  const scale = 1080 / Math.max(size.w, size.h);
  canvas.width = Math.round(size.w * scale);
  canvas.height = Math.round(size.h * scale);
  redraw();
}

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Adds an image to the library and shows its thumbnail. */
function addToLibrary(img) {
  const index = library.length;
  library.push(img);
  const thumb = document.createElement('img');
  thumb.src = img.src;
  thumb.alt = `Photo ${index + 1}`;
  thumb.addEventListener('click', () => {
    librarySelected = index;
    state.panels[state.selected].img = img;
    state.panels[state.selected].zoom = 1;
    state.panels[state.selected].ox = 0;
    state.panels[state.selected].oy = 0;
    syncLibraryThumbs();
    zoomInput.value = '1';
    redraw();
  });
  libraryEl.appendChild(thumb);
  syncLibraryThumbs();
  return index;
}

function syncLibraryThumbs() {
  [...libraryEl.children].forEach((thumb, i) => {
    thumb.classList.toggle('is-selected', i === librarySelected);
    thumb.classList.toggle('is-in-panel', state.panels.some((p) => p.img === library[i]));
  });
}

/** Loads a bundled sample photo into the library and the given panels. */
async function loadSample(name, panelIndexes) {
  const img = await loadImage(`samples/${name}.jpg`);
  const index = addToLibrary(img);
  panelIndexes.forEach((pi) => {
    state.panels[pi].img = img;
  });
  librarySelected = index;
  syncLibraryThumbs();
  redraw();
  return img;
}

document.getElementById('photos').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  for (const file of files) {
    const img = await loadImage(URL.createObjectURL(file));
    const index = addToLibrary(img);
    if (librarySelected === -1) {
      librarySelected = index;
      state.panels[state.selected].img = img;
    }
  }
  if (files.length) {
    status.textContent = `${files.length} photo${files.length > 1 ? 's' : ''} added — click one to place it in the selected panel.`;
    syncLibraryThumbs();
    redraw();
  }
  e.target.value = '';
});
document.getElementById('sample-boulevard').addEventListener('click', () => loadSample('boulevard', [0]));
document.getElementById('sample-pier').addEventListener('click', () => loadSample('pier', [1, 2, 3]));
document.getElementById('fill-all').addEventListener('click', () => {
  const img = state.panels[state.selected].img;
  if (!img) {
    status.textContent = 'Pick a photo for the selected panel first.';
    return;
  }
  state.panels.forEach((p) => { p.img = img; });
  syncLibraryThumbs();
  redraw();
  status.textContent = 'All four panels now use the same photo — drag each one to frame it differently.';
});

document.getElementById('layouts').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-layout]');
  if (!btn) return;
  state.layout = btn.dataset.layout;
  document.querySelectorAll('#layouts .layout-btn').forEach((b) => {
    const active = b === btn;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  redraw();
});
document.getElementById('grades').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-grade]');
  if (!btn) return;
  state.grade = btn.dataset.grade;
  document.querySelectorAll('#grades .grade-btn').forEach((b) => {
    const active = b === btn;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  redraw();
});
zoomInput.addEventListener('input', () => {
  state.panels[state.selected].zoom = Number(zoomInput.value);
  redraw();
});
grainInput.addEventListener('change', () => {
  state.grain = grainInput.checked;
  redraw();
});
titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });

/** Maps a pointer event to canvas pixels, then to the panel under it. */
function panelAtEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  const index = rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  return { index, x, y };
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const hit = panelAtEvent(e);
  if (hit.index === -1) return;
  state.selected = hit.index;
  zoomInput.value = String(state.panels[hit.index].zoom);
  canvas.setPointerCapture(e.pointerId);
  drag = { x: hit.x, y: hit.y, ox: state.panels[hit.index].ox, oy: state.panels[hit.index].oy };
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const hit = panelAtEvent(e);
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  const rect = rects[state.selected];
  const panel = state.panels[state.selected];
  panel.ox = Math.max(-0.5, Math.min(0.5, drag.ox + (hit.x - drag.x) / rect.w));
  panel.oy = Math.max(-0.5, Math.min(0.5, drag.oy + (hit.y - drag.y) / rect.h));
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selected];
  panel.zoom = Math.max(1, Math.min(2.5, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  zoomInput.value = String(panel.zoom);
  redraw();
}, { passive: false });

/** Exports the cover at one size and downloads it as a PNG. */
function exportSize(sizeKey) {
  setPreviewSize(sizeKey);
  const size = EXPORT_SIZES[sizeKey];
  const out = renderCover(state, sizeKey);
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    status.textContent = `Saved vice-cover-${size.w}x${size.h}.png`;
  }, 'image/png');
}

document.getElementById('export-square').addEventListener('click', () => exportSize('square'));
document.getElementById('export-portrait').addEventListener('click', () => exportSize('portrait'));
document.getElementById('export-wide').addEventListener('click', () => exportSize('wide'));
document.getElementById('export-all').addEventListener('click', async () => {
  status.textContent = 'Exporting all three sizes…';
  for (const key of ['square', 'portrait', 'wide']) {
    exportSize(key);
    await new Promise((r) => setTimeout(r, 400));
  }
});

// The condensed title font ships with the app; wait for it before the first
// paint so the preview and the exports letter the title the same way.
async function start() {
  try {
    await document.fonts.load(`900 100px 'Vice Condensed'`);
    await document.fonts.ready;
  } catch {
    // The system fallback stack still letters the title if the font fails.
  }
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), {
      state, loadSample, setPreviewSize, redraw, titleInput, subtitleInput,
    });
  } else {
    redraw();
  }
}

start();
