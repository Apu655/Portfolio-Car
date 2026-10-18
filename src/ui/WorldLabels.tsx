import { usePortfolio } from '../state/store';
import { zoneFor } from '../world/district/layout';
import { isLabelActive, labelElements, WORLD_LABELS } from '../world/labels';
import { useRoadsideCaption } from '../world/roadsideCaptions';

/** The robot's own name tag steps aside while its greeting bubble shows. */
const ROBOT_ITEM = zoneFor('research').itemId;

/**
 * Name tags for world objects. Plain DOM above the canvas; the scene's LabelProjector positions them.
 * Hidden from assistive tech — the Menu offers the same destinations as real buttons.
 */
export function WorldLabels() {
  const hovered = usePortfolio((s) => s.hovered);
  const open = usePortfolio((s) => (s.panelOpen ? s.selection : null));
  const revealing = usePortfolio((s) => s.revealing);
  const bubble = useRoadsideCaption((s) => s.bubble);
  if (revealing) return null;
  return (
    <div className="world-labels" aria-hidden="true">
      {WORLD_LABELS.map((label) => {
        const active = isLabelActive(label, open);
        const highlighted = active || hovered === label.id;
        if (!label.always && !highlighted) return null;
        if (bubble && label.selection.itemId === ROBOT_ITEM) return null;
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
