import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRoutes } from '@/app/router';
import { RepositoryProvider, type Repositories } from '@/storage';
import { createTestRepositories } from '@/test/repositories';

let repos: Repositories;
let dispose: () => Promise<void>;

beforeEach(() => {
  ({ repos, dispose } = createTestRepositories());
});

afterEach(() => dispose());

const m = (min: number) => min * 60;

async function seed({ initials = false } = {}) {
  const team = await repos.teams.create({ name: 'Lions U14', nameDisplay: initials ? 'initials' : 'full' });
  const gio = await repos.players.create({ teamId: team.id, name: 'Giorgos Mid', positions: ['CM'] });
  const nikos = await repos.players.create({ teamId: team.id, name: 'Nikos Wing', positions: ['RW'] });

  const fullTime = async (matchId: string) => {
    await repos.clock.create({ matchId, videoTimeS: 0, clockS: 0, running: true });
    await repos.clock.create({ matchId, videoTimeS: m(90), clockS: m(90), running: false });
  };
  const entryOf = async (matchId: string, playerId: string) => (await repos.lineups.listByMatch(matchId)).find((e) => e.playerId === playerId)!.id;
  const base = (matchId: string) => ({ matchId, attackDir: 'ltr' as const });

  const atromitos = await repos.matches.createWithLineup(
    { teamId: team.id, opponentName: 'Atromitos', date: '2026-09-20', competition: 'U14 League', formationId: '4-3-3', status: 'finished', score: { us: 2, them: 1 } },
    [
      { playerId: gio.id, shirtNumber: 8, role: 'starter', positionSlotId: 'RCM' },
      { playerId: nikos.id, shirtNumber: 7, role: 'starter', positionSlotId: 'RW' },
    ],
  );
  await fullTime(atromitos.id);
  const gioA = await entryOf(atromitos.id, gio.id);
  const pass = { start: { x: 40, y: 50 }, end: { x: 55, y: 50 } };
  await repos.events.create({ ...base(atromitos.id), typeId: 'pass', outcome: 'complete', videoTimeS: 10, clockS: 10, lineupEntryId: gioA, ...pass });
  await repos.events.create({ ...base(atromitos.id), typeId: 'pass', outcome: 'incomplete', videoTimeS: 20, clockS: 20, lineupEntryId: gioA, ...pass });
  await repos.events.create({ ...base(atromitos.id), typeId: 'shot', outcome: 'goal', videoTimeS: m(33), clockS: m(33), lineupEntryId: gioA, start: { x: 90, y: 50 }, attributes: { bodyPart: 'right' } });

  const riverside = await repos.matches.createWithLineup(
    { teamId: team.id, opponentName: 'Riverside FC', date: '2026-10-04', homeAway: 'away', formationId: '4-3-3', score: { us: 0, them: 0 } },
    [
      { playerId: nikos.id, shirtNumber: 7, role: 'starter', positionSlotId: 'RW' },
      { playerId: gio.id, shirtNumber: 14, role: 'sub' },
    ],
  );
  await fullTime(riverside.id);
  await repos.events.create({
    ...base(riverside.id), typeId: 'substitution', videoTimeS: m(60), clockS: m(60), lineupEntryId: await entryOf(riverside.id, nikos.id), relatedLineupEntryId: await entryOf(riverside.id, gio.id),
  });
  await repos.events.create({ ...base(riverside.id), typeId: 'tackle', outcome: 'won', videoTimeS: m(70), clockS: m(70), lineupEntryId: await entryOf(riverside.id, gio.id) });

  const panionios = await repos.matches.createWithLineup(
    { teamId: team.id, opponentName: 'Panionios', date: '2026-10-11', formationId: '4-3-3', status: 'finished' },
    [
      { playerId: nikos.id, shirtNumber: 7, role: 'starter', positionSlotId: 'RW' },
      { playerId: gio.id, shirtNumber: 14, role: 'sub' },
    ],
  );
  await fullTime(panionios.id);

  const deleted = await repos.matches.createWithLineup({ teamId: team.id, opponentName: 'Deleted FC', date: '2026-10-18', formationId: '4-3-3' }, [
    { playerId: gio.id, shirtNumber: 8, role: 'starter', positionSlotId: 'RCM' },
  ]);
  await repos.matches.softDelete(deleted.id);

  return { team, gio, nikos };
}

function renderProfile(teamId: string, playerId: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [`/squads/${teamId}/players/${playerId}`] });
  render(
    <RepositoryProvider repositories={repos}>
      <RouterProvider router={router} />
    </RepositoryProvider>,
  );
  return router;
}

const rows = async () => {
  const section = await screen.findByRole('region', { name: 'Matches' });
  return within(section).getAllByRole('row').slice(1);
};

describe('Player profile', () => {
  it("lists the player's matches newest first, with role, minutes and badges", async () => {
    const { team, gio } = await seed();
    renderProfile(team.id, gio.id);

    expect(await screen.findByRole('heading', { level: 1, name: 'Giorgos Mid' })).toBeInTheDocument();
    const [panionios, riverside, atromitos, ...rest] = await rows();
    expect(rest).toEqual([]);

    expect(panionios).toHaveTextContent('Panionios');
    expect(panionios).toHaveTextContent('Unused sub');
    expect(within(panionios!).queryByRole('button', { name: /see match report/i })).not.toBeInTheDocument();

    expect(riverside).toHaveTextContent('Riverside FC');
    expect(riverside).toHaveTextContent('In progress');
    expect(riverside).toHaveTextContent('Away');
    expect(riverside).toHaveTextContent('Came on');
    expect(riverside).toHaveTextContent("30'");
    expect(within(riverside!).getByRole('img', { name: "Came on 61'" })).toBeInTheDocument();

    expect(atromitos).toHaveTextContent('U14 League');
    expect(atromitos).toHaveTextContent('Started');
    expect(atromitos).toHaveTextContent("90'");
    expect(atromitos).toHaveTextContent('2–1');
    expect(within(atromitos!).getByRole('img', { name: "Goal 34'" })).toBeInTheDocument();
  });

  it("opens the match report's player popup and steps through the matches played", async () => {
    const { team, gio } = await seed();
    renderProfile(team.id, gio.id);
    const user = userEvent.setup();

    const atromitos = (await rows())[2]!;
    await user.click(within(atromitos).getByRole('button', { name: /see match report/i }));

    const dialog = await screen.findByRole('dialog', { name: '#8 Giorgos Mid' });
    expect(dialog).toHaveTextContent('vs Atromitos · Sun, 20 Sept 2026');
    expect(dialog).toHaveTextContent('90 minutes');
    const passes = within(dialog).getByRole('row', { name: /^Passes/ });
    expect(passes).toHaveTextContent('1/2');
    expect(passes).toHaveTextContent('50%');
    expect(within(dialog).getByRole('button', { name: 'Previous match' })).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: 'Next match' }));
    const next = await screen.findByRole('dialog', { name: '#14 Giorgos Mid' });
    expect(next).toHaveTextContent('vs Riverside FC');
    expect(next).toHaveTextContent('30 minutes');
    expect(within(next).getByRole('row', { name: /^Tackles/ })).toHaveTextContent('1/1');
    // The unused-sub match is skipped: Riverside is the latest match played.
    expect(within(next).getByRole('button', { name: 'Next match' })).toBeDisabled();
  });

  it('respects the initials setting', async () => {
    const { team, gio } = await seed({ initials: true });
    renderProfile(team.id, gio.id);
    expect(await screen.findByRole('heading', { level: 1, name: 'G.M.' })).toBeInTheDocument();
  });

  it('says so when the player has no matches yet', async () => {
    const team = await repos.teams.create({ name: 'Lions U14' });
    const rookie = await repos.players.create({ teamId: team.id, name: 'Rookie Player', positions: ['ST'] });
    renderProfile(team.id, rookie.id);
    expect(await screen.findByText('This player hasn’t been in a matchday squad yet.')).toBeInTheDocument();
  });

  it('shows not found for a player of another team', async () => {
    const { gio } = await seed();
    const other = await repos.teams.create({ name: 'Eagles U16' });
    renderProfile(other.id, gio.id);
    expect(await screen.findByRole('heading', { name: 'Player not found' })).toBeInTheDocument();
  });
});
