// Vice Cover Studio — fixed scenes for screenshots.
//
// A `?shot=` query stages one reproducible scene: `cover` hides the editor
// and shows only the poster, `editor` keeps the whole page visible. The
// query picks the export size, arrangement, colour wash, caption style,
// the two sample photos (cycled across the visible panels) and the words.
// Once the photos and the title font are in and the poster is painted,
// `window.__shotReady` is set so a screenshot can be taken.

import { ARRANGEMENTS, CAPTION_STYLES, SIZE_SPECS, WASHES } from './cover.js';

/** Loads one sample photo by its short name (`samples/<name>.jpg`). */
function samplePhoto(fetchImage, name) {
  return fetchImage(`samples/${name}.jpg`);
}

/**
 * Mirrors the staged scene back into the editor controls, so an `editor`
 * screenshot shows the same words and the same active chips as the poster.
 */
function syncControls(studio) {
  const headline = document.getElementById('headline');
  if (headline) headline.value = studio.headline;
  const tagline = document.getElementById('tagline');
  if (tagline) tagline.value = studio.tagline;
  const groups = {
    arrangement: studio.arrangement,
    wash: studio.wash,
    size: studio.sizeName,
    captionStyle: studio.captionStyle,
    emblemCorner: studio.emblem?.corner,
    emblemSize: studio.emblem?.size,
  };
  for (const [group, value] of Object.entries(groups)) {
    document.querySelectorAll(`[data-${group}]`).forEach((chip) => {
      const on = chip.dataset[group] === value;
      chip.classList.toggle('chip-on', on);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  // The finish controls are not chip groups: sync the badge toggle and
  // both sliders (plus their readouts) so the editor shot matches the
  // staged poster exactly.
  const toggle = document.getElementById('emblemToggle');
  if (toggle) toggle.checked = Boolean(studio.emblem?.enabled);
  const vignette = document.getElementById('vignetteRange');
  if (vignette) vignette.value = String(studio.vignette ?? 0);
  const vignetteValue = document.getElementById('vignetteValue');
  if (vignetteValue) vignetteValue.textContent = `${Math.round((studio.vignette ?? 0) * 100)}%`;
  const grain = document.getElementById('grainRange');
  if (grain) grain.value = String(studio.grain ?? 0);
  const grainValue = document.getElementById('grainValue');
  if (grainValue) grainValue.textContent = `${Math.round((studio.grain ?? 0) * 100)}%`;
}

/**
 * Reads one query value only when it names a value the app actually
 * offers, so a typo in a scene URL falls back to the editor default
 * instead of staging a broken scene.
 */
function pickFrom(query, key, allowed) {
  const value = query.get(key);
  return value !== null && allowed.includes(value) ? value : null;
}

/**
 * Stages the scene described by `query` into `studio`, paints through
 * `refresh`, then flags the page ready. `fetchImage` loads images,
 * `refresh` repaints the stage at the scene's size.
 */
export async function applyScene(query, studio, fetchImage, refresh) {
  const shot = query.get('shot');
  if (shot === 'cover') document.body.classList.add('cover-only');

  const size = pickFrom(query, 'size', Object.keys(SIZE_SPECS));
  if (size) studio.sizeName = size;
  const layout = pickFrom(query, 'layout', ARRANGEMENTS);
  if (layout) studio.arrangement = layout;
  const grade = pickFrom(query, 'grade', Object.keys(WASHES));
  if (grade) studio.wash = grade;
  const style = pickFrom(query, 'captionStyle', CAPTION_STYLES);
  if (style) studio.captionStyle = style;
  const caption = query.get('caption');
  if (caption !== null) studio.headline = caption;
  const subtitle = query.get('subtitle');
  if (subtitle !== null) studio.tagline = subtitle;

  // Round-5 finish options: `emblem=on|off`, `emblemCorner=tl|tr|bl|br`,
  // `emblemSize=small|medium|large`, and `vignette` / `grain` as 0–1
  // numbers. Each is validated against what the app offers, like the
  // other scene values, so a typo falls back to the editor default.
  const emblemFlag = query.get('emblem');
  if (emblemFlag === 'on' || emblemFlag === 'off') {
    studio.emblem = { ...(studio.emblem || {}), enabled: emblemFlag === 'on' };
  }
  const corner = pickFrom(query, 'emblemCorner', ['tl', 'tr', 'bl', 'br']);
  if (corner) studio.emblem = { ...(studio.emblem || {}), corner };
  const emblemSize = pickFrom(query, 'emblemSize', ['small', 'medium', 'large']);
  if (emblemSize) studio.emblem = { ...(studio.emblem || {}), size: emblemSize };
  const vignetteRaw = Number(query.get('vignette'));
  if (Number.isFinite(vignetteRaw)) studio.vignette = Math.max(0, Math.min(1, vignetteRaw));
  const grainRaw = Number(query.get('grain'));
  if (Number.isFinite(grainRaw)) studio.grain = Math.max(0, Math.min(1, grainRaw));

  // Fill the visible panels by cycling the two named photos. A `zoom`
  // value (1–2) frames every panel a little tighter for close-up scenes.
  const first = query.get('photo') || 'pier';
  const second = query.get('photo2') || first;
  const zoomRaw = Number(query.get('zoom'));
  const zoom = Number.isFinite(zoomRaw) ? Math.max(1, Math.min(2, zoomRaw)) : 1;
  const names = [first, second, first, second];
  const loaded = await Promise.allSettled(names.map((name) => samplePhoto(fetchImage, name)));
  loaded.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      studio.slots[i].photo = result.value;
      studio.slots[i].zoom = zoom;
      studio.slots[i].dx = 0;
      studio.slots[i].dy = 0;
    }
  });

  // The condensed title font must be in before the first paint, or the
  // headline falls back to a system font in the screenshot.
  try { await document.fonts.load('900 100px ViceCondensed'); } catch { /* fallback font */ }
  await document.fonts.ready;
  syncControls(studio);
  refresh();
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  window.__shotReady = true;
}
