import { distanceToCollider, STATIC_COLLIDERS } from './colliders';
import { TO_CAMERA } from '../camera/framing';
import { SHOWCASE } from '../../content/showcase';
import {
  BILLBOARD,
  BUILDINGS,
  CAMPUS,
  CONTACT_KIOSK,
  FLOWER_BEDS,
  FOOTBALLS,
  GATE_FRAME,
  gatePoint,
  HEADING,
  LAMPS,
  onRoad,
  PARK_POCKETS,
  PITCH,
  PLAZAS,
  POND,
  pondDepth,
  pondNorm,
  PROJECTS_HALL,
  PROPS,
  ROADSIDE_BILLBOARDS,
  ROADSIDE_FRAME,
  ROADSIDE_SLOTS,
  roadsidePoint,
  ROADS,
  ROBOT,
  SECTION_GATES,
  SPAWN,
  TOWER,
  TRAVEL,
  TREES,
  ZONES,
  zoneAt,
  zoneFor,
  type Building,
  type Vec2,
  type Vec3,
} from './layout';
import type { TowerSection } from '../events';

const solids = STATIC_COLLIDERS.filter((c) => !c.name.startsWith('wall-'));
const SECTIONS: TowerSection[] = ['experience', 'research', 'projects', 'education', 'contact'];

/** Progress along a section's road in its direction of travel. */
const progress = (section: TowerSection, [x, z]: Vec2) => x * TRAVEL[section][0] + z * TRAVEL[section][1];

/** The road coordinate each section's road runs along: x for north–south roads, z for east–west ones. */
const ROAD_LINE: Record<TowerSection, { axis: 0 | 1; at: number }> = {
  experience: { axis: 0, at: ROADS.crossStreetX },
  research: { axis: 0, at: ROADS.loop.halfX },
  projects: { axis: 1, at: -ROADS.loop.halfZ },
  education: { axis: 0, at: -ROADS.loop.halfX },
  contact: { axis: 1, at: ROADS.loop.halfZ },
};

/** Whether a point stands on the side of its section's road away from the fixed camera (KTD2): east or north. */
const farSide = (section: TowerSection, p: Vec2) => {
  const line = ROAD_LINE[section];
  return line.axis === 0 ? p[0] > line.at + ROADS.width / 2 : p[1] < line.at - ROADS.width / 2;
};

/** Where each section's stop structure stands. */
const STOP_AT: Record<TowerSection, Vec2> = {
  experience: TOWER.center,
  research: ROBOT.position,
  projects: PROJECTS_HALL.center,
  education: CAMPUS.center,
  contact: CONTACT_KIOSK.position,
};

/** A billboard face's corners on screen, projected along the fixed camera's view (KTD3, R5). */
function projectedFace(position: Vec2): { minX: number; maxX: number; minY: number; maxY: number } {
  const f: Vec3 = [-TO_CAMERA[0], -TO_CAMERA[1], -TO_CAMERA[2]];
  const right: Vec3 = [-f[2], 0, f[0]];
  const rl = Math.hypot(...right);
  const r: Vec3 = [right[0] / rl, 0, right[2] / rl];
  const up: Vec3 = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const { width, height, centerY, tilt } = ROADSIDE_FRAME;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      // The face leans back: its top moves away from the camera (local -Z).
      const ly = centerY + sy * (height / 2) * Math.cos(tilt);
      const lz = -sy * (height / 2) * Math.sin(tilt);
      const [x, z] = roadsidePoint(position, sx * (width / 2), lz);
      xs.push(x * r[0] + ly * r[1] + z * r[2]);
      ys.push(x * up[0] + ly * up[1] + z * up[2]);
    }
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** Gap between a building's footprint and an axis-aligned rectangle; negative when they overlap. */
const rectGap = (b: Building, center: Vec2, half: Vec2) =>
  Math.max(Math.abs(b.center[0] - center[0]) - b.half[0] - half[0], Math.abs(b.center[1] - center[1]) - b.half[1] - half[1]);

/** Distance from a building's footprint to a ground point (0 inside). */
const pointGap = (b: Building, [x, z]: Vec2) =>
  Math.hypot(Math.max(Math.abs(x - b.center[0]) - b.half[0], 0), Math.max(Math.abs(z - b.center[1]) - b.half[1], 0));

/** Points covering a building's footprint at most 1 m apart, edges included. */
function footprintGrid(b: Building): Vec2[] {
  const nx = Math.ceil(b.half[0] * 2);
  const nz = Math.ceil(b.half[1] * 2);
  const points: Vec2[] = [];
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= nz; j++) points.push([b.center[0] - b.half[0] + (i / nx) * b.half[0] * 2, b.center[1] - b.half[1] + (j / nz) * b.half[1] * 2]);
  }
  return points;
}

/** A building on the camera side of its road (south or west of it) faces north or east (KTD4). */
const cameraSide = (b: Building) => Math.abs(b.rotationY - HEADING.north) < 1e-6 || Math.abs(b.rotationY - HEADING.east) < 1e-6;

/** Points along the loop's centerline about `step` apart, each with the outward normal. */
function loopSamples(step: number): Array<{ at: Vec2; normal: Vec2 }> {
  const { halfX, halfZ, cornerRadius: r } = ROADS.loop;
  const ix = halfX - r;
  const iz = halfZ - r;
  const out: Array<{ at: Vec2; normal: Vec2 }> = [];
  const line = (from: Vec2, to: Vec2, normal: Vec2) => {
    const n = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / step);
    for (let i = 0; i < n; i++) out.push({ at: [from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n], normal });
  };
  line([ix, -halfZ], [-ix, -halfZ], [0, -1]);
  line([-halfX, -iz], [-halfX, iz], [-1, 0]);
  line([-ix, halfZ], [ix, halfZ], [0, 1]);
  line([halfX, iz], [halfX, -iz], [1, 0]);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const n = Math.ceil((r * Math.PI) / 2 / step);
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * (Math.PI / 2);
      const normal: Vec2 = [sx * Math.cos(a), sz * Math.sin(a)];
      out.push({ at: [sx * ix + normal[0] * r, sz * iz + normal[1] * r], normal });
    }
  }
  return out;
}

describe('district layout', () => {
  it('has one stop per section, with the robot standing for SeCAREly', () => {
    expect(ZONES.map((z) => z.section)).toEqual(SECTIONS);
    expect(zoneFor('experience').name).toBe('Career Tower');
    expect(zoneFor('research').itemId).toBe('secarely');
    for (const section of SECTIONS.filter((s) => s !== 'research')) expect(zoneFor(section).itemId, section).toBeUndefined();
  });

  it('puts every zone and parking spot on a road, clear of anything solid', () => {
    for (const zone of ZONES) {
      expect(onRoad(...zone.center), zone.name).toBe(true);
      expect(onRoad(...zone.parking.position), zone.name).toBe(true);
      for (const c of solids) expect(distanceToCollider(c, ...zone.parking.position), `${zone.name} vs ${c.name}`).toBeGreaterThan(2.5);
    }
  });

  it('finds the zone the car is in, and nothing just outside it', () => {
    const career = zoneFor('experience');
    expect(zoneAt(...career.center)?.section).toBe('experience');
    expect(zoneAt(...career.parking.position)?.section).toBe('experience');
    expect(zoneAt(career.center[0] + career.radius + 0.5, career.center[1])).toBeNull();
  });

  it('spawns on the road with clear space ahead, facing the billboard side of the street', () => {
    expect(onRoad(...SPAWN.position)).toBe(true);
    for (const c of solids) expect(distanceToCollider(c, ...SPAWN.position), c.name).toBeGreaterThan(3);
    // Heading east: the billboard is ahead (+X) and to the right (+Z, south).
    expect(BILLBOARD.position[0]).toBeGreaterThan(SPAWN.position[0]);
    expect(BILLBOARD.position[2]).toBeGreaterThan(SPAWN.position[1]);
  });

  it('keeps solid scenery off the roads, except the robot, which stands in the road on purpose (R7)', () => {
    for (const c of solids) {
      if (c.name === 'robot') continue;
      expect(onRoad(c.position[0], c.position[2], -0.5), c.name).toBe(false);
    }
  });

  it('leaves both lanes beside the robot drivable (R8)', () => {
    const [x, z] = ROBOT.position;
    expect(onRoad(x, z)).toBe(true);
    expect(x).toBe(ROADS.loop.halfX);
    const clear = ROADS.width / 2 - ROBOT.radius;
    expect(clear).toBeGreaterThanOrEqual(3.5);
    for (const c of solids) {
      if (c.name === 'robot') continue;
      for (const side of [-1, 1]) expect(distanceToCollider(c, x + side * (ROBOT.radius + 1.75), z), c.name).toBeGreaterThan(1);
    }
  });

  it('places trees outside the pond and away from props and zones', () => {
    for (const t of TREES) {
      expect(pondDepth(t.position[0], t.position[2])).toBe(0);
      for (const zone of ZONES) expect(Math.hypot(t.position[0] - zone.center[0], t.position[2] - zone.center[1])).toBeGreaterThan(zone.radius);
    }
  });

  it('has a drivable shallow pond: deepest in the middle, zero at the shore', () => {
    expect(pondDepth(...POND.center)).toBe(POND.depth);
    expect(pondDepth(POND.center[0] + POND.radiusX + 0.1, POND.center[1])).toBe(0);
    const shore = pondDepth(POND.center[0] + POND.radiusX - 1, POND.center[1]);
    expect(shore).toBeGreaterThan(0);
    expect(shore).toBeLessThan(POND.depth);
  });

  it('builds a brick wall of several courses and enough props for the playground', () => {
    const bricks = PROPS.filter((p) => p.kind === 'brick');
    expect(bricks.length).toBeGreaterThan(40);
    expect(new Set(bricks.map((b) => b.position[1].toFixed(2))).size).toBe(6);
    expect(PROPS.filter((p) => p.kind === 'cone')).toHaveLength(8);
    expect(new Set(PROPS.map((p) => p.id)).size).toBe(PROPS.length);
  });

  it('turns the name billboard to face the fixed camera (R13)', () => {
    // The board's face points along its local +Z, rotated by rotationY.
    const front = [Math.sin(BILLBOARD.rotationY), Math.cos(BILLBOARD.rotationY)];
    const toCamera = [TO_CAMERA[0], TO_CAMERA[2]];
    const length = Math.hypot(toCamera[0], toCamera[1]);
    const cos = (front[0] * toCamera[0] + front[1] * toCamera[1]) / length;
    expect(cos).toBeGreaterThan(Math.cos((10 * Math.PI) / 180));
  });

  it('puts each gate across its own road, before its billboards and its stop (R1, R2)', () => {
    expect(SECTION_GATES.map((g) => g.section).sort()).toEqual([...SECTIONS].sort());
    for (const g of SECTION_GATES) {
      const line = ROAD_LINE[g.section];
      expect(g.center[line.axis], g.section).toBe(line.at);
      expect(onRoad(...g.center), g.section).toBe(true);
      for (const side of [-1, 1]) expect(onRoad(...gatePoint(g, side * g.halfSpan, 0), -0.5), `${g.section} pillar`).toBe(false);
      const gateAt = progress(g.section, g.center);
      const zone = zoneFor(g.section);
      expect(progress(g.section, zone.center), `${g.section} zone`).toBeGreaterThan(gateAt + zone.radius);
      expect(progress(g.section, STOP_AT[g.section]), `${g.section} stop`).toBeGreaterThan(gateAt);
      for (const slot of ROADSIDE_BILLBOARDS[g.section]) expect(progress(g.section, slot), `${g.section} board`).toBeGreaterThan(gateAt);
    }
    // The robot greets the car before the paper billboards (R7).
    for (const slot of ROADSIDE_BILLBOARDS.research) expect(progress('research', slot)).toBeGreaterThan(progress('research', ROBOT.position));
  });

  it('stands billboards and buildings beside their road on the side away from the camera (KTD2)', () => {
    for (const section of SECTIONS) {
      for (const slot of ROADSIDE_BILLBOARDS[section]) expect(farSide(section, slot), `${section} board ${slot}`).toBe(true);
      if (section !== 'research' && section !== 'experience') expect(farSide(section, STOP_AT[section]), `${section} stop`).toBe(true);
    }
  });

  it('pairs billboard slots with the showcase items (KTD4)', () => {
    expect(ROADSIDE_BILLBOARDS.experience).toHaveLength(SHOWCASE.experience.length);
    expect(ROADSIDE_BILLBOARDS.research).toHaveLength(SHOWCASE.research.filter((i) => i.itemId !== 'secarely').length);
    expect(ROADSIDE_BILLBOARDS.education).toHaveLength(SHOWCASE.education.length);
    expect(ROADSIDE_BILLBOARDS.contact).toHaveLength(1);
    expect(ROADSIDE_BILLBOARDS.projects).toHaveLength(0);
    expect(ROADSIDE_BILLBOARDS.research).toHaveLength(8);
  });

  it('never overlaps two billboard faces in the fixed camera view (R5)', () => {
    const faces = ROADSIDE_SLOTS.map((s) => ({ key: s.key, box: projectedFace(s.position) }));
    for (let i = 0; i < faces.length; i++) {
      for (let j = i + 1; j < faces.length; j++) {
        const a = faces[i].box;
        const b = faces[j].box;
        const overlap = a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
        expect(overlap, `${faces[i].key} vs ${faces[j].key}`).toBe(false);
      }
    }
  });

  it('keeps billboards, buildings, and the robot clear of roads, plazas, the pitch, the pond, and each other', () => {
    const footprints: Array<{ name: string; at: Vec2; half: number }> = [
      ...ROADSIDE_SLOTS.map((s) => ({ name: s.key, at: s.position, half: (ROADSIDE_FRAME.width / 2) * Math.SQRT1_2 + 0.6 })),
      { name: 'robot', at: ROBOT.position, half: ROBOT.radius },
      { name: 'hall', at: PROJECTS_HALL.center, half: Math.max(...PROJECTS_HALL.size) / 2 },
      { name: 'campus', at: CAMPUS.center, half: Math.max(...CAMPUS.size) / 2 },
      { name: 'kiosk', at: CONTACT_KIOSK.position, half: 1.7 },
    ];
    for (const s of ROADSIDE_SLOTS) {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const [x, z] = roadsidePoint(s.position, (sx * ROADSIDE_FRAME.width) / 2, sz * 0.6);
          expect(onRoad(x, z, ROADS.sidewalk), s.key).toBe(false);
        }
      }
    }
    for (const [name, center, size] of [
      ['hall', PROJECTS_HALL.center, PROJECTS_HALL.size],
      ['campus', CAMPUS.center, CAMPUS.size],
    ] as const) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) expect(onRoad(center[0] + (sx * size[0]) / 2, center[1] + (sz * size[1]) / 2, ROADS.sidewalk), name).toBe(false);
    }
    for (const f of footprints) {
      if (f.name !== 'robot') expect(pondDepth(...f.at), f.name).toBe(0);
      expect(Math.abs(f.at[0] - PITCH.center[0]) < PITCH.size[0] / 2 + f.half && Math.abs(f.at[1] - PITCH.center[1]) < PITCH.size[1] / 2 + f.half, f.name).toBe(false);
      expect(Math.abs(f.at[0] - TOWER.center[0]) < TOWER.halfSize + f.half && Math.abs(f.at[1] - TOWER.center[1]) < TOWER.halfSize + f.half, f.name).toBe(false);
      for (const p of PLAZAS) {
        if (p.name === 'projects' && f.name === 'hall') continue;
        const inside = Math.abs(f.at[0] - p.center[0]) < p.size[0] / 2 + f.half && Math.abs(f.at[1] - p.center[1]) < p.size[1] / 2 + f.half;
        expect(inside, `${f.name} on plaza ${p.name}`).toBe(false);
      }
      BUILDINGS.forEach((b, i) => expect(pointGap(b, f.at), `${f.name} vs building-${i}`).toBeGreaterThan(f.half));
    }
    for (let i = 0; i < footprints.length; i++) {
      for (let j = i + 1; j < footprints.length; j++) {
        const [a, b] = [footprints[i], footprints[j]];
        expect(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]), `${a.name} vs ${b.name}`).toBeGreaterThan(a.half + b.half);
      }
    }
    for (const l of LAMPS) for (const f of footprints) expect(Math.hypot(l.position[0] - f.at[0], l.position[2] - f.at[1]), `lamp vs ${f.name}`).toBeGreaterThan(f.half);
  });

  it('turns every gate face toward the fixed camera', () => {
    const toCamera = [TO_CAMERA[0], TO_CAMERA[2]];
    const length = Math.hypot(toCamera[0], toCamera[1]);
    for (const g of SECTION_GATES) {
      const cos = (Math.sin(g.rotationY) * toCamera[0] + Math.cos(g.rotationY) * toCamera[1]) / length;
      expect(cos, g.section).toBeGreaterThan(Math.cos((50 * Math.PI) / 180));
    }
  });

  it('keeps the football pitch clear: off the roads and the pond, with no trees or props on it', () => {
    const inside = (x: number, z: number, margin = 0) =>
      Math.abs(x - PITCH.center[0]) < PITCH.size[0] / 2 + margin && Math.abs(z - PITCH.center[1]) < PITCH.size[1] / 2 + margin;
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = PITCH.center[0] + (dx * PITCH.size[0]) / 2;
      const z = PITCH.center[1] + (dz * PITCH.size[1]) / 2;
      expect(onRoad(x, z, 1)).toBe(false);
      expect(pondDepth(x, z)).toBe(0);
    }
    for (const t of TREES) expect(inside(t.position[0], t.position[2], 5)).toBe(false);
    for (const p of PROPS) expect(inside(p.position[0], p.position[2], 1), p.id).toBe(false);
    expect(FOOTBALLS).toHaveLength(8);
    for (const [x, z] of FOOTBALLS) expect(inside(x, z)).toBe(true);
  });
});

describe('city blocks (U4)', () => {
  const { halfX, halfZ } = ROADS.loop;
  /** Distance from a road's centerline to the back of its sidewalk. */
  const edge = ROADS.width / 2 + ROADS.sidewalk;

  it('lines the streets with at least 60 buildings, each a valid record', () => {
    expect(BUILDINGS.length).toBeGreaterThanOrEqual(60);
    const headings = Object.values(HEADING);
    for (const [i, b] of BUILDINGS.entries()) {
      expect(b.half[0] > 0 && b.half[1] > 0 && b.height > 0, `building-${i}`).toBe(true);
      expect(headings.some((h) => Math.abs(h - b.rotationY) < 1e-6), `building-${i} faces a road`).toBe(true);
      expect(Number.isInteger(b.palette) && b.palette >= 0, `building-${i} palette`).toBe(true);
      expect(Number.isInteger(b.variant) && b.variant >= 0, `building-${i} variant`).toBe(true);
    }
    // Exported to JSON for Blender.
    expect(JSON.parse(JSON.stringify(BUILDINGS))).toEqual(BUILDINGS);
  });

  it('keeps every building off the roads, sidewalks, pond and pitch', () => {
    const goal = PITCH.goal.depth;
    BUILDINGS.forEach((b, i) => {
      for (const [x, z] of footprintGrid(b)) {
        expect(onRoad(x, z, ROADS.sidewalk), `building-${i} on road at ${x},${z}`).toBe(false);
        expect(pondNorm(x, z), `building-${i} in the pond`).toBeGreaterThan(1);
        expect(pondDepth(x, z)).toBe(0);
      }
      expect(rectGap(b, PITCH.center, [PITCH.size[0] / 2 + goal, PITCH.size[1] / 2]), `building-${i} on the pitch`).toBeGreaterThan(0);
    });
  });

  it('keeps buildings clear of plazas, park pockets, flower beds, props, stops, gates, billboards and landmarks', () => {
    BUILDINGS.forEach((b, i) => {
      const name = `building-${i}`;
      for (const p of PLAZAS) expect(rectGap(b, p.center, [p.size[0] / 2, p.size[1] / 2]), `${name} vs plaza ${p.name}`).toBeGreaterThan(0);
      for (const p of PARK_POCKETS) expect(rectGap(b, p.center, [p.size[0] / 2, p.size[1] / 2]), `${name} vs pocket ${p.name}`).toBeGreaterThan(0);
      for (const f of FLOWER_BEDS) expect(rectGap(b, f.center, [f.size[0] / 2, f.size[1] / 2]), `${name} vs bed`).toBeGreaterThan(0);
      for (const p of PROPS) expect(pointGap(b, [p.position[0], p.position[2]]), `${name} vs ${p.id}`).toBeGreaterThan(1);
      for (const zone of ZONES) expect(pointGap(b, zone.center), `${name} vs ${zone.name} zone`).toBeGreaterThan(zone.radius);
      for (const g of SECTION_GATES) {
        for (const side of [-1, 1]) expect(pointGap(b, gatePoint(g, side * g.halfSpan, 0)), `${name} vs gate ${g.section}`).toBeGreaterThan(GATE_FRAME.pillarHalf * Math.SQRT2);
      }
      for (const s of ROADSIDE_SLOTS) expect(pointGap(b, s.position), `${name} vs ${s.key}`).toBeGreaterThan(ROADSIDE_FRAME.width / 2);
      expect(pointGap(b, [BILLBOARD.position[0], BILLBOARD.position[2]]), `${name} vs name billboard`).toBeGreaterThan(BILLBOARD.width / 2);
      expect(rectGap(b, TOWER.center, [TOWER.halfSize, TOWER.halfSize]), `${name} vs tower`).toBeGreaterThan(0);
      expect(rectGap(b, PROJECTS_HALL.center, [PROJECTS_HALL.size[0] / 2, PROJECTS_HALL.size[1] / 2]), `${name} vs hall`).toBeGreaterThan(0);
      expect(rectGap(b, CAMPUS.center, [CAMPUS.size[0] / 2, CAMPUS.size[1] / 2]), `${name} vs campus`).toBeGreaterThan(0);
      expect(pointGap(b, CONTACT_KIOSK.position), `${name} vs kiosk`).toBeGreaterThan(1.8);
      expect(pointGap(b, ROBOT.position), `${name} vs robot`).toBeGreaterThan(ROBOT.radius);
    });
    for (let i = 0; i < BUILDINGS.length; i++) {
      for (let j = i + 1; j < BUILDINGS.length; j++) {
        expect(rectGap(BUILDINGS[i], BUILDINGS[j].center, BUILDINGS[j].half), `building-${i} vs building-${j}`).toBeGreaterThan(0);
      }
    }
  });

  it('reserves park pockets around the pond, the benches and the flower beds', () => {
    const inPocket = ([x, z]: Vec2) => PARK_POCKETS.some((p) => Math.abs(x - p.center[0]) <= p.size[0] / 2 && Math.abs(z - p.center[1]) <= p.size[1] / 2);
    expect(inPocket(POND.center)).toBe(true);
    for (const p of PROPS.filter((q) => q.kind === 'bench')) expect(inPocket([p.position[0], p.position[2]]), p.id).toBe(true);
    for (const f of FLOWER_BEDS) expect(inPocket(f.center), `bed ${f.center}`).toBe(true);
  });

  it('stands high-rises only north or east of the loop (KTD4)', () => {
    const tall = BUILDINGS.filter((b) => b.height > 24);
    expect(BUILDINGS.filter((b) => b.height >= 40).length).toBeGreaterThan(0);
    for (const b of tall) {
      const north = b.center[1] + b.half[1] < -(halfZ + edge);
      const east = b.center[0] - b.half[0] > halfX + edge;
      expect(north || east, `${b.height} m at ${b.center}`).toBe(true);
    }
  });

  it('caps camera-side rows at 9 m and keeps inner-loop blocks mid-rise (KTD4)', () => {
    expect(BUILDINGS.filter(cameraSide).length).toBeGreaterThan(0);
    for (const b of BUILDINGS.filter(cameraSide)) expect(b.height, `camera-side at ${b.center}`).toBeLessThanOrEqual(9);
    for (const b of BUILDINGS.filter((q) => Math.abs(q.center[0]) < halfX && Math.abs(q.center[1]) < halfZ)) {
      expect(b.height, `inner block at ${b.center}`).toBeLessThanOrEqual(24);
    }
  });

  it('fronts most of the loop with buildings on at least one side (R2)', () => {
    const samples = loopSamples(1);
    const fronted = samples.filter(({ at, normal }) =>
      [-1, 1].some((side) =>
        Array.from({ length: 8 }, (_, k) => edge + 1 + k).some((d) => {
          const p: Vec2 = [at[0] + normal[0] * side * d, at[1] + normal[1] * side * d];
          return BUILDINGS.some((b) => pointGap(b, p) === 0);
        }),
      ),
    );
    expect(fronted.length / samples.length).toBeGreaterThan(0.5);
  });

  it('keeps trees and streetlights off the buildings', () => {
    for (const t of TREES) for (const [i, b] of BUILDINGS.entries()) expect(pointGap(b, [t.position[0], t.position[2]]), `tree vs building-${i}`).toBeGreaterThan(1);
    for (const l of LAMPS) for (const [i, b] of BUILDINGS.entries()) expect(pointGap(b, [l.position[0], l.position[2]]), `lamp vs building-${i}`).toBeGreaterThan(1);
  });
});
