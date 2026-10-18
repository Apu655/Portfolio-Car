import { boardFor, ROADSIDE_BOARDS } from './roadside';
import { CAPTION_RANGE, nearestBoard, shownBoard, useRoadsideCaption } from './roadsideCaptions';

const board = (key: string) => ROADSIDE_BOARDS.find((b) => b.key === key)!;

describe('roadside boards', () => {
  it('give every board its own item, and every item one board', () => {
    const opens = ROADSIDE_BOARDS.map((b) => JSON.stringify(b.selection));
    expect(new Set(opens).size).toBe(opens.length);
    expect(ROADSIDE_BOARDS.filter((b) => b.section === 'research').map((b) => b.selection.itemId)).not.toContain('secarely');
  });

  it('put every contact entry on the one Contact board, which opens the Contact panel', () => {
    const contact = ROADSIDE_BOARDS.filter((b) => b.section === 'contact');
    expect(contact).toHaveLength(1);
    expect(contact[0].entries?.map((e) => e.title)).toEqual(['Email', 'GitHub', 'Résumé']);
    expect(contact[0].selection).toEqual({ section: 'contact' });
  });

  it('finds the board that shows an item, and none for an item without one', () => {
    expect(boardFor({ section: 'experience', itemId: 'metlife' })?.key).toBe('roadside-experience-0');
    expect(boardFor({ section: 'research', itemId: 'secarely' })).toBeUndefined();
    expect(boardFor({ section: 'projects' })).toBeUndefined();
  });
});

describe('roadside captions', () => {
  beforeEach(() => useRoadsideCaption.setState({ board: null, bubble: false }));

  it('picks the nearest board within range, and nothing beyond it', () => {
    const b = board('roadside-research-2');
    // On the road beside the board.
    expect(nearestBoard(ROADSIDE_BOARDS, b.position[0] - 9, b.position[1])).toBe(b.key);
    expect(nearestBoard(ROADSIDE_BOARDS, b.position[0] - CAPTION_RANGE - 1, b.position[1] - 60)).toBeNull();
  });

  it('switches to the next board once it is nearer (AE2)', () => {
    const [a, b] = [board('roadside-research-2'), board('roadside-research-3')];
    const x = a.position[0] - 9;
    expect(nearestBoard(ROADSIDE_BOARDS, x, a.position[1] - 3)).toBe(a.key);
    expect(nearestBoard(ROADSIDE_BOARDS, x, b.position[1] + 3)).toBe(b.key);
  });

  it('hides the card while the robot bubble shows, and brings it back after', () => {
    const state = useRoadsideCaption.getState();
    state.setNearest('roadside-research-0');
    expect(shownBoard(useRoadsideCaption.getState())).toBe('roadside-research-0');
    state.setBubble(true);
    expect(shownBoard(useRoadsideCaption.getState())).toBeNull();
    state.setBubble(false);
    expect(shownBoard(useRoadsideCaption.getState())).toBe('roadside-research-0');
  });
});
