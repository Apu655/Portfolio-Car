import { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { usePortfolio } from '../state/store';

/** No progress for this long counts as a failed load. */
export const STALL_MS = 20_000;

export const LOAD_FAILED_NOTICE = 'The 3D city didn’t finish loading, so you’re seeing the quick view.';

/**
 * Real progress while models, physics, and sounds load. The quick view is always one click away, and a stalled
 * load falls back to it instead of stranding the visitor on a stuck bar.
 */
export function LoadingScreen() {
  const { active, progress, errors } = useProgress();
  const switchView = usePortfolio((s) => s.switchView);
  const [done, setDone] = useState(false);
  const lastProgress = useRef({ value: -1, at: Date.now() });

  useEffect(() => {
    if (!active && progress >= 100) {
      const timer = setTimeout(() => setDone(true), 350);
      return () => clearTimeout(timer);
    }
  }, [active, progress]);

  useEffect(() => {
    if (done) return;
    const fail = () => usePortfolio.setState({ view: 'basic', notice: LOAD_FAILED_NOTICE, transition: 'idle' });
    if (errors.length > 0) {
      fail();
      return;
    }
    const timer = setInterval(() => {
      if (progress !== lastProgress.current.value) lastProgress.current = { value: progress, at: Date.now() };
      else if (Date.now() - lastProgress.current.at > STALL_MS) fail();
    }, 1000);
    return () => clearInterval(timer);
  }, [done, progress, errors.length]);

  if (done) return null;
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <p className="loading-screen__title">Building the city…</p>
      <div className="loading-bar" aria-hidden="true">
        <div className="loading-bar__fill" style={{ transform: `scaleX(${Math.max(0.03, progress / 100)})` }} />
      </div>
      <p className="loading-screen__value">{Math.round(progress)}%</p>
      <button type="button" onClick={() => switchView('basic')}>
        Quick view instead
      </button>
    </div>
  );
}
