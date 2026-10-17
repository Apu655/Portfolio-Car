import { useState } from 'react';
import { useAudioSettings } from '../world/audio/settings';

const HINT_ID = 'audio-status-hint';

/**
 * Master mute toggle plus a volume slider in a small popover. Before the first gesture it explains that
 * sound starts when you drive; a remembered mute shows as muted from the start.
 */
export function AudioControls() {
  const muted = useAudioSettings((s) => s.muted);
  const volume = useAudioSettings((s) => s.volume);
  const status = useAudioSettings((s) => s.status);
  const setMuted = useAudioSettings((s) => s.setMuted);
  const setVolume = useAudioSettings((s) => s.setVolume);
  const [open, setOpen] = useState(false);
  const silent = muted || volume === 0;
  const hint = status === 'pending' ? 'Sound starts when you drive' : status === 'suspended' ? 'Sound paused by the browser: tap or press a key to resume' : undefined;

  return (
    <div className={`audio-controls${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="audio-controls__mute"
        aria-pressed={muted}
        aria-label={muted ? 'Unmute sound' : 'Mute sound'}
        aria-describedby={hint ? HINT_ID : undefined}
        title={hint}
        onClick={() => setMuted(!muted)}
      >
        <span aria-hidden="true">{silent ? '🔇' : '🔊'}</span>
        {status === 'pending' && !muted && <span className="audio-controls__pending" aria-hidden="true" />}
      </button>
      <button type="button" className="audio-controls__more" aria-expanded={open} aria-label="Volume" onClick={() => setOpen(!open)}>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="audio-controls__popover">
          <label>
            Volume
            <input type="range" min={0} max={1} step={0.05} value={volume} aria-valuetext={`${Math.round(volume * 100)}%`} onChange={(e) => setVolume(Number(e.currentTarget.value))} />
          </label>
          {hint && <p className="audio-controls__hint">{hint}</p>}
        </div>
      )}
      {hint && (
        <span id={HINT_ID} className="visually-hidden">
          {hint}
        </span>
      )}
    </div>
  );
}
