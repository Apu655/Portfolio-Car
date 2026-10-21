import { useEffect, useMemo, useRef, useState } from 'react';
import { usePortfolio } from '../state/store';
import { POND, ROADS, SECTION_GATES, SECTION_LETTERS, SECTION_TITLES, TOWER, ZONES } from '../world/district/layout';
import { telemetry } from '../world/events';
import { BoostGauge } from './BoostGauge';
import { mapAngle, MAP_SCALE, MAP_SIZE, toMap } from './minimapProjection';

/** World points around the rounded-rectangle road loop. */
function loopPoints(): Array<[number, number]> {
  const { halfX, halfZ, cornerRadius: r } = ROADS.loop;
  const corners: Array<[number, number, number]> = [
    [halfX - r, -halfZ + r, -Math.PI / 2],
    [halfX - r, halfZ - r, 0],
    [-halfX + r, halfZ - r, Math.PI / 2],
    [-halfX + r, -halfZ + r, Math.PI],
  ];
  const points: Array<[number, number]> = [];
  for (const [cx, cz, start] of corners) {
    for (let k = 0; k <= 8; k++) {
      const a = start + (k / 8) * (Math.PI / 2);
      points.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  }
  return points;
}

const path = (points: Array<[number, number]>, close = false) =>
  points.map(([x, z], i) => `${i ? 'L' : 'M'}${toMap(x, z).map((v) => v.toFixed(1)).join(' ')}`).join(' ') + (close ? ' Z' : '');

const isTyping = (target: EventTarget | null) => target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"]');

/**
 * Corner map of the district, drawn the way the camera shows it (north-east up): roads, the pond, the tower, the
 * car, and a lettered marker per section that travels there (R9, R10). N toggles a larger map.
 */
export function Minimap() {
  const navigate = usePortfolio((s) => s.navigate);
  const [expanded, setExpanded] = useState(false);
  const car = useRef<SVGGElement>(null);
  const shapes = useMemo(() => {
    const roadWidth = ROADS.width * MAP_SCALE;
    const pond = Array.from({ length: 24 }, (_, k): [number, number] => {
      const a = (k / 24) * Math.PI * 2;
      return [POND.center[0] + Math.cos(a) * POND.radiusX, POND.center[1] + Math.sin(a) * POND.radiusZ];
    });
    const t = TOWER.halfSize;
    const tower: Array<[number, number]> = [
      [TOWER.center[0] - t, TOWER.center[1] - t],
      [TOWER.center[0] + t, TOWER.center[1] - t],
      [TOWER.center[0] + t, TOWER.center[1] + t],
      [TOWER.center[0] - t, TOWER.center[1] + t],
    ];
    const halfZ = ROADS.loop.halfZ - ROADS.width / 2;
    return {
      roadWidth,
      loop: path(loopPoints(), true),
      cross: path([
        [0, -halfZ],
        [0, halfZ],
      ]),
      pond: path(pond, true),
      tower: path(tower, true),
      gates: SECTION_GATES.map((g) => ({ section: g.section, at: toMap(...g.center) })),
    };
  }, []);

  // Follow the car without re-rendering: write its marker's transform every frame.
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const [x, , z] = telemetry.position;
      const [mx, my] = toMap(x, z);
      car.current?.setAttribute('transform', `translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${mapAngle(telemetry.heading).toFixed(1)})`);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyN' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      setExpanded((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <nav className={`minimap${expanded ? ' is-expanded' : ''}`} aria-label="District map">
      <BoostGauge />
      <svg viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`} role="presentation">
        <path d={shapes.loop} className="minimap__road" strokeWidth={shapes.roadWidth} />
        <path d={shapes.cross} className="minimap__road" strokeWidth={shapes.roadWidth} />
        <path d={shapes.pond} className="minimap__pond" />
        <path d={shapes.tower} className="minimap__tower" />
        {shapes.gates.map((g) => (
          <circle key={g.section} cx={g.at[0]} cy={g.at[1]} r={2.2} className="minimap__gate" />
        ))}
        <g ref={car} aria-hidden="true">
          <path d="M0 -6 L4.5 5 L0 2.5 L-4.5 5 Z" className="minimap__car" />
        </g>
      </svg>
      {ZONES.map((zone) => {
        const [x, y] = toMap(...zone.center);
        const letter = SECTION_LETTERS[zone.section];
        const title = SECTION_TITLES[zone.section];
        return (
          <button
            key={zone.section}
            type="button"
            className="minimap__marker"
            style={{ left: `${(x / MAP_SIZE) * 100}%`, top: `${(y / MAP_SIZE) * 100}%`, borderColor: zone.accent }}
            aria-label={`Travel to ${title} (${letter})`}
            title={`${letter} · ${title}`}
            onClick={() => navigate({ section: zone.section })}
          >
            <span aria-hidden="true">{letter}</span>
          </button>
        );
      })}
      {expanded && (
        <ul className="minimap__legend">
          {ZONES.map((zone) => (
            <li key={zone.section}>
              <button type="button" style={{ borderColor: zone.accent }} onClick={() => navigate({ section: zone.section })}>
                <strong>{SECTION_LETTERS[zone.section]}</strong> {SECTION_TITLES[zone.section]}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="minimap__toggle" aria-expanded={expanded} aria-label={expanded ? 'Shrink the map' : 'Enlarge the map'} onClick={() => setExpanded(!expanded)}>
        <span aria-hidden="true">{expanded ? '–' : '+'}</span>
      </button>
    </nav>
  );
}
