// Vice Cover Studio — poster painter.
//
// Paints the whole cover onto a canvas from a plain studio state object:
// which arrangement of panels, which colour wash, which export size, the
// headline + tagline, and one photo (with its own pan/zoom) per panel slot.
// Nothing here touches the DOM except the canvas it is handed, so the same
// function paints the live preview and the exported PNG.

/** Export sizes the app offers, in final PNG pixels. */
export const SIZE_SPECS = {
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
};

/** Colour washes: two wash colours plus the accent used for the title bar. */
export const WASHES = {
  sunset: { from: '#ff8a3d', to: '#e83e8c', accent: '#ffb03a', scrim: 0.5 },
  neon: { from: '#22d3ee', to: '#f021b6', accent: '#37f5d3', scrim: 0.42 },
  vice: { from: '#8b5cf6', to: '#ec4899', accent: '#f472b6', scrim: 0.5 },
  gold: { from: '#fbbf24', to: '#ea580c', accent: '#fde68a', scrim: 0.48 },
};

/** Arrangements the picker offers. */
export const ARRANGEMENTS = ['hero', 'strip', 'grid', 'single'];

/**
 * Panel rectangles for an arrangement inside a canvas of w x h.
 * Returns one rect per visible panel, in slot order.
 */
export function slotBoxes(w, h, arrangement) {
  const gap = Math.max(8, Math.round(Math.min(w, h) * 0.012));
  const m = gap;
  if (arrangement === 'single') {
    return [{ x: m, y: m, w: w - 2 * m, h: h - 2 * m }];
  }
  if (arrangement === 'grid') {
    const cw = (w - 3 * m) / 2;
    const ch = (h - 3 * m) / 2;
    return [
      { x: m, y: m, w: cw, h: ch },
      { x: 2 * m + cw, y: m, w: cw, h: ch },
      { x: m, y: 2 * m + ch, w: cw, h: ch },
      { x: 2 * m + cw, y: 2 * m + ch, w: cw, h: ch },
    ];
  }
  if (arrangement === 'strip') {
    const cw = (w - 4 * m) / 3;
    return [0, 1, 2].map((i) => ({
      x: m + i * (cw + m),
      y: m,
      w: cw,
      h: h - 2 * m,
    }));
  }
  // hero: one tall panel on the left, two stacked panels on the right.
  const bigW = (w - 3 * m) * 0.62;
  const sideX = m + bigW + m;
  const sideW = w - sideX - m;
  const halfH = (h - 3 * m) / 2;
  return [
    { x: m, y: m, w: bigW, h: h - 2 * m },
    { x: sideX, y: m, w: sideW, h: halfH },
    { x: sideX, y: 2 * m + halfH, w: sideW, h: halfH },
  ];
}

/** How many slots an arrangement actually shows. */
export function slotCount(arrangement) {
  return slotBoxes(100, 100, arrangement).length;
}

/**
 * Where an image lands inside a panel: cover-fit, scaled by the slot's zoom
 * and shifted by its pan offsets, with the pan clamped so the photo can
 * never be dragged far enough to show the panel's background at an edge.
 */
function coverPlacement(img, box, zoom, dx, dy) {
  const base = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight);
  const scale = base * Math.max(1, zoom);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const maxX = Math.max(0, (dw - box.w) / 2);
  const maxY = Math.max(0, (dh - box.h) / 2);
  const ox = Math.max(-maxX, Math.min(maxX, dx));
  const oy = Math.max(-maxY, Math.min(maxY, dy));
  return { x: box.x + (box.w - dw) / 2 + ox, y: box.y + (box.h - dh) / 2 + oy, w: dw, h: dh };
}

/** Shrinks a font size until `text` fits `maxWidth`, then returns it. */
function shrinkToFit(ctx, text, startPx, maxWidth, family, weight) {
  let px = startPx;
  ctx.font = `${weight} ${px}px ${family}`;
  while (px > 14 && ctx.measureText(text).width > maxWidth) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${family}`;
  }
  return px;
}

function paintEmptySlot(ctx, box, index) {
  ctx.fillStyle = '#251636';
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = 'rgba(185, 167, 214, 0.55)';
  ctx.lineWidth = Math.max(1.5, box.w * 0.004);
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(box.x + 8, box.y + 8, box.w - 16, box.h - 16);
  ctx.setLineDash([]);
  ctx.fillStyle = '#cbb8e8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const plus = Math.min(box.w, box.h) * 0.22;
  ctx.font = `300 ${plus}px system-ui, sans-serif`;
  ctx.fillText('+', box.x + box.w / 2, box.y + box.h / 2 - plus * 0.28);
  const labelPx = Math.max(13, Math.min(30, box.w * 0.055));
  ctx.font = `700 ${labelPx}px system-ui, sans-serif`;
  ctx.fillText(`PANEL ${index + 1}`, box.x + box.w / 2, box.y + box.h / 2 + plus * 0.42);
  ctx.fillStyle = '#8f7fb3';
  ctx.font = `600 ${Math.max(11, labelPx * 0.62)}px system-ui, sans-serif`;
  ctx.fillText('ADD A PHOTO', box.x + box.w / 2, box.y + box.h / 2 + plus * 0.42 + labelPx * 1.15);
}

function paintPhotoSlot(ctx, img, box, slot, wash) {
  const place = coverPlacement(img, box, slot.zoom || 1, slot.dx || 0, slot.dy || 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.drawImage(img, place.x, place.y, place.w, place.h);
  // Diagonal colour wash over the photo, plus a darker foot inside the
  // panel so the headline stays readable even over a bright photo.
  const tint = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  tint.addColorStop(0, wash.from + '3d');
  tint.addColorStop(1, wash.to + '59');
  ctx.fillStyle = tint;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const foot = ctx.createLinearGradient(0, box.y + box.h * 0.72, 0, box.y + box.h);
  foot.addColorStop(0, 'rgba(10, 4, 20, 0)');
  foot.addColorStop(1, 'rgba(10, 4, 20, 0.28)');
  ctx.fillStyle = foot;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = Math.max(2, box.w * 0.004);
  ctx.strokeRect(box.x, box.y, box.w, box.h);
}

function paintWords(ctx, w, h, wash, headline, tagline) {
  const margin = Math.max(14, Math.round(Math.min(w, h) * 0.02));
  const words = (headline || '').trim().toUpperCase();
  const sub = (tagline || '').trim().toUpperCase();
  if (!words && !sub) return;

  // Dark scrim along the foot so the lettering stays readable over photos.
  const scrimH = h * 0.26;
  const scrim = ctx.createLinearGradient(0, h - scrimH, 0, h);
  scrim.addColorStop(0, 'rgba(10, 4, 20, 0)');
  scrim.addColorStop(1, `rgba(10, 4, 20, ${wash.scrim + 0.18})`);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h - scrimH, w, scrimH);

  const family = '"ViceCondensed", "Noto Sans Display Condensed Black", "Arial Narrow", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const subPx = Math.max(16, Math.round(h * 0.032));
  const gapPx = Math.round(h * 0.018);
  const headBaseline = h - margin - (sub ? subPx + gapPx : 0);
  if (words) {
    const headPx = shrinkToFit(ctx, words, Math.round(h * 0.13), w - 2 * margin, family, 900);
    // Short accent bar above the headline.
    ctx.fillStyle = wash.accent;
    ctx.fillRect(margin, headBaseline - headPx - Math.round(headPx * 0.28), Math.round(w * 0.075), Math.max(4, Math.round(headPx * 0.07)));
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = headPx * 0.16;
    ctx.shadowOffsetY = headPx * 0.03;
    ctx.fillText(words, margin, headBaseline);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  if (sub) {
    try { ctx.letterSpacing = `${Math.max(2, Math.round(subPx * 0.18))}px`; } catch { /* older canvas: no tracking */ }
    ctx.font = `600 ${subPx}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffe9f4';
    ctx.fillText(sub, margin, h - margin);
    try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  }
}

/**
 * Paints the full poster: background, every visible panel (photo or empty
 * placeholder), then the headline and tagline along the foot.
 * `studio` is { arrangement, wash, headline, tagline, slots } where each
 * slot is { photo, zoom, dx, dy }.
 */
export function paintPoster(canvas, studio) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const wash = WASHES[studio.wash] || WASHES.sunset;
  ctx.fillStyle = '#12081f';
  ctx.fillRect(0, 0, w, h);
  const boxes = slotBoxes(w, h, studio.arrangement);
  boxes.forEach((box, i) => {
    const slot = studio.slots[i] || {};
    if (slot.photo) paintPhotoSlot(ctx, slot.photo, box, slot, wash);
    else paintEmptySlot(ctx, box, i);
  });
  paintWords(ctx, w, h, wash, studio.headline, studio.tagline);
}
