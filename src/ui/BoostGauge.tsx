import { useEffect, useRef } from 'react';
import { BOOST } from '../world/physics/boost';
import { telemetry } from '../world/events';

/**
 * The nitro tank (R13 of the knock-overs and boost plan): a thin bar on the map card with a tick at the re-arm
 * level. Bright while full or firing, dimmed while refilling, greyed while locked out after running dry. Read
 * from telemetry every frame, so it never re-renders React.
 */
export function BoostGauge() {
  const meter = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    let shown = -1;
    let state = '';
    const tick = () => {
      const el = meter.current;
      const percent = Math.round(telemetry.boost * 100);
      const next = telemetry.boostLocked ? 'is-locked' : telemetry.boosting ? 'is-boosting' : telemetry.boost < 1 ? 'is-refilling' : '';
      if (el && percent !== shown) {
        el.setAttribute('aria-valuenow', String(percent));
        if (fill.current) fill.current.style.transform = `scaleX(${telemetry.boost.toFixed(3)})`;
        shown = percent;
      }
      if (el && next !== state) {
        el.className = `boost-gauge ${next}`.trim();
        state = next;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div ref={meter} className="boost-gauge" role="meter" aria-label="Nitro" aria-valuemin={0} aria-valuemax={100} aria-valuenow={100}>
      <div ref={fill} className="boost-gauge__fill" />
      <div className="boost-gauge__rearm" style={{ left: `${BOOST.rearm * 100}%` }} />
    </div>
  );
}
