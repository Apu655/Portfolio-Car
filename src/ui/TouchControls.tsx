import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { touchActions, touchInput, touchStick } from '../world/drive/input';
import { telemetry } from '../world/events';

/** True on phones and tablets (a coarse pointer and no hover). */
export function useCoarsePointer(): boolean {
  const query = '(pointer: coarse)';
  const [coarse, setCoarse] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const onChange = () => setCoarse(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, []);
  return coarse;
}

const RADIUS = 52;

/** On-screen joystick (drive toward where you push) plus handbrake, boost, and recover buttons. */
export function TouchControls() {
  const base = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const boost = useRef<HTMLButtonElement>(null);

  // The boost button dims with the gauge while an emptied tank refills to its re-arm level.
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      boost.current?.classList.toggle('is-locked', telemetry.boostLocked);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(
    () => () => {
      touchStick.x = 0;
      touchStick.y = 0;
      touchInput.handbrake = false;
      touchInput.boost = false;
    },
    [],
  );

  const update = (event: PointerEvent) => {
    const rect = base.current!.getBoundingClientRect();
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > RADIUS) {
      dx = (dx / length) * RADIUS;
      dy = (dy / length) * RADIUS;
    }
    setKnob([dx, dy]);
    // Screen-relative: the car drives toward where the stick points (the car applies the dead zone).
    touchStick.x = dx / RADIUS;
    touchStick.y = -dy / RADIUS;
  };

  const release = () => {
    pointer.current = null;
    setKnob([0, 0]);
    touchStick.x = 0;
    touchStick.y = 0;
  };

  return (
    <div className="touch-controls">
      <div
        ref={base}
        className="joystick"
        role="presentation"
        onPointerDown={(e) => {
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          update(e);
        }}
        onPointerMove={(e) => pointer.current === e.pointerId && update(e)}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <div className="joystick__knob" style={{ transform: `translate(${knob[0]}px, ${knob[1]}px)` }} />
      </div>
      <button
        type="button"
        className="brake-button"
        onPointerDown={() => (touchInput.handbrake = true)}
        onPointerUp={() => (touchInput.handbrake = false)}
        onPointerCancel={() => (touchInput.handbrake = false)}
        onPointerLeave={() => (touchInput.handbrake = false)}
      >
        Brake
      </button>
      <button
        ref={boost}
        type="button"
        className="boost-button"
        onPointerDown={() => (touchInput.boost = true)}
        onPointerUp={() => (touchInput.boost = false)}
        onPointerCancel={() => (touchInput.boost = false)}
        onPointerLeave={() => (touchInput.boost = false)}
      >
        Boost
      </button>
      <button type="button" className="recover-button" onClick={() => (touchActions.recover = true)}>
        Recover
      </button>
    </div>
  );
}
