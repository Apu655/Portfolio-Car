import { usePortfolio } from '../state/store';
import { ROADSIDE_BOARDS } from '../world/roadside';
import { captionElement, shownBoard, useRoadsideCaption } from '../world/roadsideCaptions';

/**
 * A sharp caption under the nearest roadside billboard: its title, subtitle, and one-line description (R6). The
 * title is a button that opens the item in place, so touch and keyboard users can open it too.
 */
export function RoadsideCaption() {
  const key = useRoadsideCaption(shownBoard);
  const navigate = usePortfolio((s) => s.navigate);
  const panelOpen = usePortfolio((s) => s.panelOpen);
  const revealing = usePortfolio((s) => s.revealing);
  const board = key ? ROADSIDE_BOARDS.find((b) => b.key === key) : undefined;
  if (!board || panelOpen || revealing) return null;
  return (
    <div className="roadside-captions">
      <div
        ref={(el) => {
          captionElement.current = el;
        }}
        className="roadside-caption"
        style={{ visibility: 'hidden' }}
      >
        <button type="button" className="roadside-caption__open" onClick={() => navigate(board.selection, { travel: false })}>
          {board.item.title}
        </button>
        <span className="roadside-caption__subtitle">{board.item.subtitle}</span>
        <span className="roadside-caption__line">{board.item.line}</span>
      </div>
    </div>
  );
}
