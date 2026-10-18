// What the section gates' screens show and how they are painted. Each gate has two screens; together they page
// through the section's items two at a time. Painting happens on a 2D canvas used as the screen's texture.
import type { ShowcaseItem } from '../../content/showcase';

/** Seconds each page of two items stays up. */
export const PAGE_SECONDS = 7;
/** Seconds the crossfade between pages takes (skipped with reduced motion). */
export const FADE_SECONDS = 0.45;

export function pageCount(items: number): number {
  return Math.max(1, Math.ceil(items / 2));
}

/** Index of the item `screen` (0 left, 1 right) shows on `page`, or -1 for the "see all" card. */
export function screenItem(items: number, page: number, screen: 0 | 1): number {
  const i = (page % pageCount(items)) * 2 + screen;
  return i < items ? i : -1;
}

export const SCREEN_PX = { width: 1024, height: 572 } as const;
export const HEADER_PX = { width: 1024, height: 246 } as const;

const FONT = 'Inter, "Helvetica Neue", Arial, sans-serif';
const INK = '#f4efe4';
const MUTED = '#b8c0d8';

/** Wrap `text` to at most `maxLines` lines of `width` px, ending the last line with an ellipsis if cut. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (let w = 0; w < words.length; w++) {
    const next = line ? `${line} ${words[w]}` : words[w];
    if (ctx.measureText(next).width <= width) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = words[w];
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && lines.join(' ').length < text.length) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A screenshot is wide; a logo is small and squarish. */
const isLogo = (img: HTMLImageElement) => img.naturalWidth <= 400 && img.naturalWidth / img.naturalHeight < 1.6;

/**
 * Paint one item in type big enough to read from the high camera: a screenshot band across the top with the
 * title below, or a logo card beside the title. `image` is the loaded image or null while it loads (or when the
 * item has none). `accent` is the section colour.
 */
export function paintItem(ctx: CanvasRenderingContext2D, item: ShowcaseItem, image: HTMLImageElement | null, accent: string, position: string) {
  const { width: W, height: H } = SCREEN_PX;
  ctx.fillStyle = '#141b2c';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 12);
  ctx.textBaseline = 'alphabetic';

  const logo = image !== null && isLogo(image);
  let y: number;
  if (image && !logo) {
    // Screenshot: cover a band across the top, anchored to the top of the page.
    const bandH = 250;
    const scale = Math.max(W / image.naturalWidth, bandH / image.naturalHeight);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 12, W, bandH);
    ctx.clip();
    ctx.drawImage(image, (W - image.naturalWidth * scale) / 2, 12, image.naturalWidth * scale, image.naturalHeight * scale);
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.font = `800 84px ${FONT}`;
    ctx.fillText(wrap(ctx, item.title, W - 80, 1)[0] ?? '', 40, bandH + 100);
    y = bandH + 160;
  } else {
    // Logo card (or none) on the left, a big title beside it.
    let textX = 44;
    if (logo) {
      roundRect(ctx, 40, 44, 250, 250, 30);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      const s = Math.min(210 / image.naturalWidth, 210 / image.naturalHeight);
      ctx.drawImage(image, 40 + (250 - image.naturalWidth * s) / 2, 44 + (250 - image.naturalHeight * s) / 2, image.naturalWidth * s, image.naturalHeight * s);
      textX = 320;
    }
    ctx.fillStyle = INK;
    ctx.font = `800 80px ${FONT}`;
    const lines = wrap(ctx, item.title, W - textX - 40, 3);
    lines.forEach((l, i) => ctx.fillText(l, textX, 120 + i * 88));
    y = Math.max(330, 120 + lines.length * 88 + 30);
  }
  ctx.fillStyle = accent;
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(wrap(ctx, item.subtitle, W - 80, 1)[0] ?? '', 40, y);
  y += 62;
  ctx.fillStyle = MUTED;
  ctx.font = `500 44px ${FONT}`;
  const room = Math.max(1, Math.min(2, Math.floor((H - 20 - y) / 52) + 1));
  wrap(ctx, item.line, W - 80, room).forEach((l, i) => ctx.fillText(l, 40, y + i * 52));

  ctx.fillStyle = MUTED;
  ctx.font = `600 30px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(position, W - 30, 50);
  ctx.textAlign = 'left';
}

/** The card on a spare screen: how many items the section holds and how to open them. */
export function paintSeeAll(ctx: CanvasRenderingContext2D, count: number, noun: string, accent: string) {
  const { width: W, height: H } = SCREEN_PX;
  ctx.fillStyle = '#141b2c';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.font = `700 64px ${FONT}`;
  ctx.fillText(`${count} ${noun}`, W / 2, H / 2 - 10);
  ctx.fillStyle = MUTED;
  ctx.font = `400 32px ${FONT}`;
  ctx.fillText('Click a screen, or park in the zone and press E', W / 2, H / 2 + 50);
  ctx.textAlign = 'left';
}

/** The header sign: the section letter in a disc, then the section name. */
export function paintHeader(ctx: CanvasRenderingContext2D, letter: string, title: string, accent: string) {
  const { width: W, height: H } = HEADER_PX;
  ctx.fillStyle = '#141b2c';
  ctx.fillRect(0, 0, W, H);
  ctx.beginPath();
  ctx.arc(130, H / 2, 88, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.fillStyle = '#141b2c';
  ctx.font = `800 120px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 130, H / 2 + 6);
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `700 92px ${FONT}`;
  ctx.fillText(title.toUpperCase(), 258, H / 2 + 6);
  ctx.textBaseline = 'alphabetic';
}
