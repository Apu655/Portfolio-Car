// Audio settings (R22): mute and volume, remembered across visits, plus the engine's status for the HUD.
import { create } from 'zustand';

/** pending: waiting for the first gesture · running: sounding · suspended: the browser paused it (next gesture resumes). */
export type AudioStatus = 'pending' | 'running' | 'suspended';

const KEY = 'portfolio.audio';

interface Saved {
  muted: boolean;
  volume: number;
  /** Whether the ambient score plays (sound effects are unaffected). */
  music: boolean;
}

function load(): Saved {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
    return {
      muted: saved.muted === true,
      volume: typeof saved.volume === 'number' && saved.volume >= 0 && saved.volume <= 1 ? saved.volume : 0.5,
      music: saved.music !== false,
    };
  } catch {
    return { muted: false, volume: 0.5, music: true };
  }
}

function save(settings: Saved): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode); the setting still applies for this visit.
  }
}

const pick = ({ muted, volume, music }: Saved): Saved => ({ muted, volume, music });

interface AudioSettings extends Saved {
  status: AudioStatus;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  setMusic(music: boolean): void;
  setStatus(status: AudioStatus): void;
  /** Re-read the saved settings (on start-up). */
  reload(): void;
}

export const useAudioSettings = create<AudioSettings>((set, get) => ({
  ...load(),
  status: 'pending',
  setMuted: (muted) => {
    set({ muted });
    save({ ...pick(get()), muted });
  },
  setVolume: (volume) => {
    const v = Math.min(1, Math.max(0, volume));
    set({ volume: v });
    save({ ...pick(get()), volume: v });
  },
  setMusic: (music) => {
    set({ music });
    save({ ...pick(get()), music });
  },
  setStatus: (status) => set({ status }),
  reload: () => set(load()),
}));
