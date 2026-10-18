import { papers } from '../../content/portfolio';
import { ZOOM } from '../camera/framing';
import { ROADSIDE_FRAME, VIEW } from '../district/layout';
import { FACE_LOGICAL, TITLE_FONT_PX, TITLE_LINES, wrap } from './signPaint';

/** A stand-in for canvas text measurement: bold 80px sans averages a little over half an em per character. */
const ctx = { measureText: (text: string) => ({ width: text.length * TITLE_FONT_PX * 0.56 }) as TextMetrics };

describe('billboard face painting', () => {
  it('fits the longest paper title in at most three lines, ending in an ellipsis rather than shrinking', () => {
    const longest = papers.map((p) => p.title).sort((a, b) => b.length - a.length)[0];
    const lines = wrap(ctx, longest, FACE_LOGICAL.width - 84, TITLE_LINES);
    expect(lines.length).toBeLessThanOrEqual(TITLE_LINES);
    for (const line of lines) expect(ctx.measureText(line).width).toBeLessThanOrEqual(FACE_LOGICAL.width - 84);
    const cut = wrap(ctx, `${longest} ${longest}`, FACE_LOGICAL.width - 84, TITLE_LINES);
    expect(cut).toHaveLength(TITLE_LINES);
    expect(cut[TITLE_LINES - 1].endsWith('…')).toBe(true);
  });

  it('keeps short titles on one line, untouched', () => {
    expect(wrap(ctx, 'MetLife', FACE_LOGICAL.width - 84, TITLE_LINES)).toEqual(['MetLife']);
  });

  it('paints titles at least 14 px tall on a 1600×1000 screen at the default zoom (Success Criteria)', () => {
    // Meters of face per logical unit, foreshortened by the angle between the leaning face and the view.
    const metersPerUnit = ROADSIDE_FRAME.width / FACE_LOGICAL.width;
    const foreshorten = Math.cos(VIEW.elevation - ROADSIDE_FRAME.tilt);
    const pixelsPerMeter = 1000 / (2 * ZOOM.default * Math.tan(((VIEW.fov / 2) * Math.PI) / 180));
    expect(TITLE_FONT_PX * metersPerUnit * foreshorten * pixelsPerMeter).toBeGreaterThanOrEqual(14);
  });
});
