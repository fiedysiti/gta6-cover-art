// Vice Cover Studio — fixed scenes for screenshots.
//
// A `?shot=` query stages one reproducible scene: `cover` hides the editor
// and shows only the poster, `editor` keeps the whole page visible. The
// query picks the export size, arrangement, colour wash, the two sample
// photos (cycled across the visible panels) and the words. Once the photos
// and the title font are in and the poster is painted,
// `window.__shotReady` is set so a screenshot can be taken.

import { ARRANGEMENTS, SIZE_SPECS, WASHES } from './cover.js';

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
  const groups = { arrangement: studio.arrangement, wash: studio.wash, size: studio.sizeName };
  for (const [group, value] of Object.entries(groups)) {
    document.querySelectorAll(`[data-${group}]`).forEach((chip) => {
      const on = chip.dataset[group] === value;
      chip.classList.toggle('chip-on', on);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
}

/**
 * Stages the scene described by `query` into `studio`, paints through
 * `refresh`, then flags the page ready. `fetchImage` loads images,
 * `refresh` repaints the stage at the scene's size.
 */
export async function applyScene(query, studio, fetchImage, refresh) {
  const shot = query.get('shot');
  if (shot === 'cover') document.body.classList.add('cover-only');

  const size = query.get('size');
  if (size && Object.hasOwn(SIZE_SPECS, size)) studio.sizeName = size;
  const layout = query.get('layout');
  if (layout && ARRANGEMENTS.includes(layout)) studio.arrangement = layout;
  const grade = query.get('grade');
  if (grade && Object.hasOwn(WASHES, grade)) studio.wash = grade;
  const caption = query.get('caption');
  if (caption !== null) studio.headline = caption;
  const subtitle = query.get('subtitle');
  if (subtitle !== null) studio.tagline = subtitle;

  // Fill the visible panels by cycling the two named photos.
  const first = query.get('photo') || 'pier';
  const second = query.get('photo2') || first;
  const names = [first, second, first, second];
  const loaded = await Promise.allSettled(names.map((name) => samplePhoto(fetchImage, name)));
  loaded.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      studio.slots[i].photo = result.value;
      studio.slots[i].zoom = 1;
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
