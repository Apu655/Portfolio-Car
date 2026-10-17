import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { roles } from '../../content/portfolio';
import { parseYearMonth } from '../../content/format';
import { createCareerTower } from '../../models/tower';
import { usePortfolio } from '../../state/store';
import { dampAngle } from '../flight/flightModel';
import { TOWER_POSITION } from '../layout';
import { Selectable } from './Selectable';

const TAU = Math.PI * 2;

/** Clockwise hand angle for a value on a dial of `steps`. */
const handAngle = (value: number, steps: number) => -(value / steps) * TAU;

export function CareerTower() {
  const tower = useMemo(() => createCareerTower(roles.map((r) => r.id)), []);

  // The clock is the career timeline dial: it shows the time, and swings to a role's start month when one is open.
  useFrame((_, dt) => {
    const { selection, panelOpen } = usePortfolio.getState();
    const role = panelOpen && selection?.section === 'experience' ? roles.find((r) => r.id === selection.itemId) : undefined;
    let hour: number;
    let minute: number;
    if (role) {
      const { month } = parseYearMonth(role.start);
      hour = handAngle(month % 12, 12);
      minute = 0;
    } else {
      const now = new Date();
      hour = handAngle((now.getHours() % 12) + now.getMinutes() / 60, 12);
      minute = handAngle(now.getMinutes(), 60);
    }
    const step = Math.min(dt, 0.1);
    for (const hand of tower.hourHands) hand.rotation.z = dampAngle(hand.rotation.z, hour, 4, step);
    for (const hand of tower.minuteHands) hand.rotation.z = dampAngle(hand.rotation.z, minute, 4, step);
  });

  return (
    <group position={TOWER_POSITION}>
      <Selectable selection={{ section: 'experience' }} exact>
        <primitive object={tower.shell} />
      </Selectable>
      {tower.floors.map((floor, i) => (
        <Selectable key={roles[i].id} selection={{ section: 'experience', itemId: roles[i].id }} exact>
          <primitive object={floor} />
        </Selectable>
      ))}
    </group>
  );
}
