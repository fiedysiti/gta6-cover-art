// Vice Cover Studio's cover engine: multi-panel GTA-poster layouts, Vice City
// sunset/neon grades, grain, vignette and a bold condensed title block. Every
// draw is pure canvas 2D, so the same code paints the live preview and the
// exported PNGs at 1080 x 1080, 1080 x 1350 and 1920 x 1080.

export const TITLE_FONT = "'Vice Condensed', 'Arial Narrow', 'Liberation Sans Narrow', sans-serif";

// Panel rectangles as fractions of the panel area (the cover above the title
// band). x, y, w, h are all in 0..1 of that area.
export const LAYOUTS = {
  hero: [
    { x: 0, y: 0, w: 0.62, h: 1 },
    { x: 0.62, y: 0, w: 0.38, h: 1 / 3 },
    { x: 0.62, y: 1 / 3, w: 0.38, h: 1 / 3 },
    { x: 0.62, y: 2 / 3, w: 0.38, h: 1 / 3 },
  ],
  grid: [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  strip: [
    { x: 0, y: 0, w: 1, h: 0.62 },
    { x: 0, y: 0.62, w: 1 / 3, h: 0.38 },
    { x: 1 / 3, y: 0.62, w: 1 / 3, h: 0.38 },
    { x: 2 / 3, y: 0.62, w: 1 / 3, h: 0.38 },
  ],
};

// A grade is a photo filter plus two colour washes painted over the photo
// with blend modes, so any photo gets the same sunset/neon treatment.
export const GRADES = {
  sunset: {
    filter: 'saturate(1.35) contrast(1.08)',
    wash: ['#ffb347', '#ff2e88'],
    washMode: 'soft-light',
    washAlpha: 0.6,
    tint: 'rgba(255, 110, 60, 0.14)',
  },
  neon: {
    filter: 'saturate(1.55) contrast(1.12)',
    wash: ['#00e5ff', '#ff2ea6'],
    washMode: 'overlay',
    washAlpha: 0.55,
    tint: 'rgba(0, 229, 255, 0.10)',
  },
  vice: {
    filter: 'saturate(1.45) contrast(1.06)',
    wash: ['#7b2fff', '#ff5ea8'],
    washMode: 'soft-light',
    washAlpha: 0.65,
    tint: 'rgba(123, 47, 255, 0.14)',
  },
  gold: {
    filter: 'saturate(1.3) contrast(1.05)',
    wash: ['#ffe08a', '#ff7b00'],
    washMode: 'soft-light',
    washAlpha: 0.55,
    tint: 'rgba(255, 179, 71, 0.14)',
  },
};

export const EXPORT_SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
};

// The title band's share of the cover height.
const TITLE_BAND = 0.15;

let grainPattern = null;
/** Builds (once) a small tile of random grey noise used for film grain. */
function getGrainPattern(ctx) {
  if (grainPattern) return grainPattern;
  const tile = document.createElement('canvas');
  tile.width = 160;
  tile.height = 160;
  const tctx = tile.getContext('2d');
  const data = tctx.createImageData(160, 160);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 96 + Math.floor(Math.random() * 64);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  tctx.putImageData(data, 0, 0);
  grainPattern = ctx.createPattern(tile, 'repeat');
  return grainPattern;
}

/** Panel rectangles in canvas pixels for a layout at cover size w x h. */
export function panelRects(layout, w, h) {
  const areaH = h * (1 - TITLE_BAND);
  const gutter = Math.max(4, Math.round(w * 0.006));
  return LAYOUTS[layout].map((p) => ({
    x: p.x * w + gutter / 2,
    y: p.y * areaH + gutter / 2,
    w: p.w * w - gutter,
    h: p.h * areaH - gutter,
  }));
}

/** Draws one photo into a panel rect, cover-fit, with zoom and pan offsets. */
function drawPanelPhoto(ctx, rect, panel, grade) {
  const img = panel.img;
  if (!img) return false;
  const zoom = panel.zoom || 1;
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  // Clamp the pan so the photo always covers the panel: no bare background
  // may show at an edge, whatever zoom and offset the user picked.
  const maxOx = Math.max(0, (dw - rect.w) / 2 / rect.w);
  const maxOy = Math.max(0, (dh - rect.h) / 2 / rect.h);
  const ox = Math.max(-maxOx, Math.min(maxOx, panel.ox || 0));
  const oy = Math.max(-maxOy, Math.min(maxOy, panel.oy || 0));
  const dx = rect.x + (rect.w - dw) / 2 + ox * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + oy * rect.h;
  ctx.save();
  ctx.filter = grade.filter;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
  return true;
}

/** Paints the grade's colour washes over a panel rect (already clipped). */
function gradePanel(ctx, rect, grade) {
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  g.addColorStop(0, grade.wash[0]);
  g.addColorStop(1, grade.wash[1]);
  ctx.save();
  ctx.globalCompositeOperation = grade.washMode;
  ctx.globalAlpha = grade.washAlpha;
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = grade.tint;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Draws the bold condensed title block along the foot of the cover. */
function drawTitleBlock(ctx, w, h, title, subtitle) {
  const bandY = h * (1 - TITLE_BAND);
  const bandH = h * TITLE_BAND;
  const pad = w * 0.035;
  const band = ctx.createLinearGradient(0, bandY, 0, h);
  band.addColorStop(0, '#1c0b28');
  band.addColorStop(1, '#0d0514');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY, w, bandH);
  const rule = ctx.createLinearGradient(0, 0, w, 0);
  rule.addColorStop(0, '#ffb347');
  rule.addColorStop(0.5, '#ff2e88');
  rule.addColorStop(1, '#7b2fff');
  ctx.fillStyle = rule;
  ctx.fillRect(0, bandY, w, Math.max(3, h * 0.004));

  const text = (title || 'UNTITLED').trim().toUpperCase();
  let size = bandH * 0.56;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px ${TITLE_FONT}`;
  while (ctx.measureText(text).width > w - pad * 2 && size > 10) {
    size -= 2;
    ctx.font = `900 ${size}px ${TITLE_FONT}`;
  }
  const titleY = bandY + bandH * (subtitle.trim() ? 0.36 : 0.52);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.1);
  ctx.strokeStyle = '#12081a';
  ctx.strokeText(text, pad, titleY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, pad, titleY);

  const sub = (subtitle || '').trim().toUpperCase();
  let subWidth = 0;
  if (sub) {
    const subSize = Math.max(10, bandH * 0.2);
    ctx.font = `900 ${subSize}px ${TITLE_FONT}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.max(2, subSize * 0.22)}px`;
    ctx.fillStyle = '#ff5ea8';
    ctx.fillText(sub, pad, bandY + bandH * 0.8);
    subWidth = ctx.measureText(sub).width;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  // Micro-label bottom-right, clear of the title above and of a long subtitle:
  // it is only drawn when the subtitle leaves the right side of the band free.
  if (subWidth < w * 0.62) {
    const microSize = Math.max(9, bandH * 0.13);
    ctx.font = `700 ${microSize}px ${TITLE_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillText('VICE COVER STUDIO', w - pad, bandY + bandH * 0.82);
    ctx.textAlign = 'left';
  }
}

/**
 * Draws the whole cover onto `canvas` (at the canvas's own size) from `state`:
 * { layout, grade, title, subtitle, grain, panels: [{img, zoom, ox, oy}] }.
 * `opts.highlight` is a panel index to outline in the live preview only.
 */
export function drawCover(canvas, state, opts = {}) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade] || GRADES.sunset;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#12081a';
  ctx.fillRect(0, 0, w, h);

  const rects = panelRects(state.layout, w, h);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] || {};
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (!drawPanelPhoto(ctx, rect, panel, grade)) {
      const empty = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      empty.addColorStop(0, '#3a1c52');
      empty.addColorStop(1, '#160a20');
      ctx.fillStyle = empty;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = `700 ${Math.max(11, rect.w * 0.045)}px ${TITLE_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.textAlign = 'left';
    } else {
      gradePanel(ctx, rect, grade);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(2, w * 0.002);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (opts.highlight === i) {
      ctx.save();
      ctx.strokeStyle = '#ff2e88';
      ctx.lineWidth = Math.max(3, w * 0.004);
      ctx.setLineDash([Math.max(8, w * 0.012), Math.max(6, w * 0.008)]);
      ctx.strokeRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4);
      ctx.restore();
    }
  });

  if (state.grain !== false) {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = getGrainPattern(ctx);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    const vig = ctx.createRadialGradient(
      w / 2, h * 0.42, Math.min(w, h) * 0.35,
      w / 2, h / 2, Math.max(w, h) * 0.75,
    );
    vig.addColorStop(0, 'rgba(10, 4, 18, 0)');
    vig.addColorStop(1, 'rgba(10, 4, 18, 0.38)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  drawTitleBlock(ctx, w, h, state.title, state.subtitle);
}

/** Renders the cover at an export size and returns the offscreen canvas. */
export function renderCover(state, sizeKey) {
  const size = EXPORT_SIZES[sizeKey];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state);
  return canvas;
}
