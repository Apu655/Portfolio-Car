import { act, fireEvent, render, screen } from '@testing-library/react';
import { touchInput } from '../world/drive/input';
import { telemetry } from '../world/events';
import { BoostGauge } from './BoostGauge';
import { TouchControls } from './TouchControls';

describe('touch boost button', () => {
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
