// Vice Cover Studio — cover renderer.
//
// Everything the app shows and exports is painted here with plain canvas 2D:
// multi-panel layouts, colour grades, film grain, a vignette, and the bold
// condensed title band at the foot. The live preview and the exported PNGs
// share this one code path, so what you see is exactly what you save.
//
// A cover state looks like:
//   { layout, grade, title, subtitle, grain, panels: [{ img, zoom, ox, oy }] }
// Panel offsets (ox, oy) are fractions of the panel's own width/height.

export const TITLE_FONT = "'Vice Condensed', 'Arial Narrow', 'Liberation Sans Narrow', sans-serif";

// How much of the cover height the title band takes.
const TITLE_SHARE = 0.15;
// Gutter between panels, as a share of the cover width.
const GUTTER_SHARE = 0.006;

// Panel boxes as fractions of the photo area (everything above the title
// band). Each entry is { x, y, w, h } in 0..1.
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

// A grade is a canvas filter for the photo plus a two-colour wash painted
// over it with a blend mode, and a faint multiply tint on top. Together they
// give any photo the same sunset / neon / vice / golden treatment.
export const GRADES = {
  sunset: {
    filter: 'saturate(1.35) contrast(1.08)',
    washFrom: '#ffb347',
    washTo: '#ff2e88',
    washBlend: 'soft-light',
    washStrength: 0.6,
    tint: 'rgba(255, 110, 60, 0.14)',
  },
  neon: {
    filter: 'saturate(1.55) contrast(1.12)',
    washFrom: '#00e5ff',
    washTo: '#ff2ea6',
    washBlend: 'overlay',
    washStrength: 0.55,
    tint: 'rgba(0, 229, 255, 0.10)',
  },
  vice: {
    filter: 'saturate(1.45) contrast(1.06)',
    washFrom: '#7b2fff',
    washTo: '#ff5ea8',
    washBlend: 'soft-light',
    washStrength: 0.65,
    tint: 'rgba(123, 47, 255, 0.14)',
  },
  gold: {
    filter: 'saturate(1.3) contrast(1.05)',
    washFrom: '#ffe08a',
    washTo: '#ff7b00',
    washBlend: 'soft-light',
    washStrength: 0.55,
    tint: 'rgba(255, 179, 71, 0.14)',
  },
};

export const EXPORT_SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
};
export const EXPORT_ORDER = ['square', 'portrait', 'wide'];

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

let grainTile = null;

// Lazily builds a small tile of grey noise and returns it as a repeat
// pattern for the context that asked. One tile serves every later paint.
function grainPattern(ctx) {
  if (grainTile) return grainTile;
  const size = 128;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext('2d');
  const pixels = tctx.createImageData(size, size);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const shade = 96 + Math.floor(Math.random() * 64);
    pixels.data[i] = shade;
    pixels.data[i + 1] = shade;
    pixels.data[i + 2] = shade;
    pixels.data[i + 3] = 255;
  }
  tctx.putImageData(pixels, 0, 0);
  grainTile = ctx.createPattern(tile, 'repeat');
  return grainTile;
}

// Panel boxes in canvas pixels for `layout` on a cover of w x h.
export function panelRects(layout, w, h) {
  const photoH = h * (1 - TITLE_SHARE);
  const gutter = Math.max(4, Math.round(w * GUTTER_SHARE));
  const boxes = LAYOUTS[layout] || LAYOUTS.hero;
  return boxes.map((box) => ({
    x: box.x * w + gutter / 2,
    y: box.y * photoH + gutter / 2,
    w: box.w * w - gutter,
    h: box.h * photoH - gutter,
  }));
}

// The scale that makes an image cover a box, times the user's zoom, plus the
// draw position for the current pan. Pan is clamped so the photo can never
// slide far enough to expose bare background at a panel edge.
function coverPlacement(img, box, zoom, ox, oy) {
  const scale = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight) * zoom;
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  const slackX = Math.max(0, (drawW - box.w) / 2 / box.w);
  const slackY = Math.max(0, (drawH - box.h) / 2 / box.h);
  const panX = clamp(ox || 0, -slackX, slackX);
  const panY = clamp(oy || 0, -slackY, slackY);
  return {
    x: box.x + (box.w - drawW) / 2 + panX * box.w,
    y: box.y + (box.h - drawH) / 2 + panY * box.h,
    w: drawW,
    h: drawH,
  };
}

// Paints one photo into a clipped panel box. Returns false when the panel
// has no photo yet, so the caller can draw the empty placeholder instead.
function paintPhoto(ctx, box, panel, grade) {
  const img = panel.img;
  if (!img) return false;
  const place = coverPlacement(img, box, panel.zoom || 1, panel.ox, panel.oy);
  ctx.save();
  ctx.filter = grade.filter;
  ctx.drawImage(img, place.x, place.y, place.w, place.h);
  ctx.restore();
  return true;
}

// Paints the grade's diagonal wash and its multiply tint over a panel box.
// The caller must already have clipped to the box.
function paintGrade(ctx, box, grade) {
  const wash = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  wash.addColorStop(0, grade.washFrom);
  wash.addColorStop(1, grade.washTo);
  ctx.save();
  ctx.globalCompositeOperation = grade.washBlend;
  ctx.globalAlpha = grade.washStrength;
  ctx.fillStyle = wash;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = grade.tint;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}

// Placeholder for a panel with no photo: a deep gradient, a big plus, the
// panel number and a short prompt.
function paintEmptyPanel(ctx, box, index) {
  const bg = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  bg.addColorStop(0, '#3a1c52');
  bg.addColorStop(1, '#160a20');
  ctx.fillStyle = bg;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const labelSize = Math.max(11, box.w * 0.045);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = `700 ${Math.max(18, box.w * 0.09)}px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', cx, cy - labelSize * 0.9);
  ctx.font = `700 ${labelSize}px ${TITLE_FONT}`;
  ctx.fillText('ADD A PHOTO', cx, cy + labelSize * 0.7);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = `700 ${Math.max(9, box.w * 0.03)}px ${TITLE_FONT}`;
  ctx.fillText(`PANEL ${index + 1}`, cx, cy + labelSize * 1.9);
  ctx.textAlign = 'left';
}

// Shrinks `text` until it fits `maxWidth`, starting from `startSize`.
// Returns the size that fits (never below `minSize`).
function fitText(ctx, text, startSize, minSize, maxWidth) {
  let size = startSize;
  ctx.font = `900 ${size}px ${TITLE_FONT}`;
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `900 ${size}px ${TITLE_FONT}`;
  }
  return size;
}

// The title band: dark gradient, a sunset gradient rule on top, the big
// condensed title with a soft shadow, the pink tracked subtitle, and a small
// studio mark at bottom-right when the subtitle leaves room for it.
function paintTitleBand(ctx, w, h, title, subtitle) {
  const bandY = h * (1 - TITLE_SHARE);
  const bandH = h * TITLE_SHARE;
  const pad = w * 0.035;

  const bg = ctx.createLinearGradient(0, bandY, 0, h);
  bg.addColorStop(0, '#1c0b28');
  bg.addColorStop(1, '#0d0514');
  ctx.fillStyle = bg;
  ctx.fillRect(0, bandY, w, bandH);

  const rule = ctx.createLinearGradient(0, 0, w, 0);
  rule.addColorStop(0, '#ffb347');
  rule.addColorStop(0.5, '#ff2e88');
  rule.addColorStop(1, '#7b2fff');
  ctx.fillStyle = rule;
  ctx.fillRect(0, bandY, w, Math.max(3, h * 0.004));

  const words = (title || 'UNTITLED').trim().toUpperCase();
  const hasSub = Boolean((subtitle || '').trim());
  const titleSize = fitText(ctx, words, bandH * 0.56, 10, w - pad * 2);
  const titleY = bandY + bandH * (hasSub ? 0.36 : 0.52);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${titleSize}px ${TITLE_FONT}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, titleSize * 0.1);
  ctx.strokeStyle = '#12081a';
  ctx.shadowColor = 'rgba(255, 46, 136, 0.45)';
  ctx.shadowBlur = Math.max(6, titleSize * 0.25);
  ctx.shadowOffsetY = Math.max(2, titleSize * 0.05);
  ctx.strokeText(words, pad, titleY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(words, pad, titleY);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  let subWidth = 0;
  const sub = (subtitle || '').trim().toUpperCase();
  if (sub) {
    const subSize = fitText(ctx, sub, bandH * 0.2, 9, w - pad * 2);
    ctx.font = `900 ${subSize}px ${TITLE_FONT}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.max(2, subSize * 0.22)}px`;
    ctx.fillStyle = '#ff5ea8';
    ctx.fillText(sub, pad, bandY + bandH * 0.8);
    subWidth = ctx.measureText(sub).width;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  if (subWidth < w * 0.62) {
    const markSize = Math.max(9, bandH * 0.13);
    ctx.font = `700 ${markSize}px ${TITLE_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillText('VICE COVER STUDIO', w - pad, bandY + bandH * 0.82);
    ctx.textAlign = 'left';
  }
}

// Grain (overlay blend, faint) plus a dark vignette around the edges.
function paintFinish(ctx, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grainPattern(ctx);
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

// Draws the whole cover onto `canvas` (at the canvas's own pixel size) from
// `state`. `opts.highlight` outlines one panel — used by the live preview
// to mark the selected panel; exports never pass it.
export function drawCover(canvas, state, opts = {}) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade] || GRADES.sunset;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#12081a';
  ctx.fillRect(0, 0, w, h);

  const boxes = panelRects(state.layout, w, h);
  boxes.forEach((box, i) => {
    const panel = state.panels[i] || {};
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    if (paintPhoto(ctx, box, panel, grade)) {
      paintGrade(ctx, box, grade);
    } else {
      paintEmptyPanel(ctx, box, i);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(2, w * 0.002);
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    if (opts.highlight === i) {
      ctx.save();
      ctx.strokeStyle = '#ff2e88';
      ctx.lineWidth = Math.max(3, w * 0.004);
      ctx.setLineDash([Math.max(8, w * 0.012), Math.max(6, w * 0.008)]);
      ctx.strokeRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
      ctx.restore();
    }
  });

  if (state.grain !== false) paintFinish(ctx, w, h);
  paintTitleBand(ctx, w, h, state.title, state.subtitle);
}

// Renders the cover at one export size and returns the offscreen canvas.
export function renderCover(state, sizeKey) {
  const size = EXPORT_SIZES[sizeKey] || EXPORT_SIZES.square;
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state);
  return canvas;
}
