import {
  createShipState,
  FLIGHT,
  NO_INPUT,
  stepAutopilot,
  stepFlight,
  wrapAngle,
  yawToward,
  type FlightEnvironment,
  type FlightInput,
  type ShipState,
} from './flightModel';

const openSpace: FlightEnvironment = { floorAt: () => 0, obstacles: [] };

function fly(state: ShipState, input: FlightInput, seconds: number, dt: number, env = openSpace): ShipState {
  let s = state;
  for (let t = 0; t < seconds - 1e-9; t += dt) s = stepFlight(s, input, dt, env);
  return s;
}

const forward: FlightInput = { thrust: 1, turn: 0, lift: 0 };

describe('manual flight', () => {
  it('accelerates smoothly toward top speed without overshooting', () => {
    const start = createShipState([0, 50, 0]);
    const speeds = [0.1, 0.5, 1, 3].map((t) => fly(start, forward, t, 1 / 60).speed);
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]).toBeGreaterThan(speeds[i - 1]);
    expect(speeds[0]).toBeLessThan(FLIGHT.maxSpeed * 0.25); // no instant jump to full speed
    expect(speeds[3]).toBeLessThanOrEqual(FLIGHT.maxSpeed);
    expect(speeds[3]).toBeGreaterThan(FLIGHT.maxSpeed * 0.9);
  });

  it('moves forward along -Z at heading 0', () => {
    const end = fly(createShipState([0, 50, 0]), forward, 2, 1 / 60);
    expect(end.position[2]).toBeLessThan(-20);
    expect(Math.abs(end.position[0])).toBeLessThan(1e-6);
  });

  it('feels the same at 30 fps and 144 fps', () => {
    const start = createShipState([0, 50, 0]);
    const input: FlightInput = { thrust: 1, turn: 0.5, lift: 0.3 };
    const slow = fly(start, input, 2, 1 / 30);
    const fast = fly(start, input, 2, 1 / 144);
    expect(Math.abs(slow.speed - fast.speed)).toBeLessThan(0.5);
    expect(Math.abs(wrapAngle(slow.yaw - fast.yaw))).toBeLessThan(0.05);
    const drift = Math.hypot(...slow.position.map((v, i) => v - fast.position[i]));
    expect(drift).toBeLessThan(2.5);
  });

  it('glides to a stop when the throttle is released', () => {
    const cruising = fly(createShipState([0, 50, 0]), forward, 3, 1 / 60);
    const coasting = fly(cruising, NO_INPUT, 0.5, 1 / 60);
    const stopped = fly(cruising, NO_INPUT, 6, 1 / 60);
    expect(coasting.speed).toBeLessThan(cruising.speed);
    expect(coasting.speed).toBeGreaterThan(cruising.speed * 0.2); // eases off, no hard stop
    expect(stopped.speed).toBeLessThan(1);
  });

  it('turns left on positive turn input and leans into the turn', () => {
    const turning = fly(createShipState([0, 50, 0]), { thrust: 1, turn: 1, lift: 0 }, 0.5, 1 / 60);
    expect(turning.yaw).toBeGreaterThan(0.2);
    expect(turning.bank).toBeLessThan(0);
  });

  it('glides up over rooftops instead of passing through them', () => {
    const rooftop: FlightEnvironment = { floorAt: (x) => (x > 10 ? 30 : 3), obstacles: [] };
    let s = createShipState([0, 5, 0], -Math.PI / 2); // facing +X
    let lowest = Infinity;
    for (let i = 0; i < 240; i++) {
      s = stepFlight(s, { thrust: 1, turn: 0, lift: -1 }, 1 / 60, rooftop);
      if (s.position[0] > 12) lowest = Math.min(lowest, s.position[1] - rooftop.floorAt(s.position[0], 0));
    }
    expect(s.position[0]).toBeGreaterThan(12);
    expect(lowest).toBeGreaterThanOrEqual(-1.5);
    expect(s.position[1]).toBeGreaterThan(29);
  });

  it('stays inside the world boundary and outside the tower', () => {
    const atEdge = createShipState([FLIGHT.boundaryRadius - 1, 50, 0], -Math.PI / 2);
    const pushed = fly(atEdge, forward, 2, 1 / 60);
    expect(Math.hypot(pushed.position[0], pushed.position[2])).toBeLessThanOrEqual(FLIGHT.boundaryRadius + 1e-6);

    const tower: FlightEnvironment = { floorAt: () => 0, obstacles: [{ x: 0, z: 0, radius: 10, height: 80 }] };
    const approaching = createShipState([0, 20, 30]); // heading 0 flies straight at the tower
    const end = fly(approaching, forward, 3, 1 / 60, tower);
    expect(Math.hypot(end.position[0], end.position[2])).toBeGreaterThanOrEqual(10 - 1e-6);
  });
});

describe('autopilot', () => {
  it('arrives at the parking spot facing the target', () => {
    const goal = { position: [40, 30, 60] as [number, number, number], lookAt: [40, 30, 0] as [number, number, number] };
    let s = createShipState([-120, 80, 200], 1.2);
    let arrived = false;
    let seconds = 0;
    while (!arrived && seconds < 20) {
      const step = stepAutopilot(s, goal, 1 / 60, openSpace);
      s = step.state;
      arrived = step.arrived;
      seconds += 1 / 60;
    }
    expect(arrived).toBe(true);
    expect(seconds).toBeLessThan(12);
    expect(Math.hypot(...s.position.map((v, i) => v - goal.position[i]))).toBeLessThan(0.75);
    expect(Math.abs(wrapAngle(s.yaw - yawToward(goal.position, goal.lookAt)))).toBeLessThan(0.06);
    expect(s.speed).toBe(0);
  });
});
