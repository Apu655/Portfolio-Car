// Audio settings (R22): mute and volume, remembered across visits, plus the engine's status for the HUD.
import { create } from 'zustand';

/** pending: waiting for the first gesture · running: sounding · suspended: the browser paused it (next gesture resumes). */
export type AudioStatus = 'pending' | 'running' | 'suspended';

const KEY = 'portfolio.audio';

interface Saved {
  muted: boolean;
  volume: number;
}

function load(): Saved {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
    return {
      muted: saved.muted === true,
      volume: typeof saved.volume === 'number' && saved.volume >= 0 && saved.volume <= 1 ? saved.volume : 0.7,
    };
  } catch {
    return { muted: false, volume: 0.7 };
  }
}

function save(settings: Saved): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode); the setting still applies for this visit.
  }
}

interface AudioSettings extends Saved {
  status: AudioStatus;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  setStatus(status: AudioStatus): void;
  /** Re-read the saved settings (on start-up). */
  reload(): void;
}

export const useAudioSettings = create<AudioSettings>((set, get) => ({
  ...load(),
  status: 'pending',
  setMuted: (muted) => {
    set({ muted });
    save({ muted, volume: get().volume });
  },
  setVolume: (volume) => {
    const v = Math.min(1, Math.max(0, volume));
    set({ volume: v });
    save({ muted: get().muted, volume: v });
  },
  setStatus: (status) => set({ status }),
  reload: () => set(load()),
}));
