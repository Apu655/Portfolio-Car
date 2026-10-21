import { act, render, screen } from '@testing-library/react';
import { papers } from '../content/portfolio';
import { usePortfolio } from '../state/store';
import { zoneFor } from '../world/district/layout';
import { useRoadsideCaption } from '../world/roadsideCaptions';
import { RobotBubble } from './RobotBubble';

const PAPER = papers.find((p) => p.id === zoneFor('research').itemId)!;

describe("the robot's bubble after a bump", () => {
  afterEach(() => {
    act(() => {
      useRoadsideCaption.setState({ bubble: false, quip: null });
      usePortfolio.setState({ panelOpen: false });
    });
  });

  it('swaps the greeting for the quip and keeps the way into the paper', () => {
    act(() => useRoadsideCaption.setState({ bubble: true, quip: "Ow! I'm a robot, not a speed bump!" }));
    render(<RobotBubble />);
    expect(screen.getByText("Ow! I'm a robot, not a speed bump!")).toBeTruthy();
    expect(screen.queryByText("Hi! I'm the SeCAREly assistant.")).toBeNull();
    expect(screen.getByText(PAPER.title).closest('button')).toBeTruthy();
  });

  it('greets as usual once the quip clears', () => {
    act(() => useRoadsideCaption.setState({ bubble: true, quip: null }));
    render(<RobotBubble />);
    expect(screen.getByText("Hi! I'm the SeCAREly assistant.")).toBeTruthy();
  });

  it('stays out of the way while an info panel is open', () => {
    act(() => {
      useRoadsideCaption.setState({ bubble: true, quip: 'Beep boop' });
      usePortfolio.setState({ panelOpen: true });
    });
    render(<RobotBubble />);
    expect(screen.queryByText('Beep boop')).toBeNull();
  });
});
