// Vice Cover Studio — editor wiring.
//
// Owns the studio state (arrangement, wash, size, words, caption style,
// one photo + framing per panel slot) and connects it to the page: the
// pickers, the file input, drag-to-pan and wheel-to-zoom on the canvas,
// keyboard shortcuts, the shuffle and randomize helpers, and the PNG
// export. A `?shot=` query hands control to ./shots.js instead, which
// stages one fixed scene for a screenshot.

import { ARRANGEMENTS, CAPTION_STYLES, EMBLEM_CORNERS, EMBLEM_SIZES, SIZE_SPECS, WASHES, paintPoster, slotBoxes } from './cover.js';
import { applyScene } from './shots.js';

const stage = document.getElementById('stage');
const headlineInput = document.getElementById('headline');
const taglineInput = document.getElementById('tagline');
const fileInput = document.getElementById('pickFiles');
const note = document.getElementById('note');

/** One framing slot: the photo plus its pan (dx/dy, canvas px) and zoom. */
function blankSlot() {
  return { photo: null, zoom: 1, dx: 0, dy: 0 };
}

export const studio = {
  arrangement: 'hero',
  wash: 'sunset',
  sizeName: 'wide',
  headline: "Lucia's Run",
  tagline: 'Outrun The Dawn',
  captionStyle: 'shadow',
  emblem: { enabled: true, corner: 'tr', size: 'medium' },
  vignette: 0.35,
  grain: 0.12,
  slots: [blankSlot(), blankSlot(), blankSlot(), blankSlot()],
  picked: 0,
};

/**
 * One-click scene cards: a full poster recipe — layout, grade, caption,
 * words, size, emblem, and finish — that loads the two sample photos
 * into the panels so a single click stages a finished cover.
 */
export const SCENE_PRESETS = [
  {
    name: 'Neon Reign',
    layout: 'triptych', grade: 'neonNights', captionStyle: 'chrome',
    headline: 'Neon Reign', tagline: 'Rule The Night', sizeName: 'story',
    emblem: { enabled: true, corner: 'tr', size: 'medium' },
    vignette: 0.45, grain: 0.18, photos: ['pier', 'boulevard'],
  },
  {
    name: 'Golden Getaway',
    layout: 'triptych', grade: 'sunsetGold', captionStyle: 'chrome',
    headline: 'Golden Getaway', tagline: 'Chase The Last Light', sizeName: 'portrait',
    emblem: { enabled: true, corner: 'bl', size: 'large' },
    vignette: 0.3, grain: 0.1, photos: ['boulevard', 'pier'],
  },
  {
    name: 'Vice After Dark',
    layout: 'hero', grade: 'neonNights', captionStyle: 'chrome',
    headline: 'Vice After Dark', tagline: 'The City Never Sleeps', sizeName: 'wide',
    emblem: { enabled: true, corner: 'br', size: 'small' },
    vignette: 0.55, grain: 0.22, photos: ['pier', 'pier'],
  },
  {
    name: 'Boulevard Kings',
    layout: 'strip', grade: 'sunsetGold', captionStyle: 'outline',
    headline: 'Boulevard Kings', tagline: 'Own Every Mile', sizeName: 'square',
    emblem: { enabled: false, corner: 'tr', size: 'medium' },
    vignette: 0.2, grain: 0.08, photos: ['boulevard', 'boulevard'],
  },
];

/** Loads an image from a URL, resolving once it can be drawn. */
export function fetchImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** Resizes the stage canvas to the chosen export size, then repaints. */
export function refresh() {
  const spec = SIZE_SPECS[studio.sizeName] || SIZE_SPECS.wide;
  if (stage.width !== spec.w || stage.height !== spec.h) {
    stage.width = spec.w;
    stage.height = spec.h;
  }
  paintPoster(stage, studio);
}

/** Marks the active chip inside one picker group. */
function markActive(group, value) {
  document.querySelectorAll(`[data-${group}]`).forEach((chip) => {
    const on = chip.dataset[group] === value;
    chip.classList.toggle('chip-on', on);
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function setArrangement(name) {
  if (!ARRANGEMENTS.includes(name)) return;
  studio.arrangement = name;
  markActive('arrangement', name);
  refresh();
}

function setWash(name) {
  if (!Object.hasOwn(WASHES, name)) return;
  studio.wash = name;
  markActive('wash', name);
  refresh();
}

function setSizeName(name) {
  if (!Object.hasOwn(SIZE_SPECS, name)) return;
  studio.sizeName = name;
  markActive('size', name);
  refresh();
}

function setCaptionStyle(name) {
  if (!CAPTION_STYLES.includes(name)) return;
  studio.captionStyle = name;
  markActive('captionStyle', name);
  refresh();
}

/** Shows or hides the corner VICE seal and keeps the toggle in sync. */
function setEmblemEnabled(on) {
  studio.emblem.enabled = on;
  const toggle = document.getElementById('emblemToggle');
  if (toggle) toggle.checked = on;
  refresh();
}

/** Moves the VICE seal to another corner of the poster. */
function setEmblemCorner(corner) {
  if (!EMBLEM_CORNERS.includes(corner)) return;
  studio.emblem.corner = corner;
  markActive('emblemCorner', corner);
  refresh();
}

/** Grows or shrinks the VICE seal. */
function setEmblemSize(size) {
  if (!EMBLEM_SIZES.includes(size)) return;
  studio.emblem.size = size;
  markActive('emblemSize', size);
  refresh();
}

/** Sets the edge-darkening strength (0–1) and its slider readout. */
function setVignette(value) {
  studio.vignette = Math.max(0, Math.min(1, Number(value) || 0));
  const slider = document.getElementById('vignetteRange');
  if (slider) slider.value = String(studio.vignette);
  const readout = document.getElementById('vignetteValue');
  if (readout) readout.textContent = `${Math.round(studio.vignette * 100)}%`;
  refresh();
}

/** Sets the film-grain amount (0–1) and its slider readout. */
function setGrain(value) {
  studio.grain = Math.max(0, Math.min(1, Number(value) || 0));
  const slider = document.getElementById('grainRange');
  if (slider) slider.value = String(studio.grain);
  const readout = document.getElementById('grainValue');
  if (readout) readout.textContent = `${Math.round(studio.grain * 100)}%`;
  refresh();
}

/**
 * Loads one scene card in a single click: layout, grade, caption style,
 * words, size, emblem, finish, and the two sample photos dealt into the
 * panels. The rail controls are synced so the card's choices stay visible.
 */
async function applyPreset(preset) {
  if (!preset) return;
  setArrangement(preset.layout);
  setWash(preset.grade);
  setCaptionStyle(preset.captionStyle);
  setSizeName(preset.sizeName);
  studio.headline = preset.headline;
  studio.tagline = preset.tagline;
  headlineInput.value = preset.headline;
  taglineInput.value = preset.tagline;
  studio.emblem = { ...preset.emblem };
  setEmblemEnabled(preset.emblem.enabled);
  setEmblemCorner(preset.emblem.corner);
  setEmblemSize(preset.emblem.size);
  setVignette(preset.vignette);
  setGrain(preset.grain);
  const names = preset.photos || ['pier', 'boulevard'];
  const loaded = await Promise.allSettled(names.map((name) => fetchImage(`samples/${name}.jpg`)));
  const photos = loaded.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  studio.slots.forEach((slot, i) => {
    slot.photo = photos[i % Math.max(1, photos.length)] || null;
    slot.zoom = 1;
    slot.dx = 0;
    slot.dy = 0;
  });
  document.querySelectorAll('[data-preset]').forEach((card) => {
    const on = card.dataset.preset === preset.name;
    card.classList.toggle('preset-on', on);
    card.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  refresh();
  note.textContent = `Scene "${preset.name}" loaded — ${preset.layout} layout, ${preset.grade} grade, ${preset.captionStyle} caption.`;
}

/** Picks one item from a list at random. */
function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** Steps to a different layout than the current one, at random. */
function shuffleLayout() {
  const others = ARRANGEMENTS.filter((name) => name !== studio.arrangement);
  setArrangement(pickRandom(others));
  note.textContent = `Layout: ${studio.arrangement}.`;
}

/**
 * Fresh random poster: a new layout, a new grade, a new caption style,
 * and the loaded photos dealt into the panels in a random order.
 */
function randomizePoster() {
  setArrangement(pickRandom(ARRANGEMENTS));
  setWash(pickRandom(Object.keys(WASHES)));
  setCaptionStyle(pickRandom(CAPTION_STYLES));
  // The finish gets a fresh roll too: a random seal corner and size, and
  // new vignette and grain strengths, so no two random posters share a
  // finish even when the layout and grade repeat.
  setEmblemEnabled(Math.random() > 0.25);
  setEmblemCorner(pickRandom(EMBLEM_CORNERS));
  setEmblemSize(pickRandom(EMBLEM_SIZES));
  setVignette(Math.round(Math.random() * 60) / 100);
  setGrain(Math.round(Math.random() * 30) / 100);
  const photos = studio.slots.map((slot) => slot.photo).filter(Boolean);
  for (let i = photos.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [photos[i], photos[j]] = [photos[j], photos[i]];
  }
  studio.slots.forEach((slot, i) => {
    slot.photo = photos[i] || null;
    slot.zoom = 1;
    slot.dx = 0;
    slot.dy = 0;
  });
  refresh();
  note.textContent = `Randomized — ${studio.arrangement} layout, ${studio.wash} grade, ${studio.captionStyle} caption, emblem ${studio.emblem.enabled ? `on (${studio.emblem.corner}, ${studio.emblem.size})` : 'off'}.`;
}

/** First empty slot, or the picked slot when every slot already has a photo. */
function nextFreeSlot() {
  const empty = studio.slots.findIndex((slot) => !slot.photo);
  return empty === -1 ? studio.picked : empty;
}

/** Drops each chosen file into the first empty panel, in order. */
async function takeFiles(files) {
  let placed = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const target = nextFreeSlot();
    try {
      studio.slots[target].photo = await fetchImage(URL.createObjectURL(file));
    } catch {
      note.textContent = `Could not read ${file.name}.`;
      continue;
    }
    studio.slots[target].zoom = 1;
    studio.slots[target].dx = 0;
    studio.slots[target].dy = 0;
    studio.picked = target;
    placed += 1;
  }
  refresh();
  if (placed > 0) note.textContent = `Loaded ${placed} photo${placed > 1 ? 's' : ''} — drag a panel to pan, scroll to zoom.`;
}

/** Which panel (if any) sits under a pointer position on the stage. */
function slotAt(clientX, clientY) {
  const rect = stage.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * stage.width;
  const y = ((clientY - rect.top) / rect.height) * stage.height;
  const boxes = slotBoxes(stage.width, stage.height, studio.arrangement);
  return boxes.findIndex((box) => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h);
}

function resetFraming(index) {
  const slot = studio.slots[index];
  if (!slot) return;
  slot.zoom = 1;
  slot.dx = 0;
  slot.dy = 0;
  refresh();
}

/** Paints the poster at full export size and downloads it as a PNG. */
function exportPng() {
  const spec = SIZE_SPECS[studio.sizeName] || SIZE_SPECS.wide;
  const off = document.createElement('canvas');
  off.width = spec.w;
  off.height = spec.h;
  paintPoster(off, studio);
  off.toBlob((blob) => {
    if (!blob) { note.textContent = 'Export failed — try again.'; return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${studio.sizeName}-${spec.w}x${spec.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    note.textContent = `Saved vice-cover-${studio.sizeName}-${spec.w}x${spec.h}.png`;
  }, 'image/png');
}

// --- Pointer framing: drag pans the panel under the cursor, wheel zooms it. ---
let drag = null;
stage.addEventListener('pointerdown', (event) => {
  const index = slotAt(event.clientX, event.clientY);
  if (index === -1) return;
  studio.picked = index;
  drag = { index, x: event.clientX, y: event.clientY };
  stage.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const rect = stage.getBoundingClientRect();
  const scaleX = stage.width / rect.width;
  const scaleY = stage.height / rect.height;
  const slot = studio.slots[drag.index];
  slot.dx += (event.clientX - drag.x) * scaleX;
  slot.dy += (event.clientY - drag.y) * scaleY;
  drag.x = event.clientX;
  drag.y = event.clientY;
  refresh();
});
stage.addEventListener('pointerup', () => { drag = null; });
stage.addEventListener('pointercancel', () => { drag = null; });
stage.addEventListener('wheel', (event) => {
  event.preventDefault();
  const index = slotAt(event.clientX, event.clientY);
  if (index === -1) return;
  studio.picked = index;
  const slot = studio.slots[index];
  slot.zoom = Math.max(1, Math.min(4, slot.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
  refresh();
}, { passive: false });
stage.addEventListener('dblclick', (event) => {
  const index = slotAt(event.clientX, event.clientY);
  if (index === -1) return;
  resetFraming(index);
  note.textContent = `Panel ${index + 1} framing reset.`;
});

// --- Controls. ---
fileInput.addEventListener('change', (event) => {
  takeFiles([...event.target.files]);
  fileInput.value = '';
});
// Paste an image from the clipboard straight into the first empty panel.
document.addEventListener('paste', (event) => {
  const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith('image/'));
  if (files.length) takeFiles(files);
});
headlineInput.addEventListener('input', () => { studio.headline = headlineInput.value; refresh(); });
taglineInput.addEventListener('input', () => { studio.tagline = taglineInput.value; refresh(); });
document.querySelectorAll('[data-arrangement]').forEach((chip) => {
  chip.addEventListener('click', () => setArrangement(chip.dataset.arrangement));
});
document.querySelectorAll('[data-wash]').forEach((chip) => {
  chip.addEventListener('click', () => setWash(chip.dataset.wash));
});
document.querySelectorAll('[data-size]').forEach((chip) => {
  chip.addEventListener('click', () => setSizeName(chip.dataset.size));
});
document.querySelectorAll('[data-captionStyle]').forEach((chip) => {
  chip.addEventListener('click', () => setCaptionStyle(chip.dataset.captionStyle));
});
document.querySelectorAll('[data-preset]').forEach((card) => {
  card.addEventListener('click', () => {
    const preset = SCENE_PRESETS.find((item) => item.name === card.dataset.preset);
    applyPreset(preset);
  });
});
document.getElementById('emblemToggle').addEventListener('change', (event) => {
  setEmblemEnabled(event.target.checked);
});
document.querySelectorAll('[data-emblemCorner]').forEach((chip) => {
  chip.addEventListener('click', () => setEmblemCorner(chip.dataset.emblemCorner));
});
document.querySelectorAll('[data-emblemSize]').forEach((chip) => {
  chip.addEventListener('click', () => setEmblemSize(chip.dataset.emblemSize));
});
document.getElementById('vignetteRange').addEventListener('input', (event) => {
  setVignette(event.target.value);
});
document.getElementById('grainRange').addEventListener('input', (event) => {
  setGrain(event.target.value);
});
document.getElementById('shuffleLayout').addEventListener('click', shuffleLayout);
document.getElementById('randomize').addEventListener('click', randomizePoster);
document.getElementById('resetFrame').addEventListener('click', () => {
  resetFraming(studio.picked);
  note.textContent = `Panel ${studio.picked + 1} framing reset.`;
});
document.getElementById('savePng').addEventListener('click', exportPng);

// Keys 1–6 switch the layout, E exports, R randomizes, S shuffles the
// layout — all without reaching for the mouse.
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return;
  const at = ['1', '2', '3', '4', '5', '6'].indexOf(event.key);
  if (at !== -1) { setArrangement(ARRANGEMENTS[at]); return; }
  const key = event.key.toLowerCase();
  if (key === 'e') exportPng();
  else if (key === 'r') randomizePoster();
  else if (key === 's') shuffleLayout();
});

// --- Start: a fixed screenshot scene, or the plain editor with samples. ---
const params = new URLSearchParams(location.search);
if (params.get('shot')) {
  document.fonts.ready.then(() => applyScene(params, studio, fetchImage, refresh));
} else {
  // Plain editor: two samples to start from, painted once the condensed
  // title font is in so the first paint already uses the real lettering.
  Promise.allSettled([
    fetchImage('samples/boulevard.jpg').then((img) => { studio.slots[0].photo = img; }),
    fetchImage('samples/pier.jpg').then((img) => { studio.slots[1].photo = img; }),
  ]).then(async () => {
    try { await document.fonts.load('900 100px ViceCondensed'); } catch { /* fallback font */ }
    await document.fonts.ready;
    refresh();
    note.textContent = 'Samples loaded — add your own photos to begin.';
  });
  refresh();
}
