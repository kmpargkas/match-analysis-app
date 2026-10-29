import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { appRoutes } from '@/app/router';
import { RepositoryProvider, type Repositories } from '@/storage';
import { createTestRepositories } from '@/test/repositories';
import { useCollector } from './store';

const downloads = vi.hoisted(() => [] as { name: string; text: string }[]);
vi.mock('@/platform/textFile', () => ({
  downloadTextFile: (name: string, text: string) => downloads.push({ name, text }),
  readLastBackupAt: () => null,
  writeLastBackupAt: () => undefined,
}));

const wall = vi.hoisted(() => ({ ms: 0 }));
vi.mock('./wallClock', () => ({ nowMs: () => wall.ms }));

let repos: Repositories;
let dispose: () => Promise<void>;

// The minimap's SVG is 111 × 74 units with 3 units of padding, so client x 3 + 52.5 is the halfway line.
beforeAll(() => {
  SVGElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 111, height: 74, right: 111, bottom: 74, x: 0, y: 0, toJSON: () => ({}) });
});

beforeEach(() => {
  ({ repos, dispose } = createTestRepositories());
  wall.ms = 0;
});

afterEach(() => dispose());

const SQUAD: [string, string[]][] = [
  ['Kostas Keeper', ['GK']],
  ['Rafa Right', ['RB']],
  ['Chris Centre', ['CB']],
  ['Leo Centre', ['CB']],
  ['Lefteris Left', ['LB']],
  ['Dimitris Holder', ['DM']],
  ['Manos Mid', ['CM']],
  ['Giorgos Papadopoulos', ['CM']],
  ['Ronaldo Wing', ['RW']],
  ['Stelios Striker', ['ST']],
  ['Lampros Wing', ['LW']],
  ['Spare Mid', ['CM']],
];
const SLOTS = ['GK', 'RB', 'RCB', 'LCB', 'LB', 'DM', 'RCM', 'LCM', 'RW', 'ST', 'LW'];

async function seedMatch() {
  const team = await repos.teams.create({ name: 'Lions U14' });
  const players = [];
  for (const [name, positions] of SQUAD) players.push(await repos.players.create({ teamId: team.id, name, positions }));
  const lineup = players.map((p, i) =>
    i < 11 ? { playerId: p.id, shirtNumber: i + 1, role: 'starter' as const, positionSlotId: SLOTS[i] } : { playerId: p.id, shirtNumber: 12 + i - 11, role: 'sub' as const },
  );
  return repos.matches.createWithLineup({ teamId: team.id, opponentName: 'Atromitos', date: '2026-10-04', formationId: '4-3-3' }, lineup);
}

async function renderCollector(matchId: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [`/matches/${matchId}/collect`] });
  render(
    <RepositoryProvider repositories={repos}>
      <RouterProvider router={router} />
    </RepositoryProvider>,
  );
  await screen.findByRole('group', { name: 'Match clock' });
  return router;
}

/** Moves real time to `seconds` after the collector opened and waits until the collector has picked it up. */
async function at(seconds: number) {
  wall.ms = seconds * 1000;
  await waitFor(() => expect(useCollector.getState().timeS).toBeGreaterThanOrEqual(seconds));
}

const clockText = () => {
  const clock = screen.getByRole('group', { name: 'Match clock' });
  return `${within(clock).getByRole('button', { name: 'Clock minutes' }).textContent}:${within(clock).getByRole('button', { name: 'Clock seconds' }).textContent}`;
};

const surface = () => screen.getByTestId('minimap-surface');
/** Presses at one point on the minimap and releases at another (same point = a click). Coordinates are 0–100. */
function pressMinimap(from: { x: number; y: number }, to = from) {
  const client = (p: { x: number; y: number }) => ({ clientX: 3 + (p.x / 100) * 105, clientY: 3 + (p.y / 100) * 68 });
  fireEvent.pointerDown(surface(), client(from));
  fireEvent.pointerUp(surface(), client(to));
}

describe('Collector clock', () => {
  it('plays and pauses with its button, runs in real time, and keeps running after typed minutes', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    await renderCollector(match.id);
    expect(clockText()).toBe('00:00');

    await at(10);
    await user.click(screen.getByRole('button', { name: 'Start the clock' }));
    await at(75);
    await waitFor(() => expect(clockText()).toBe('01:05'));

    await user.click(screen.getByRole('button', { name: 'Clock minutes' }));
    await user.keyboard('45{Enter}');
    await waitFor(() => expect(clockText()).toBe('45:05'));
    await at(80);
    await waitFor(() => expect(clockText()).toBe('45:10'));

    await user.click(screen.getByRole('button', { name: 'Pause the clock' }));
    await at(200);
    expect(clockText()).toBe('45:10');
  });

  it('toggles the clock with K, but not while typing', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    await renderCollector(match.id);

    await user.keyboard('k');
    expect(await screen.findByRole('button', { name: 'Pause the clock' })).toBeInTheDocument();
    await user.keyboard('K');
    expect(await screen.findByRole('button', { name: 'Start the clock' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clock minutes' }));
    await user.keyboard('k');
    expect(screen.getByRole('button', { name: 'Start the clock' })).toBeInTheDocument();
  });

  it('pauses a running clock when the collector is left', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    const router = await renderCollector(match.id);
    await user.click(screen.getByRole('button', { name: 'Start the clock' }));
    await at(30);

    await user.click(screen.getByRole('button', { name: 'Match menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Back to Home' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    await waitFor(async () => {
      const anchors = (await repos.clock.listByMatch(match.id)).sort((a, b) => a.videoTimeS - b.videoTimeS);
      expect(anchors.map((a) => [a.videoTimeS, a.clockS, a.running])).toEqual([
        [0, 0, true],
        [30, 30, false],
      ]);
    });
  });

  it('carries the timeline on from the latest record when the match is reopened', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    await repos.clock.create({ matchId: match.id, videoTimeS: 400, clockS: 600, running: true });
    await repos.clock.create({ matchId: match.id, videoTimeS: 500, clockS: 700, running: false });
    await renderCollector(match.id);
    expect(clockText()).toBe('11:40');

    await user.click(screen.getByRole('button', { name: 'Recovery' }));
    await waitFor(async () => expect((await repos.events.listByMatch(match.id))[0]).toMatchObject({ videoTimeS: 500, clockS: 700 }));
  });

  it('starts the 2nd half from the menu with the clock stopped at 45:00', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    await renderCollector(match.id);
    await user.click(screen.getByRole('button', { name: 'Start the clock' }));
    await at(2830);

    await user.click(screen.getByRole('button', { name: 'Match menu' }));
    expect(await screen.findByRole('menuitemradio', { name: '1st half' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('menuitemradio', { name: '2nd half' }));
    await waitFor(() => expect(clockText()).toBe('45:00'));
    expect(screen.getByRole('button', { name: 'Start the clock' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Match clock' })).getByText('2nd half')).toBeInTheDocument();
    expect((await repos.matches.get(match.id))?.half).toBe(2);

    await user.click(screen.getByRole('button', { name: 'Recovery' }));
    const card = await screen.findByRole('article', { name: '45:00 Recovery' });
    expect(within(card).getByText('2H')).toBeInTheDocument();
    await waitFor(async () => expect((await repos.events.listByMatch(match.id))[0]).toMatchObject({ clockS: 2700, half: 2 }));
  });
});

describe('Logging an event', () => {
  it('saves on click at the clock time, maps a pass by dragging, then assigns the player through the search', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    await renderCollector(match.id);
    await user.click(screen.getByRole('button', { name: 'Start the clock' }));
    await at(30);

    await user.click(screen.getByRole('button', { name: 'Pass ✓' }));
    const card = await screen.findByRole('article', { name: '00:30 Pass ✓' });
    expect(within(card).getByLabelText(/^Missing: player, location/)).toBeInTheDocument();
    expect(screen.getByText('Map the event')).toBeInTheDocument();

    pressMinimap({ x: 30, y: 40 }, { x: 70, y: 20 });

    // The player search opens by itself once the location is set.
    const search = await screen.findByRole('textbox', { name: 'Number or name' });
    await user.type(search, '8{Enter}');

    await waitFor(async () => {
      const [event] = await repos.events.listByMatch(match.id);
      expect(event).toMatchObject({ typeId: 'pass', outcome: 'complete', clockS: 30, half: 1, start: { x: 30, y: 40 }, end: { x: 70, y: 20 }, attackDir: 'ltr' });
    });
    expect(await within(card).findByRole('button', { name: /Player: #8 Giorgos Papadopoulos/ })).toBeInTheDocument();
    expect(within(card).queryByLabelText(/^Missing/)).not.toBeInTheDocument();
  });

  it('puts a new event at the top of the log even when its time is earlier', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    await renderCollector(match.id);
    await user.click(screen.getByRole('button', { name: 'Recovery' }));
    const recovery = await screen.findByRole('article', { name: /Recovery/ });
    await user.keyboard('{Escape}');
    await user.click(within(recovery).getByRole('button', { name: 'Edit event time' }));
    await user.keyboard('20{Enter}');
    await screen.findByRole('article', { name: '20:00 Recovery' });

    await user.click(screen.getByRole('button', { name: 'Interception' }));
    await screen.findByRole('article', { name: /Interception/ });
    const log = screen.getByRole('region', { name: 'Events' });
    expect(within(log).getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['00:00 Interception', '20:00 Recovery']);
  });

  it('finds players by name and lists those on the pitch first', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    await renderCollector(match.id);

    await user.click(screen.getByRole('button', { name: 'Interception' }));
    await screen.findByText('Map the event');
    pressMinimap({ x: 50, y: 50 });
    const search = await screen.findByRole('textbox', { name: 'Number or name' });
    const list = screen.getByRole('listbox');
    expect(within(list).getAllByRole('option')).toHaveLength(12);
    expect(within(list).getAllByRole('option').at(-1)).toHaveTextContent('Spare Mid');

    await user.type(search, 'papad');
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['8Giorgos Papadopoulos']);
  });

  it('stores locations mirrored while we attack right → left', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    await renderCollector(match.id);

    await user.click(screen.getByRole('button', { name: /Change sides\. We attack left to right/ }));
    await waitFor(async () => expect((await repos.matches.get(match.id))?.attackDir).toBe('rtl'));

    await user.click(screen.getByRole('button', { name: 'Tackle ✓' }));
    await screen.findByText('Map the event');
    pressMinimap({ x: 10, y: 30 });
    await waitFor(async () => expect((await repos.events.listByMatch(match.id))[0]).toMatchObject({ start: { x: 90, y: 70 }, attackDir: 'rtl' }));
  });

  it('sets required attributes in the card and deletes after confirmation', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    await renderCollector(match.id);

    await user.click(screen.getByRole('button', { name: 'Saved' }));
    const card = await screen.findByRole('article', { name: /Saved/ });
    await user.keyboard('{Escape}');
    await user.click(within(within(card).getByRole('group', { name: 'Body part' })).getByRole('button', { name: 'Head' }));
    await waitFor(async () => expect((await repos.events.listByMatch(match.id))[0]?.attributes).toEqual({ bodyPart: 'head' }));

    await user.click(within(card).getByRole('button', { name: 'Edit event time' }));
    const time = within(card).getByRole('group', { name: 'Event time' });
    expect(time).toHaveTextContent(':');
    const minutes = within(time).getByRole('textbox', { name: 'Minutes' });
    await user.clear(minutes);
    await user.type(minutes, '12');
    const seconds = within(time).getByRole('textbox', { name: 'Seconds' });
    await user.clear(seconds);
    await user.type(seconds, '34{Enter}');
    await waitFor(async () => expect((await repos.events.listByMatch(match.id))[0]?.clockS).toBe(754));

    await user.click(within(card).getByRole('button', { name: 'Delete event' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect(await repos.events.listByMatch(match.id)).toEqual([]));
  });
});

describe('Action shortcuts', () => {
  /** Waits for `count` events and returns their type and outcome, oldest first. */
  const logged = async (matchId: string, count: number) => {
    let events: Awaited<ReturnType<typeof repos.events.listByMatch>> = [];
    await waitFor(async () => {
      events = await repos.events.listByMatch(matchId);
      expect(events).toHaveLength(count);
    });
    return [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((e) => [e.typeId, e.outcome]);
  };

  it('logs the successful action with the key alone and the unsuccessful one with Shift', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    await renderCollector(match.id);
    await at(30);

    await user.keyboard('p{Shift>}p{/Shift}c{Shift>}c{/Shift}d{Shift>}d{/Shift}t{Shift>}t{/Shift}g{Shift>}g{/Shift}a{Shift>}a{/Shift}');
    expect(await logged(match.id, 12)).toEqual([
      ['pass', 'complete'],
      ['pass', 'incomplete'],
      ['cross', 'complete'],
      ['cross', 'incomplete'],
      ['dribble', 'success'],
      ['dribble', 'fail'],
      ['tackle', 'won'],
      ['tackle', 'lost'],
      ['duel_ground', 'won'],
      ['duel_ground', 'lost'],
      ['duel_aerial', 'won'],
      ['duel_aerial', 'lost'],
    ]);
  });

  it('logs an interception with I, a recovery with R and a block with B; with Shift they log nothing', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    await renderCollector(match.id);
    await at(30);

    await user.keyboard('{Shift>}irb{/Shift}');
    await user.keyboard('irb');
    expect(await logged(match.id, 3)).toEqual([
      ['interception', undefined],
      ['recovery', undefined],
      ['block', undefined],
    ]);
  });

  it('does not fire while typing in a field', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    await renderCollector(match.id);
    await at(30);

    await user.click(screen.getByRole('button', { name: 'Pass ✓' }));
    const card = await screen.findByRole('article', { name: /Pass ✓/ });
    await user.click(within(card).getByRole('button', { name: /^Player:/ }));
    await user.type(await screen.findByRole('textbox', { name: 'Number or name' }), 'pcdtirbga');
    await user.click(screen.getByRole('button', { name: 'Clock minutes' }));
    await user.keyboard('p');
    expect(await logged(match.id, 1)).toEqual([['pass', 'complete']]);
  });

  it('shows the key hints on split ✓/✗ controls', async () => {
    const match = await seedMatch();
    await renderCollector(match.id);
    const passing = await screen.findByRole('group', { name: 'Passing' });
    expect(within(passing).getByRole('button', { name: 'Pass ✓' })).toHaveAttribute('aria-keyshortcuts', 'P');
    expect(within(passing).getByRole('button', { name: 'Pass ✗' })).toHaveAttribute('aria-keyshortcuts', 'Shift+P');
    expect(within(passing).getByRole('button', { name: 'Cross ✗' })).toHaveAttribute('aria-keyshortcuts', 'Shift+C');
    expect(screen.getByRole('button', { name: 'Interception' })).toHaveAttribute('aria-keyshortcuts', 'I');
    expect(screen.getByRole('button', { name: 'Recovery' })).toHaveAttribute('aria-keyshortcuts', 'R');
    expect(screen.getByRole('button', { name: 'Block' })).toHaveAttribute('aria-keyshortcuts', 'B');
    expect(screen.getByRole('button', { name: 'Clearance' })).not.toHaveAttribute('aria-keyshortcuts');

    await userEvent.keyboard('p');
    expect(await logged(match.id, 1)).toEqual([['pass', 'complete']]);
  });
});

describe('Possession, score and finishing', () => {
  it('changes possession with one button, the first change going to us, and shows no share', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    await renderCollector(match.id);
    const toggle = () => screen.getByRole('button', { name: /^Change possession\./ });
    expect(toggle()).toHaveAccessibleName('Change possession. Possession: Not set yet');

    await at(12);
    await user.click(toggle());
    await waitFor(() => expect(toggle()).toHaveAccessibleName('Change possession. Possession: Lions U14'));
    await at(20);
    await user.click(toggle());
    await waitFor(() => expect(toggle()).toHaveAccessibleName('Change possession. Possession: Opponent'));
    await waitFor(async () => {
      const changes = await repos.possession.listByMatch(match.id);
      expect(changes.map((c) => [c.videoTimeS, c.team]).sort()).toEqual([
        [12, 'us'],
        [20, 'them'],
      ]);
    });
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('edits the score by hand', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    await renderCollector(match.id);
    await user.click(screen.getByRole('button', { name: 'Add a goal: Our goals' }));
    await user.click(screen.getByRole('button', { name: 'Opponent goals' }));
    await user.keyboard('3{Enter}');
    await waitFor(async () => expect((await repos.matches.get(match.id))?.score).toEqual({ us: 1, them: 3 }));
  });

  it('exports this match as JSON from the ☰ menu', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    await renderCollector(match.id);

    await user.click(screen.getByRole('button', { name: 'Match menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Export JSON' }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]!.name).toBe('match-lions-u14-vs-atromitos-2026-10-04.json');
    expect(JSON.parse(downloads[0]!.text).lineupEntries).toHaveLength(12);
  });

  it('lists incomplete events before finishing the match', async () => {
    const user = userEvent.setup();
    const match = await seedMatch();
    const router = await renderCollector(match.id);
    await user.click(screen.getByRole('button', { name: 'Recovery' }));
    await screen.findByRole('article', { name: /Recovery/ });

    await user.click(screen.getByRole('button', { name: 'Finish match' }));
    const dialog = await screen.findByRole('dialog', { name: 'Finish this match?' });
    expect(within(dialog).getByText('1 events still need data. Click one to fix it, or finish anyway.')).toBeInTheDocument();
    expect(within(dialog).getByText('player, location')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Finish match' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect((await repos.matches.get(match.id))?.status).toBe('finished');
  });
});
