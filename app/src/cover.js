// Vice Cover Studio — poster painter.
//
// Paints the whole cover onto a canvas from a plain studio state object:
// which arrangement of panels, which colour wash, which export size, the
// headline + tagline, the caption style, and one photo (with its own
// pan/zoom) per panel slot. Nothing here touches the DOM except the canvas
// it is handed, so the same function paints the live preview and the
// exported PNG, and the screenshot scenes reuse it unchanged.

/** Export sizes the app offers, in final PNG pixels. */
export const SIZE_SPECS = {
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  story: { w: 1080, h: 1920, label: '1080 x 1920' },
};

/** Colour washes: two wash colours plus the accent used for the title bar. */
export const WASHES = {
  sunset: { from: '#ff8a3d', to: '#e83e8c', accent: '#ffb03a', scrim: 0.5 },
  neon: { from: '#22d3ee', to: '#f021b6', accent: '#37f5d3', scrim: 0.42 },
  vice: { from: '#8b5cf6', to: '#ec4899', accent: '#f472b6', scrim: 0.5 },
  gold: { from: '#fbbf24', to: '#ea580c', accent: '#fde68a', scrim: 0.48 },
  duotone: { from: '#0ea5e9', to: '#e11d48', accent: '#7dd3fc', scrim: 0.55 },
  midnight: { from: '#1e3a8a', to: '#0f172a', accent: '#93c5fd', scrim: 0.62 },
  neonNights: { from: '#ff2e88', to: '#00e5ff', accent: '#ff5fa2', scrim: 0.5 },
  sunsetGold: { from: '#f59e0b', to: '#b45309', accent: '#fcd34d', scrim: 0.46 },
};

/** Arrangements the picker offers. */
export const ARRANGEMENTS = ['hero', 'strip', 'grid', 'single', 'duo', 'triptych'];

/** Caption render styles: soft drop shadow, a bold hollow outline, or chrome. */
export const CAPTION_STYLES = ['shadow', 'outline', 'chrome'];

/** Emblem badge corners and sizes the picker offers. */
export const EMBLEM_CORNERS = ['tl', 'tr', 'bl', 'br'];
export const EMBLEM_SIZES = ['small', 'medium', 'large'];

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
  if (arrangement === 'duo') {
    // Two tall panels side by side, split down the middle.
    const cw = (w - 3 * m) / 2;
    return [
      { x: m, y: m, w: cw, h: h - 2 * m },
      { x: 2 * m + cw, y: m, w: cw, h: h - 2 * m },
    ];
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
  if (arrangement === 'triptych') {
    // Triptych: one tall panel on the left, two stacked panels on the
    // right, split by a double-wide gutter so the three panels read as a
    // hinged three-part cover. The left panel is narrower than hero's
    // (44% of the width instead of 62%), so the right column carries
    // almost as much of the poster as the left.
    const leftW = (w - 4 * m) * 0.44;
    const rightX = m + leftW + 2 * m;
    const rightW = w - rightX - m;
    const halfH = (h - 3 * m) / 2;
    return [
      { x: m, y: m, w: leftW, h: h - 2 * m },
      { x: rightX, y: m, w: rightW, h: halfH },
      { x: rightX, y: 2 * m + halfH, w: rightW, h: halfH },
    ];
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

/**
 * Diagonal colour wash over a photo, plus a darker foot inside the panel
 * so the headline stays readable even over a bright photo.
 */
function paintWashTint(ctx, box, wash) {
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
}

/** Thin bright frame around a filled panel. */
function paintPanelFrame(ctx, box) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = Math.max(2, box.w * 0.004);
  ctx.strokeRect(box.x, box.y, box.w, box.h);
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
  paintWashTint(ctx, box, wash);
  ctx.restore();
  paintPanelFrame(ctx, box);
}

/**
 * Draws the headline once, in the chosen caption style. `shadow` fills
 * white letters with a soft drop shadow; `outline` strokes hollow letters
 * in the wash accent so the photo shows through the glyphs.
 */
function paintHeadline(ctx, words, x, baseline, px, family, wash, style) {
  ctx.font = `900 ${px}px ${family}`;
  if (style === 'outline') {
    // A wide dark under-stroke first so the hollow letters stay readable
    // over bright photos, then the accent stroke, then a near-white fill
    // at low opacity so the photo still shows through the glyphs.
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(10, 4, 20, 0.85)';
    ctx.lineWidth = Math.max(3, px * 0.09);
    ctx.strokeText(words, x, baseline);
    ctx.strokeStyle = wash.accent;
    ctx.lineWidth = Math.max(2, px * 0.045);
    ctx.strokeText(words, x, baseline);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.fillText(words, x, baseline);
  } else if (style === 'chrome') {
    // Metallic letters: the text is stamped downward in darkening shades
    // so it looks extruded, then filled with a vertical silver-to-gold
    // gradient and a dark rim so it holds up over bright photos.
    const steps = Math.max(2, Math.round(px * 0.05));
    ctx.lineJoin = 'round';
    for (let i = steps; i >= 1; i -= 1) {
      const shade = 0.62 - (i / steps) * 0.3;
      ctx.fillStyle = `rgba(18, 6, 28, ${shade.toFixed(3)})`;
      ctx.fillText(words, x, baseline + i);
    }
    const chrome = ctx.createLinearGradient(0, baseline - px, 0, baseline + px * 0.14);
    chrome.addColorStop(0, '#ffffff');
    chrome.addColorStop(0.34, '#c9ced8');
    chrome.addColorStop(0.5, '#787e8c');
    chrome.addColorStop(0.63, '#f6e27a');
    chrome.addColorStop(0.78, '#ffffff');
    chrome.addColorStop(1, '#98a0ae');
    ctx.strokeStyle = 'rgba(10, 4, 20, 0.92)';
    ctx.lineWidth = Math.max(2, px * 0.032);
    ctx.strokeText(words, x, baseline);
    ctx.fillStyle = chrome;
    ctx.fillText(words, x, baseline);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = px * 0.16;
    ctx.shadowOffsetY = px * 0.03;
    ctx.fillText(words, x, baseline);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
}

function paintWords(ctx, w, h, wash, headline, tagline, captionStyle) {
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
  const style = captionStyle === 'outline' ? 'outline' : 'shadow';
  if (words) {
    const headPx = shrinkToFit(ctx, words, Math.round(h * 0.13), w - 2 * margin, family, 900);
    // Short accent bar above the headline.
    ctx.fillStyle = wash.accent;
    ctx.fillRect(margin, headBaseline - headPx - Math.round(headPx * 0.28), Math.round(w * 0.075), Math.max(4, Math.round(headPx * 0.07)));
    paintHeadline(ctx, words, margin, headBaseline, headPx, family, wash, style);
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
 * A small deterministic PRNG (mulberry32) so the film grain looks the
 * same on every paint of the same poster — the live preview, the export,
 * and a re-run all get identical speckles.
 */
function grainRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draws the round "VICE" seal in one corner: a bright outer ring, a dark
 * disc, the word VICE in condensed type, and a small star above it.
 * `emblem` is { enabled, corner, size }; size is a fraction of the
 * poster's short side. Nothing is drawn when the badge is off.
 */
function paintEmblem(ctx, w, h, wash, emblem) {
  if (!emblem || !emblem.enabled) return;
  const short = Math.min(w, h);
  const fraction = emblem.size === 'large' ? 0.19 : emblem.size === 'small' ? 0.11 : 0.15;
  const radius = (short * fraction) / 2;
  const margin = Math.max(16, short * 0.035) + radius;
  const corner = emblem.corner || 'tr';
  const cx = corner.endsWith('r') ? w - margin : margin;
  // Bottom corners sit above the headline band (the foot scrim is 26% of
  // the height), so the seal never covers the headline the way a badge
  // parked in the very corner would.
  const headBand = h * 0.26;
  const cy = corner.startsWith('b') ? h - margin - headBand : margin;

  ctx.save();
  // Outer ring in the wash accent, then the dark seal disc.
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = wash.accent;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.86, 0, Math.PI * 2);
  ctx.fillStyle = '#160a26';
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, radius * 0.045);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.stroke();
  // A five-point star above the word, drawn from a rotating polygon.
  const starR = radius * 0.2;
  const starY = cy - radius * 0.42;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? starR : starR * 0.45;
    const px = cx + Math.cos(angle) * r;
    const py = starY + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = wash.accent;
  ctx.fill();
  // The word itself, shrunk until it fits inside the disc.
  const family = '"ViceCondensed", "Noto Sans Display Condensed Black", "Arial Narrow", sans-serif';
  let px = radius * 0.52;
  ctx.font = `900 ${px}px ${family}`;
  while (px > 8 && ctx.measureText('VICE').width > radius * 1.5) {
    px -= 1;
    ctx.font = `900 ${px}px ${family}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('VICE', cx, cy + radius * 0.16);
  ctx.restore();
}

/**
 * Darkens the poster's edges with a radial falloff so the centre pops.
 * `strength` runs 0 (off) to 1 (heavy); the falloff starts at 55% of the
 * poster's half-diagonal so the middle of the photo stays untouched.
 */
function paintVignette(ctx, w, h, strength) {
  const amount = Math.max(0, Math.min(1, strength || 0));
  if (amount <= 0) return;
  const cx = w / 2;
  const cy = h / 2;
  const inner = Math.hypot(w, h) * 0.28;
  const outer = Math.hypot(w, h) * 0.62;
  const falloff = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  falloff.addColorStop(0, 'rgba(5, 2, 12, 0)');
  falloff.addColorStop(1, `rgba(5, 2, 12, ${(amount * 0.85).toFixed(3)})`);
  ctx.fillStyle = falloff;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Scatters light and dark single-pixel speckles over the poster for a
 * film-grain finish. `amount` runs 0 (off) to 1 (heavy); the speckles
 * come from the seeded PRNG above, so the grain is identical on every
 * paint of the same poster.
 */
function paintGrain(ctx, w, h, amount) {
  const level = Math.max(0, Math.min(1, amount || 0));
  if (level <= 0) return;
  const total = Math.min(60000, Math.round((level * w * h) / 28));
  const rand = grainRandom(0x51ce51);
  ctx.save();
  for (let i = 0; i < total; i += 1) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h);
    const light = rand() > 0.5;
    const alpha = 0.05 + rand() * 0.16 * level + 0.04;
    ctx.fillStyle = light ? `rgba(255, 255, 255, ${alpha.toFixed(3)})` : `rgba(0, 0, 0, ${alpha.toFixed(3)})`;
    ctx.fillRect(x, y, 1 + (rand() > 0.85 ? 1 : 0), 1);
  }
  ctx.restore();
}

/**
 * Paints the full poster: background, every visible panel (photo or empty
 * placeholder), then the headline and tagline along the foot.
 * `studio` is { arrangement, wash, headline, tagline, captionStyle, slots }
 * where each slot is { photo, zoom, dx, dy }.
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
  paintWords(ctx, w, h, wash, studio.headline, studio.tagline, studio.captionStyle);
  // Finish last, over everything: the corner VICE seal, then the edge
  // darkening, then the film grain, so the finish reads as one coat.
  paintEmblem(ctx, w, h, wash, studio.emblem);
  paintVignette(ctx, w, h, studio.vignette);
  paintGrain(ctx, w, h, studio.grain);
}
