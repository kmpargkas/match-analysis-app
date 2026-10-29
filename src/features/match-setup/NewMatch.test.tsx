import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRoutes } from '@/app/router';
import type { Team } from '@/domain/schemas';
import { RepositoryProvider, type Repositories } from '@/storage';
import { createTestRepositories } from '@/test/repositories';

let repos: Repositories;
let dispose: () => Promise<void>;

beforeEach(() => {
  ({ repos, dispose } = createTestRepositories());
});

afterEach(() => dispose());

function renderApp(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(
    <RepositoryProvider repositories={repos}>
      <RouterProvider router={router} />
    </RepositoryProvider>,
  );
  return router;
}

/** A 14-player squad shaped for a 4-3-3, plus a spare keeper, midfielder and striker. */
const SQUAD: [string, string[]][] = [
  ['Kostas Keeper', ['GK']],
  ['Rafa Right', ['RB']],
  ['Chris Centre', ['CB']],
  ['Leo Centre', ['CB', 'DM']],
  ['Lefteris Left', ['LB']],
  ['Dimitris Holder', ['DM']],
  ['Manos Mid', ['CM']],
  ['Nikos Mid', ['CM', 'AM']],
  ['Ronaldo Wing', ['RW']],
  ['Stelios Striker', ['ST']],
  ['Lampros Wing', ['LW']],
  ['Spare Keeper', ['GK']],
  ['Spare Mid', ['CM']],
  ['Spare Striker', ['ST']],
];

async function seedTeam(): Promise<Team> {
  const team = await repos.teams.create({ name: 'Lions U14', coachName: 'A. Coach' });
  for (const [name, positions] of SQUAD) await repos.players.create({ teamId: team.id, name, positions });
  return team;
}

const start = () => screen.getByRole('button', { name: 'Start collecting' });

async function pickTeamAndInfo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Pick Lions U14' }));
  await user.type(await screen.findByLabelText('Opponent'), 'Atromitos');
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-04' } });
}

/** Picks the first `count` squad players (in SQUAD order) and numbers them 1, 2, 3… */
async function pickSquad(user: ReturnType<typeof userEvent.setup>, count: number) {
  for (const [i, [name]] of SQUAD.slice(0, count).entries()) {
    await user.click(screen.getByRole('checkbox', { name }));
    await user.type(screen.getByLabelText(`Shirt number for ${name}`), String(i + 1));
  }
}

describe('New match', () => {
  it('asks for the team first', async () => {
    await seedTeam();
    renderApp('/matches/new');
    expect(await screen.findByRole('button', { name: 'Pick Lions U14' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Opponent')).not.toBeInTheDocument();
    expect(start()).toBeDisabled();
  });

  // Many clicks through the whole page; the default 5 s is too tight when the full suite runs in parallel.
  it('sets up a 4-3-3 click by click and opens the collector', { timeout: 15_000 }, async () => {
    const user = userEvent.setup();
    const team = await seedTeam();
    const router = renderApp('/matches/new');

    await pickTeamAndInfo(user);
    // 13 of 14 players: not everyone has to be in the matchday squad.
    await pickSquad(user, 13);
    expect(screen.getByText('13 picked')).toBeInTheDocument();
    expect(start()).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Formation'), '4-3-3');
    // The widget moves to the next empty position after each pick, so the
    // first 11 players can be placed in formation order.
    await user.click(screen.getByRole('button', { name: 'GK' }));
    for (const [name] of SQUAD.slice(0, 11)) {
      const widget = screen.getByRole('region', { name: /^[A-Z]+ · / });
      await user.click(within(widget).getByRole('button', { name: new RegExp(name) }));
    }

    expect(screen.getByText('11 / 11 placed')).toBeInTheDocument();
    const bench = screen.getByRole('list', { name: 'Subs' });
    expect(within(bench).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('Spare Keeper'),
      expect.stringContaining('Spare Mid'),
    ]);
    expect(screen.getByText('Ready to start')).toBeInTheDocument();

    await user.click(start());
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/matches\/[0-9a-f-]{36}\/collect$/));

    const [match] = await repos.matches.list();
    expect(match).toMatchObject({ teamId: team.id, opponentName: 'Atromitos', date: '2026-10-04', formationId: '4-3-3', coachName: 'A. Coach', halfLengthMin: 45, status: 'in_progress' });
    const lineup = await repos.lineups.listByMatch(match!.id);
    expect(lineup.filter((e) => e.role === 'starter')).toHaveLength(11);
    expect(lineup.filter((e) => e.role === 'sub').map((e) => e.shirtNumber)).toEqual([12, 13]);
    expect(lineup.find((e) => e.positionSlotId === 'GK')?.shirtNumber).toBe(1);
  });

  it('lists natural fits for a position first, then the other unplaced players', async () => {
    const user = userEvent.setup();
    await seedTeam();
    renderApp('/matches/new');
    await pickTeamAndInfo(user);
    await pickSquad(user, 14);
    await user.selectOptions(screen.getByLabelText('Formation'), '4-3-3');

    await user.click(screen.getByRole('button', { name: 'RCB' }));
    const widget = screen.getByRole('region', { name: 'RCB · Centre back' });
    const fits = within(within(widget).getByRole('group', { name: 'Natural fits' })).getAllByRole('button');
    expect(fits.map((b) => b.textContent)).toEqual([expect.stringContaining('Chris Centre'), expect.stringContaining('Leo Centre')]);
    expect(within(within(widget).getByRole('group', { name: 'Other players' })).getAllByRole('button')).toHaveLength(12);

    await user.type(within(widget).getByLabelText('Search by number or name'), '14');
    expect(within(widget).getAllByRole('button', { name: /Spare Striker/ })).toHaveLength(1);
    expect(within(widget).queryByRole('button', { name: /Chris Centre/ })).not.toBeInTheDocument();
  });

  it('blocks the start while a shirt number is used twice', async () => {
    const user = userEvent.setup();
    await seedTeam();
    renderApp('/matches/new');
    await pickTeamAndInfo(user);
    await pickSquad(user, 2);
    const second = screen.getByLabelText('Shirt number for Rafa Right');
    await user.clear(second);
    await user.type(second, '1');

    expect(screen.getAllByText('Number used twice')).toHaveLength(2);
    expect(screen.getByText(/A shirt number is used twice/)).toBeInTheDocument();
    expect(start()).toBeDisabled();
  });

  it('pre-selects the team from the link and fills in its coach', async () => {
    const team = await seedTeam();
    renderApp(`/matches/new?team=${team.id}`);
    expect(await screen.findByLabelText('Opponent')).toBeInTheDocument();
    expect(screen.getByLabelText(/Coach/)).toHaveValue('A. Coach');
  });
});
