// Vice Cover Studio — UI wiring.
//
// Connects the controls in index.html to the renderer in cover.js: the photo
// library, layout and grade pickers, caption fields, per-panel drag / wheel
// zoom on the live preview, and PNG export in three sizes. A `?shot=` query
// hands control to shots.js instead, which stages a fixed scene for a
// screenshot (see ./shots.js).
import { drawCover, renderCover, panelRects, EXPORT_SIZES, EXPORT_ORDER } from './cover.js';
import { runShot } from './shots.js';

// Element handles, gathered once so the rest of the file reads as plain
// names instead of repeated getElementById calls.
const ui = {
  canvas: document.getElementById('cover'),
  title: document.getElementById('title'),
  subtitle: document.getElementById('subtitle'),
  zoom: document.getElementById('zoom'),
  grain: document.getElementById('grain'),
  status: document.getElementById('status'),
  library: document.getElementById('library'),
  layouts: document.getElementById('layouts'),
  grades: document.getElementById('grades'),
};

function newPanel() {
  return { img: null, zoom: 1, ox: 0, oy: 0 };
}

const state = {
  layout: 'hero',
  grade: 'sunset',
  title: ui.title.value,
  subtitle: ui.subtitle.value,
  grain: true,
  previewSize: 'square',
  panels: [newPanel(), newPanel(), newPanel(), newPanel()],
  selected: 0,
};

// The photo library: images in load order, plus which one the user last
// picked. A library image can sit in several panels at once.
const library = [];
let pickedLibrary = -1;

function paint() {
  // Screenshot scenes of the finished cover hide the selection outline;
  // the editor always outlines the selected panel.
  const outline = document.body.classList.contains('shot-cover') ? null : state.selected;
  drawCover(ui.canvas, state, { highlight: outline });
}

// Resizes the preview canvas to an export aspect and repaints.
function setPreview(sizeKey) {
  state.previewSize = sizeKey;
  const size = EXPORT_SIZES[sizeKey];
  const scale = 1080 / Math.max(size.w, size.h);
  ui.canvas.width = Math.round(size.w * scale);
  ui.canvas.height = Math.round(size.h * scale);
  paint();
}

// Loads an image from a URL; resolves once it can be drawn to a canvas.
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Adds an image to the library strip and returns its library index.
function addPhoto(img) {
  const index = library.length;
  library.push(img);
  const thumb = document.createElement('img');
  thumb.src = img.src;
  thumb.alt = `Photo ${index + 1}`;
  thumb.addEventListener('click', () => putInPanel(index));
  ui.library.appendChild(thumb);
  refreshLibrary();
  return index;
}

function refreshLibrary() {
  [...ui.library.children].forEach((thumb, i) => {
    thumb.classList.toggle('is-selected', i === pickedLibrary);
    thumb.classList.toggle('is-in-panel', state.panels.some((p) => p.img === library[i]));
  });
}

// Puts a library photo into the selected panel, resetting that panel's
// framing, and marks it as the picked photo.
function putInPanel(index) {
  pickedLibrary = index;
  const panel = state.panels[state.selected];
  panel.img = library[index];
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
  ui.zoom.value = '1';
  refreshLibrary();
  paint();
}

// Loads a bundled sample photo into the library and the listed panels.
async function loadSample(name, panelIndexes) {
  const img = await loadImage(`samples/${name}.jpg`);
  const index = addPhoto(img);
  panelIndexes.forEach((pi) => {
    state.panels[pi].img = img;
  });
  pickedLibrary = index;
  refreshLibrary();
  paint();
  return img;
}

// Returns the first panel with no photo, or -1 when all four are filled.
function firstFreePanel() {
  return state.panels.findIndex((p) => !p.img);
}

// Marks one button active inside a picker group and clears the rest.
function setActiveButton(container, selector, chosen) {
  container.querySelectorAll(selector).forEach((btn) => {
    const on = btn === chosen;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

function chooseLayout(button) {
  state.layout = button.dataset.layout;
  setActiveButton(ui.layouts, '.layout-btn', button);
  paint();
}

function chooseGrade(button) {
  state.grade = button.dataset.grade;
  setActiveButton(ui.grades, '.grade-btn', button);
  paint();
}

// Resets the selected panel's zoom and pan to its untouched framing.
function resetFraming() {
  const panel = state.panels[state.selected];
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
  ui.zoom.value = '1';
  ui.status.textContent = 'Framing reset for the selected panel.';
  paint();
}

function pickPanel(index) {
  state.selected = index;
  ui.zoom.value = String(state.panels[index].zoom);
  paint();
}

// --- Photo input -----------------------------------------------------------

document.getElementById('photos').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  for (const file of files) {
    const img = await loadImage(URL.createObjectURL(file));
    const index = addPhoto(img);
    if (pickedLibrary === -1) {
      pickedLibrary = index;
      state.panels[state.selected].img = img;
    } else {
      // Later uploads drop into the first empty panel so a batch of photos
      // fills the cover instead of piling onto the selected panel.
      const empty = firstFreePanel();
      if (empty !== -1) state.panels[empty].img = img;
    }
  }
  if (files.length) {
    ui.status.textContent = `${files.length} photo${files.length > 1 ? 's' : ''} added — click one to place it in the selected panel.`;
    refreshLibrary();
    paint();
  }
  e.target.value = '';
});

document.getElementById('sample-boulevard').addEventListener('click', () => loadSample('boulevard', [0]));
document.getElementById('sample-pier').addEventListener('click', () => loadSample('pier', [1, 2, 3]));
document.getElementById('fill-all').addEventListener('click', () => {
  const img = state.panels[state.selected].img;
  if (!img) {
    ui.status.textContent = 'Pick a photo for the selected panel first.';
    return;
  }
  state.panels.forEach((p) => { p.img = img; });
  refreshLibrary();
  paint();
  ui.status.textContent = 'All four panels now use the same photo — drag each one to frame it differently.';
});
document.getElementById('reset-frame').addEventListener('click', resetFraming);

// --- Layout, grade, caption -----------------------------------------------

ui.layouts.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-layout]');
  if (btn) chooseLayout(btn);
});
ui.grades.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-grade]');
  if (btn) chooseGrade(btn);
});
ui.zoom.addEventListener('input', () => {
  state.panels[state.selected].zoom = Number(ui.zoom.value);
  paint();
});
ui.grain.addEventListener('change', () => {
  state.grain = ui.grain.checked;
  paint();
});
ui.title.addEventListener('input', () => { state.title = ui.title.value; paint(); });
ui.subtitle.addEventListener('input', () => { state.subtitle = ui.subtitle.value; paint(); });

// Keys 1–3 switch layouts without reaching for the mouse.
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input[type=text]')) return;
  const layouts = ['hero', 'grid', 'strip'];
  const at = layouts[Number(e.key) - 1];
  if (!at) return;
  const btn = ui.layouts.querySelector(`[data-layout="${at}"]`);
  if (btn) chooseLayout(btn);
});

// --- Preview interaction: click to select, drag to pan, wheel to zoom ------

// Converts a pointer event to canvas pixels and finds the panel under it.
function panelAt(e) {
  const rect = ui.canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (ui.canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (ui.canvas.height / rect.height);
  const boxes = panelRects(state.layout, ui.canvas.width, ui.canvas.height);
  const index = boxes.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  return { index, x, y };
}

let drag = null;
ui.canvas.addEventListener('pointerdown', (e) => {
  const hit = panelAt(e);
  if (hit.index === -1) return;
  pickPanel(hit.index);
  ui.canvas.setPointerCapture(e.pointerId);
  const panel = state.panels[hit.index];
  drag = { x: hit.x, y: hit.y, ox: panel.ox, oy: panel.oy };
});
ui.canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const hit = panelAt(e);
  const boxes = panelRects(state.layout, ui.canvas.width, ui.canvas.height);
  const panelBox = boxes[state.selected];
  const panel = state.panels[state.selected];
  panel.ox = Math.max(-0.5, Math.min(0.5, drag.ox + (hit.x - drag.x) / panelBox.w));
  panel.oy = Math.max(-0.5, Math.min(0.5, drag.oy + (hit.y - drag.y) / panelBox.h));
  paint();
});
ui.canvas.addEventListener('pointerup', () => { drag = null; });
ui.canvas.addEventListener('dblclick', resetFraming);
ui.canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selected];
  panel.zoom = Math.max(1, Math.min(2.5, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  ui.zoom.value = String(panel.zoom);
  paint();
}, { passive: false });

// --- Export ----------------------------------------------------------------

// Renders one size and downloads it as a PNG.
function downloadSize(sizeKey) {
  setPreview(sizeKey);
  const size = EXPORT_SIZES[sizeKey];
  const out = renderCover(state, sizeKey);
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    ui.status.textContent = `Saved vice-cover-${size.w}x${size.h}.png`;
  }, 'image/png');
}

document.getElementById('export-square').addEventListener('click', () => downloadSize('square'));
document.getElementById('export-portrait').addEventListener('click', () => downloadSize('portrait'));
document.getElementById('export-wide').addEventListener('click', () => downloadSize('wide'));
document.getElementById('export-all').addEventListener('click', async () => {
  ui.status.textContent = 'Exporting all three sizes…';
  for (const key of EXPORT_ORDER) {
    downloadSize(key);
    await new Promise((r) => setTimeout(r, 400));
  }
});

// --- Start -----------------------------------------------------------------

// The condensed title font ships with the app; wait for it before the first
// paint so the preview and the exports letter the title the same way.
async function start() {
  try {
    await document.fonts.load(`900 100px 'Vice Condensed'`);
    await document.fonts.ready;
  } catch {
    // The system fallback stack still letters the title if the font fails.
  }
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    await runShot(shot, query, {
      state, loadSample, setPreviewSize: setPreview, redraw: paint,
      titleInput: ui.title, subtitleInput: ui.subtitle,
    });
  } else {
    paint();
  }
}

start();
