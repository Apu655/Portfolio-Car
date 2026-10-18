import { SHOWCASE } from '../content/showcase';
import { usePortfolio } from '../state/store';
import { captionElement, useGateCaptions } from '../world/gateCaptions';

/**
 * A sharp caption under the nearest gate: the item each of its two screens shows, with its one-line
 * description. Clicking a row opens that item. The menu and panels carry the same content for keyboard and
 * screen-reader users, so these cards are pointer-only.
 */
export function GateCaptions() {
  const section = useGateCaptions((s) => s.section);
  const items = useGateCaptions((s) => s.items);
  const navigate = usePortfolio((s) => s.navigate);
  const panelOpen = usePortfolio((s) => s.panelOpen);
  const revealing = usePortfolio((s) => s.revealing);
  if (!section || panelOpen || revealing) return null;
  return (
    <div className="gate-captions" aria-hidden="true">
      <div
        ref={(el) => {
          captionElement.current = el;
        }}
        className="gate-caption"
        style={{ visibility: 'hidden' }}
      >
        {items.map((item, side) => (
          <div key={side} className="gate-caption__row" onClick={() => navigate(item?.itemId ? { section, itemId: item.itemId } : { section })}>
            {item ? (
              <>
                <strong>{item.title}</strong>
                <span>{item.line}</span>
              </>
            ) : (
              <>
                <strong>All {SHOWCASE[section].length} here</strong>
                <span>Click to open the full list</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
