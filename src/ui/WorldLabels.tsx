import { usePortfolio } from '../state/store';
import { isLabelActive, labelElements, WORLD_LABELS } from '../world/labels';

/**
 * Name tags for world objects. Plain DOM above the canvas; the scene's LabelProjector positions them.
 * Hidden from assistive tech — the Menu offers the same destinations as real buttons.
 */
export function WorldLabels() {
  const hovered = usePortfolio((s) => s.hovered);
  const open = usePortfolio((s) => (s.panelOpen ? s.selection : null));
  return (
    <div className="world-labels" aria-hidden="true">
      {WORLD_LABELS.map((label) => {
        const active = isLabelActive(label, open);
        const highlighted = active || hovered === label.id;
        if (!label.always && !highlighted) return null;
        return (
          <div
            key={label.id}
            ref={(element) => {
              if (element) labelElements.set(label.id, element);
              else labelElements.delete(label.id);
            }}
            className={`world-label${highlighted ? ' is-active' : ''}`}
            style={{ visibility: 'hidden' }}
          >
            {label.text}
          </div>
        );
      })}
    </div>
  );
}
