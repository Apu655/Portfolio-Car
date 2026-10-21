import { papers } from '../content/portfolio';
import { usePortfolio } from '../state/store';
import { zoneFor, zoneSelection } from '../world/district/layout';
import { bubbleElement, useRoadsideCaption } from '../world/roadsideCaptions';

const ROBOT = zoneFor('research');
const PAPER = papers.find((p) => p.id === ROBOT.itemId)!;

/**
 * The SeCAREly robot's greeting (R9): a speech bubble over its head while the car is near. It names the paper and
 * its one-line description; pressing E in the zone, or tapping the title, opens the paper. Right after a bump, the
 * greeting line gives way to what the robot says about it.
 */
export function RobotBubble() {
  const showing = useRoadsideCaption((s) => s.bubble);
  const quip = useRoadsideCaption((s) => s.quip);
  const inZone = usePortfolio((s) => s.nearStop?.name === ROBOT.name);
  const navigate = usePortfolio((s) => s.navigate);
  const panelOpen = usePortfolio((s) => s.panelOpen);
  const revealing = usePortfolio((s) => s.revealing);
  if (!showing || panelOpen || revealing) return null;
  return (
    <div className="roadside-captions">
      <div
        ref={(el) => {
          bubbleElement.current = el;
        }}
        className="robot-bubble"
        style={{ visibility: 'hidden' }}
      >
        <span className="robot-bubble__hello" aria-live="polite">
          {quip ?? "Hi! I'm the SeCAREly assistant."}
        </span>
        <button type="button" className="roadside-caption__open" onClick={() => navigate(zoneSelection(ROBOT), { travel: false })}>
          {PAPER.title}
        </button>
        <span className="roadside-caption__line">{PAPER.tagline}</span>
        <span className="robot-bubble__hint">{inZone ? 'Press E to learn more' : 'Drive up to chat'}</span>
      </div>
    </div>
  );
}
