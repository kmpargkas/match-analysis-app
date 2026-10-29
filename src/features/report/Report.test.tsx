import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appRoutes } from '@/app/router';
import { RepositoryProvider, type Repositories } from '@/storage';
import { createTestRepositories } from '@/test/repositories';

let repos: Repositories;
let dispose: () => Promise<void>;

beforeEach(() => {
  ({ repos, dispose } = createTestRepositories());
});

afterEach(() => dispose());

const m = (min: number, s = 0) => min * 60 + s;

async function seedFinishedMatch({ initials = false, withEvents = true } = {}) {
  const team = await repos.teams.create({ name: 'Lions U14', nameDisplay: initials ? 'initials' : 'full' });
  const keeper = await repos.players.create({ teamId: team.id, name: 'Kostas Keeper', positions: ['GK'] });
  const striker = await repos.players.create({ teamId: team.id, name: 'Stelios Striker', positions: ['ST'] });
  const mid = await repos.players.create({ teamId: team.id, name: 'Manos Mid', positions: ['CM'] });
  const sub = await repos.players.create({ teamId: team.id, name: 'Sammy Sub', positions: ['ST'] });
  const unused = await repos.players.create({ teamId: team.id, name: 'Ulysses Unused', positions: ['CB'] });
  const match = await repos.matches.createWithLineup(
    { teamId: team.id, opponentName: 'Atromitos', date: '2026-10-12', competition: 'U14 League', formationId: '4-3-3', status: 'finished', score: { us: 2, them: 1 } },
    [
      { playerId: keeper.id, shirtNumber: 1, role: 'starter', positionSlotId: 'GK' },
      { playerId: striker.id, shirtNumber: 9, role: 'starter', positionSlotId: 'ST' },
      { playerId: mid.id, shirtNumber: 8, role: 'starter', positionSlotId: 'RCM' },
      { playerId: sub.id, shirtNumber: 14, role: 'sub' },
      { playerId: unused.id, shirtNumber: 15, role: 'sub' },
    ],
  );
  if (!withEvents) return match;

  const entries = await repos.lineups.listByMatch(match.id);
  const entry = (playerId: string) => entries.find((e) => e.playerId === playerId)!.id;
  const base = { matchId: match.id, attackDir: 'ltr' as const };
  const pass = { start: { x: 40, y: 50 }, end: { x: 55, y: 50 } };
  await repos.events.create({ ...base, typeId: 'pass', outcome: 'complete', videoTimeS: 10, clockS: 10, lineupEntryId: entry(mid.id), ...pass });
  await repos.events.create({ ...base, typeId: 'pass', outcome: 'complete', videoTimeS: 20, clockS: 20, lineupEntryId: entry(mid.id), ...pass });
  await repos.events.create({ ...base, typeId: 'pass', outcome: 'incomplete', videoTimeS: 30, clockS: 30, ...pass }); // no player
  await repos.events.create({
    ...base, typeId: 'shot', outcome: 'goal', videoTimeS: 50, clockS: m(33, 10), lineupEntryId: entry(striker.id), start: { x: 92, y: 50 }, attributes: { bodyPart: 'right' },
  });
  await repos.events.create({ ...base, typeId: 'tackle', outcome: 'won', videoTimeS: 70, clockS: m(50), lineupEntryId: entry(mid.id) }); // no location
  await repos.events.create({ ...base, typeId: 'substitution', videoTimeS: 80, clockS: m(60), lineupEntryId: entry(striker.id), relatedLineupEntryId: entry(sub.id) });

  await repos.clock.create({ matchId: match.id, videoTimeS: 0, clockS: 0, running: true });
  await repos.clock.create({ matchId: match.id, videoTimeS: 100, clockS: 100, running: false });
  await repos.possession.create({ matchId: match.id, videoTimeS: 0, team: 'us' });
  await repos.possession.create({ matchId: match.id, videoTimeS: 60, team: 'them' });
  return match;
}

function renderReport(matchId: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [`/matches/${matchId}/report`] });
  render(
    <RepositoryProvider repositories={repos}>
      <RouterProvider router={router} />
    </RepositoryProvider>,
  );
  return router;
}

describe('Match report', () => {
  it('shows the match header: teams, manual score, scorers and possession', async () => {
    const match = await seedFinishedMatch();
    renderReport(match.id);

    const header = await screen.findByRole('region', { name: 'Match' });
    expect(within(header).getByText('Lions U14')).toBeInTheDocument();
    expect(within(header).getByText('Atromitos')).toBeInTheDocument();
    expect(within(header).getByLabelText('Our goals')).toHaveTextContent('2');
    expect(within(header).getByLabelText('Opponent goals')).toHaveTextContent('1');
    expect(within(header).getByText("Striker 34'")).toBeInTheDocument();
    expect(within(header).getByText(/U14 League/)).toBeInTheDocument();
    // Us 0–60 s, them 60–100 s while the clock ran.
    expect(within(header).getByRole('meter', { name: 'Possession' })).toHaveAttribute('aria-valuenow', '60');
  });

  it('shows team totals per category with made/total and %, hiding categories with no events', async () => {
    const match = await seedFinishedMatch();
    renderReport(match.id);

    const passing = await screen.findByRole('region', { name: 'Passing' });
    const passes = within(passing).getByRole('row', { name: /^Passes/ });
    expect(passes).toHaveTextContent('2/3');
    expect(passes).toHaveTextContent('67%');
    const shooting = screen.getByRole('region', { name: 'Shooting' });
    expect(within(shooting).getByRole('row', { name: /^Goals/ })).toHaveTextContent('1');
    expect(screen.queryByRole('region', { name: 'Goalkeeping' })).not.toBeInTheDocument();
  });

  it('shows the formation with each starter in their slot, badges and ⚠, and only the subs who came on', async () => {
    const match = await seedFinishedMatch();
    renderReport(match.id);

    const formation = await screen.findByRole('region', { name: 'Formation' });
    const striker = within(formation).getByRole('button', { name: '#9 Stelios Striker' });
    expect(striker).toHaveTextContent('Striker');
    expect(within(striker).getByLabelText("Goal 34'")).toBeInTheDocument();
    expect(within(striker).getByLabelText("Subbed off 61'")).toBeInTheDocument();
    expect(within(within(formation).getByRole('button', { name: '#8 Manos Mid' })).getByLabelText('Has incomplete events')).toBeInTheDocument();

    const subs = within(formation).getByRole('list', { name: 'Subs who played' });
    expect(within(subs).getByRole('button', { name: '#14 Sammy Sub' })).toHaveTextContent("61'");
    expect(within(subs).queryByText(/Unused/)).not.toBeInTheDocument();
  });

  it('draws the shot map and a pass map with filters and a player filter', async () => {
    const match = await seedFinishedMatch();
    renderReport(match.id);
    const user = userEvent.setup();

    const shots = await screen.findByRole('region', { name: 'Shot map' });
    expect(within(shots).getByRole('img', { name: 'Shot map: 1 on target, 0 off target, 0 blocked' })).toBeInTheDocument();

    const passes = screen.getByRole('region', { name: 'Pass map' });
    expect(within(passes).getByRole('img', { name: 'Pass map: 2 accurate, 1 inaccurate' })).toBeInTheDocument();
    await user.click(within(passes).getByRole('button', { name: 'Failed' }));
    expect(within(passes).getByRole('button', { name: 'Failed' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(passes).getByRole('img', { name: 'Pass map: 0 accurate, 1 inaccurate' })).toBeInTheDocument();
    await user.click(within(passes).getByRole('button', { name: 'All' }));
    await user.selectOptions(within(passes).getByRole('combobox', { name: 'Player' }), 'Manos Mid');
    expect(within(passes).getByRole('img', { name: 'Pass map: 2 accurate, 0 inaccurate' })).toBeInTheDocument();
  });

  it('opens a player popup from the pitch: their stats, own maps and previous / next', async () => {
    const match = await seedFinishedMatch();
    renderReport(match.id);
    const user = userEvent.setup();

    const formation = await screen.findByRole('region', { name: 'Formation' });
    await user.click(within(formation).getByRole('button', { name: '#9 Stelios Striker' }));
    const dialog = await screen.findByRole('dialog', { name: '#9 Stelios Striker' });
    expect(dialog).toHaveTextContent('Starter · 60 minutes');
    expect(within(dialog).getByLabelText("Goal 34'")).toBeInTheDocument();
    expect(within(dialog).getByRole('row', { name: /^Goals/ })).toHaveTextContent('1');
    // Only rows with something in them.
    expect(within(dialog).queryByRole('row', { name: /^Passes/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: 'Shot map: 1 on target, 0 off target, 0 blocked' })).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: 'Pass map: 0 accurate, 0 inaccurate' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('combobox', { name: 'Player' })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Next player' }));
    const next = await screen.findByRole('dialog', { name: '#14 Sammy Sub' });
    expect(next).toHaveTextContent("Sub · 0 minutes");
    expect(within(next).getByRole('button', { name: 'Next player' })).toBeDisabled();
    await user.click(within(next).getByRole('button', { name: 'Previous player' }));
    expect(await screen.findByRole('dialog', { name: '#9 Stelios Striker' })).toBeInTheDocument();
  });

  it('lists the players who played in a sortable table; a row opens their popup', async () => {
    const match = await seedFinishedMatch();
    renderReport(match.id);
    const user = userEvent.setup();

    const table = await screen.findByRole('table', { name: 'Players' });
    const names = () => within(table).getAllByRole('row').slice(1).map((row) => within(row).getByRole('button').textContent);
    expect(names()).toEqual(['Kostas Keeper', 'Manos Mid', 'Stelios Striker', 'Sammy Sub']);

    await user.click(within(table).getByRole('button', { name: 'Passes' }));
    expect(names()).toEqual(['Manos Mid', 'Kostas Keeper', 'Stelios Striker', 'Sammy Sub']);
    expect(within(table).getByRole('columnheader', { name: 'Passes' })).toHaveAttribute('aria-sort', 'descending');
    await user.click(within(table).getByRole('button', { name: 'Passes' }));
    expect(names()).toEqual(['Kostas Keeper', 'Stelios Striker', 'Sammy Sub', 'Manos Mid']);
    expect(within(table).getByRole('columnheader', { name: 'Passes' })).toHaveAttribute('aria-sort', 'ascending');

    await user.click(within(table).getByRole('button', { name: 'Manos Mid' }));
    expect(await screen.findByRole('dialog', { name: '#8 Manos Mid' })).toBeInTheDocument();
  });

  it('warns about incomplete events and links to the collector to fix them', async () => {
    const match = await seedFinishedMatch();
    const router = renderReport(match.id);

    const banner = await screen.findByRole('status', { name: 'Incomplete events' });
    expect(banner).toHaveTextContent('Events still needing data: 2');
    expect(banner).toHaveTextContent('1 without a player');
    expect(banner).toHaveTextContent('1 without a location');
    await userEvent.click(within(banner).getByRole('link', { name: 'Fix in the collector' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/matches/${match.id}/collect`));
  });

  it('shows the score read-only (it is edited in the collector)', async () => {
    const match = await seedFinishedMatch();
    renderReport(match.id);

    const score = within(await screen.findByRole('region', { name: 'Match' })).getByRole('group', { name: 'Score' });
    expect(score).toHaveTextContent('2–1');
    expect(within(score).queryByRole('button')).not.toBeInTheDocument();
    expect(within(score).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it("respects the team's initials setting", async () => {
    const match = await seedFinishedMatch({ initials: true });
    renderReport(match.id);
    expect(await screen.findByText("S.S. 34'")).toBeInTheDocument();
    expect(screen.queryByText(/Striker/)).not.toBeInTheDocument();
  });

  it('exports the team PDF through the print dialog, with a Confidential footer and page numbers on every page', async () => {
    const match = await seedFinishedMatch();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    renderReport(match.id);

    await userEvent.click(await screen.findByRole('button', { name: 'Export PDF' }));
    expect(print).toHaveBeenCalledOnce();
    const css = document.querySelector('style[media="print"]')?.textContent ?? '';
    expect(css).toContain('"Confidential · Lions U14 vs Atromitos · Mon, 12 Oct 2026"');
    expect(css).toContain('counter(page)');
    expect(css).toContain('counter(pages)');
    print.mockRestore();
  });

  it('says so when nothing was logged', async () => {
    const match = await seedFinishedMatch({ withEvents: false });
    renderReport(match.id);
    expect(await screen.findByText('No events were logged for this match.')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Incomplete events' })).not.toBeInTheDocument();
  });

  it('handles a match that does not exist', async () => {
    renderReport('nope');
    expect(await screen.findByText('Match not found')).toBeInTheDocument();
  });
});
