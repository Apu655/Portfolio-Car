// How the district's signs are painted on 2D canvases used as textures: the roadside billboard faces (one item
// each, KTD3), the gates' header signs, and the landmarks' name signs.
import type { ShowcaseItem } from '../../content/showcase';

/** Billboard faces are painted in these logical units (16:9, like the face itself), then scaled to the texture. */
export const FACE_LOGICAL = { width: 1024, height: 576 } as const;
/** Face texture size per detail level: low tiers get a smaller texture to save memory. */
export const FACE_PX = { high: { width: 768, height: 432 }, low: { width: 512, height: 288 } } as const;
export const HEADER_PX = { width: 1024, height: 246 } as const;
/** Title size on a face, in logical units; sized so the title reads from the default view (Success Criteria). */
export const TITLE_FONT_PX = 80;
/** Longest a face title may wrap before it ends in an ellipsis. */
export const TITLE_LINES = 3;

const FONT = 'Inter, "Helvetica Neue", Arial, sans-serif';
const INK = '#f4efe4';
const MUTED = '#b8c0d8';

/** Wrap `text` to at most `maxLines` lines of `width` px, ending the last line with an ellipsis if cut. */
export function wrap(ctx: Pick<CanvasRenderingContext2D, 'measureText'>, text: string, width: number, maxLines: number): string[] {
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

const images = new Map<string, Promise<HTMLImageElement>>();
/** Load an image once; later calls share the same promise. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  let p = images.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    images.set(url, p);
  }
  return p;
}

/**
 * Paint one item on a billboard face in type big enough to read from the high camera: a screenshot band across
 * the top with the title below, or a logo card beside the title. `image` is the loaded image or null while it
 * loads (or when the item has none). `accent` is the section colour. Draws in FACE_LOGICAL units.
 */
export function paintItem(ctx: CanvasRenderingContext2D, item: ShowcaseItem, image: HTMLImageElement | null, accent: string) {
  const { width: W, height: H } = FACE_LOGICAL;
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
    ctx.font = `800 ${TITLE_FONT_PX}px ${FONT}`;
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
    ctx.font = `800 ${TITLE_FONT_PX}px ${FONT}`;
    const lines = wrap(ctx, item.title, W - textX - 40, TITLE_LINES);
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
}

/** The Contact board: a title, then one row per way to reach me (label and address). */
export function paintContact(ctx: CanvasRenderingContext2D, entries: readonly ShowcaseItem[], accent: string) {
  const { width: W, height: H } = FACE_LOGICAL;
  ctx.fillStyle = '#141b2c';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 12);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = `800 ${TITLE_FONT_PX + 8}px ${FONT}`;
  ctx.fillText('Say hello', 44, 124);
  entries.forEach((entry, i) => {
    const y = 230 + i * 104;
    ctx.fillStyle = accent;
    ctx.font = `700 48px ${FONT}`;
    ctx.fillText(entry.title, 44, y);
    ctx.fillStyle = INK;
    ctx.font = `600 48px ${FONT}`;
    ctx.fillText(wrap(ctx, entry.subtitle, W - 340, 1)[0] ?? '', 300, y);
  });
  ctx.fillStyle = MUTED;
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText('Click to open the Contact panel', 44, H - 36);
}

/** A header sign (gates, landmarks): the section letter in a disc, then the name, on a canvas of `size` px. */
export function paintHeader(ctx: CanvasRenderingContext2D, letter: string, title: string, accent: string, size: { width: number; height: number } = HEADER_PX) {
  const { width: W, height: H } = size;
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

/** The Projects Hall's front sign: a name band over a strip of the project screenshots (R10). Draws at `size` px. */
export function paintHallSign(ctx: CanvasRenderingContext2D, shots: ReadonlyArray<HTMLImageElement | null>, accent: string, size: { width: number; height: number }) {
  const { width: W, height: H } = size;
  const band = Math.round(H * 0.42);
  paintHeader(ctx, 'P', 'Projects Hall', accent, { width: W, height: band });
  ctx.fillStyle = '#0d1322';
  ctx.fillRect(0, band, W, H - band);
  const gap = 14;
  const tileW = (W - gap * (shots.length + 1)) / Math.max(1, shots.length);
  const tileH = H - band - gap * 2;
  shots.forEach((img, i) => {
    const x = gap + i * (tileW + gap);
    const y = band + gap;
    ctx.save();
    roundRect(ctx, x, y, tileW, tileH, 12);
    ctx.clip();
    ctx.fillStyle = '#1b2233';
    ctx.fillRect(x, y, tileW, tileH);
    if (img) {
      const scale = Math.max(tileW / img.naturalWidth, tileH / img.naturalHeight);
      ctx.drawImage(img, x + (tileW - img.naturalWidth * scale) / 2, y, img.naturalWidth * scale, img.naturalHeight * scale);
    }
    ctx.restore();
  });
}
