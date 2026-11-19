// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos
// loaded; ?shot=cover shows the exported cover alone, full frame. `size` picks
// the export size (square, portrait, wide), `layout` and `grade` the look,
// `photo`/`photo2` the samples, `caption`/`subtitle` the words.
// window.__shotReady is set once painted.
export async function runShot(shot, query, app) {
  const { state, loadSample, setPreviewSize, redraw, titleInput, subtitleInput } = app;
  const layout = query.get('layout') || 'hero';
  const grade = query.get('grade') || 'sunset';
  const photo = query.get('photo') || 'boulevard';
  const photo2 = query.get('photo2') || 'pier';
  const caption = query.get('caption') || 'Neon Bay';
  const sub = query.get('subtitle') || 'Vice City Nights';
  const size = query.get('size') || 'square';

  state.layout = layout;
  state.grade = grade;
  state.title = caption;
  state.subtitle = sub;
  titleInput.value = caption;
  subtitleInput.value = sub;
  document.querySelectorAll('#layouts .layout-btn').forEach((b) => {
    const active = b.dataset.layout === layout;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('#grades .grade-btn').forEach((b) => {
    const active = b.dataset.grade === grade;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
  });

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    setPreviewSize(size);
  }

  await loadSample(photo, [0]);
  await loadSample(photo2, [1, 2, 3]);
  // Frame each panel differently so one photo fills the whole cover.
  state.panels[1].ox = -0.12;
  state.panels[2].oy = 0.1;
  state.panels[3].ox = 0.14;
  state.panels[3].zoom = 1.15;
  redraw();
  // The draw above is synchronous, so the scene is painted already; mark the
  // shot ready directly instead of waiting on requestAnimationFrame, which a
  // headless browser only fires when a frame is produced on demand.
  window.__shotReady = true;
}
