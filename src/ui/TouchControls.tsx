import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { touchInput } from '../world/drive/input';

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

/** On-screen joystick (drive and steer) plus a handbrake button, feeding the same input the keyboard does. */
export function TouchControls() {
  const base = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [knob, setKnob] = useState<[number, number]>([0, 0]);

  useEffect(
    () => () => {
      touchInput.throttle = 0;
      touchInput.steer = 0;
      touchInput.handbrake = false;
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
    // A small dead zone keeps the car still when a thumb rests on the stick.
    const axis = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
    touchInput.throttle = axis(-dy / RADIUS);
    touchInput.steer = axis(-dx / RADIUS);
  };

  const release = () => {
    pointer.current = null;
    setKnob([0, 0]);
    touchInput.throttle = 0;
    touchInput.steer = 0;
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
    </div>
  );
}
