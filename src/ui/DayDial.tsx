import { useEffect, useState } from 'react';
import { dayClock } from '../world/lighting/clock';
import { formatClock } from '../world/lighting/dayClock';

/** One in-world minute passes every half real second, so this keeps the readout current. */
const REFRESH_MS = 500;

/**
 * Time-of-day control: play/pause the cycle and scrub to any hour. On phones it collapses to a time chip
 * that expands on tap; scrubbing leaves the running/paused state as it was.
 */
export function DayDial() {
  const [hours, setHours] = useState(() => dayClock.hours(performance.now()));
  const [paused, setPaused] = useState(dayClock.paused);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setHours(dayClock.hours(performance.now())), REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  const scrub = (value: number) => {
    dayClock.scrub(value, performance.now());
    setHours(dayClock.hours(performance.now()));
  };
  const togglePaused = () => {
    dayClock.setPaused(!paused, performance.now());
    setPaused(!paused);
  };
  const time = formatClock(hours);

  return (
    <div className={`day-dial${expanded ? ' is-expanded' : ''}`}>
      <button type="button" className="day-dial__chip" aria-expanded={expanded} aria-label={`Time of day ${time}. Show the day controls`} onClick={() => setExpanded(!expanded)}>
        <span aria-hidden="true">{hours >= 6 && hours < 19 ? '☀' : '☾'}</span> {time}
      </button>
      <div className="day-dial__controls">
        <button type="button" className="day-dial__play" aria-label={paused ? 'Resume the day cycle' : 'Pause the day cycle'} onClick={togglePaused}>
          <span aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
        </button>
        <input
          type="range"
          className="day-dial__range"
          min={0}
          max={24}
          step={0.25}
          value={hours}
          aria-label="Time of day"
          aria-valuetext={time}
          onChange={(e) => scrub(Number(e.currentTarget.value))}
        />
        <output className="day-dial__time" aria-hidden="true">
          {time}
        </output>
      </div>
    </div>
  );
}
