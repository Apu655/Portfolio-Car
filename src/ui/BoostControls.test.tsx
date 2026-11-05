import { act, fireEvent, render, screen } from '@testing-library/react';
import { touchActions, touchInput } from '../world/drive/input';
import { telemetry } from '../world/events';
import { usePlayer } from '../world/player';
import { BoostGauge } from './BoostGauge';
import { TouchControls } from './TouchControls';

describe('touch boost button', () => {
  beforeEach(() => act(() => usePlayer.setState({ mode: 'driving', nearCar: false })));
  afterEach(() => {
    touchInput.boost = false;
  });

  it('boosts while pressed and stops on release', () => {
    render(<TouchControls />);
    const button = screen.getByRole('button', { name: 'Boost' });
    fireEvent.pointerDown(button);
    expect(touchInput.boost).toBe(true);
    fireEvent.pointerUp(button);
    expect(touchInput.boost).toBe(false);
  });

  it('stops when the press is cancelled or the controls go away', () => {
    const { unmount } = render(<TouchControls />);
    const button = screen.getByRole('button', { name: 'Boost' });
    fireEvent.pointerDown(button);
    fireEvent.pointerCancel(button);
    expect(touchInput.boost).toBe(false);
    fireEvent.pointerDown(button);
    unmount();
    expect(touchInput.boost).toBe(false);
  });
});

describe('touch controls on foot', () => {
  afterEach(() => {
    touchInput.boost = false;
    touchActions.car = false;
    act(() => usePlayer.setState({ mode: 'foot', nearCar: false }));
  });

  it('shows Get in only within reach of the car, and Get out only while driving', () => {
    act(() => usePlayer.setState({ mode: 'foot', nearCar: false }));
    render(<TouchControls />);
    expect(screen.queryByRole('button', { name: 'Get in' })).toBeNull();
    act(() => usePlayer.setState({ nearCar: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Get in' }));
    expect(touchActions.car).toBe(true);
    expect(screen.queryByRole('button', { name: 'Get out' })).toBeNull();
    act(() => usePlayer.setState({ mode: 'driving', nearCar: false }));
    expect(screen.queryByRole('button', { name: 'Get in' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Get out' })).toBeTruthy();
    // Mid-stop, neither: the car is already letting them out.
    act(() => usePlayer.setState({ mode: 'stopping' }));
    expect(screen.queryByRole('button', { name: /Get (in|out)/ })).toBeNull();
  });

  it('on foot the Boost button is Run, and the car buttons are hidden', () => {
    act(() => usePlayer.setState({ mode: 'foot', nearCar: false }));
    render(<TouchControls />);
    expect(screen.queryByRole('button', { name: 'Boost' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Brake' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Recover' })).toBeNull();
    const run = screen.getByRole('button', { name: 'Run' });
    fireEvent.pointerDown(run);
    expect(touchInput.boost).toBe(true);
    fireEvent.pointerUp(run);
    expect(touchInput.boost).toBe(false);
  });
});

describe('boost gauge', () => {
  const frame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

  afterEach(() => {
    Object.assign(telemetry, { boost: 1, boosting: false, boostLocked: false });
  });

  it('shows how full the tank is', async () => {
    render(<BoostGauge />);
    Object.assign(telemetry, { boost: 0.4, boosting: true });
    await frame();
    const meter = screen.getByRole('meter', { name: 'Nitro' });
    expect(meter.getAttribute('aria-valuenow')).toBe('40');
    expect(meter.className).toContain('is-boosting');
  });

  it('looks locked out after running dry', async () => {
    render(<BoostGauge />);
    Object.assign(telemetry, { boost: 0.1, boostLocked: true });
    await frame();
    expect(screen.getByRole('meter', { name: 'Nitro' }).className).toContain('is-locked');
  });
});
