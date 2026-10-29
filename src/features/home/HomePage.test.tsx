import { render, screen, waitFor, within } from '@testing-library/react';
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

function renderApp(path = '/') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(
    <RepositoryProvider repositories={repos}>
      <RouterProvider router={router} />
    </RepositoryProvider>,
  );
  return router;
}

async function seedTwoMatches() {
  const team = await repos.teams.create({ name: 'Lions U14' });
  const live = await repos.matches.create({ teamId: team.id, opponentName: 'Riverside FC', date: '2026-10-04', formationId: '4-3-3', score: { us: 1, them: 0 } });
  const done = await repos.matches.create({ teamId: team.id, opponentName: 'Harbour United', date: '2026-09-20', formationId: '4-3-3', status: 'finished', competition: 'Friendly' });
  const base = { matchId: live.id, outcome: 'won', videoTimeS: 5, clockS: 5, attackDir: 'ltr' as const, start: { x: 50, y: 50 } };
  await repos.events.create({ ...base, typeId: 'tackle', lineupEntryId: 'p1' });
  await repos.events.create({ ...base, typeId: 'tackle' }); // no player → ⚠
  return { live, done };
}

describe('Home page', () => {
  it('shows the empty state with Create a team and New match', async () => {
    renderApp();
    expect(await screen.findByText('No matches yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create a team/i })).toHaveAttribute('href', '/squads?new=team');
    expect(screen.getByRole('link', { name: /new match$/i })).toHaveAttribute('href', '/matches/new');
  });

  it('lists matches newest first with score, status, events and ⚠ count', async () => {
    await seedTwoMatches();
    renderApp();

    const rows = await screen.findAllByRole('row');
    const [, first, second] = rows; // rows[0] is the header
    expect(within(first!).getByText('Riverside FC')).toBeInTheDocument();
    expect(within(first!).getByText('In progress')).toBeInTheDocument();
    expect(within(first!).getByText('1 incomplete')).toBeInTheDocument();
    expect(within(first!).getByText('2')).toBeInTheDocument();
    expect(within(second!).getByText('Harbour United')).toBeInTheDocument();
    expect(within(second!).getByText('Finished')).toBeInTheDocument();
    expect(within(second!).getByText('Friendly')).toBeInTheDocument();
  });

  it('opens in-progress matches in the collector and finished ones in the report', async () => {
    const { live, done } = await seedTwoMatches();
    const router = renderApp();

    expect(await screen.findByRole('link', { name: /riverside fc/i })).toHaveAttribute('href', `/matches/${live.id}/collect`);
    expect(screen.getByRole('link', { name: /harbour united/i })).toHaveAttribute('href', `/matches/${done.id}/report`);

    await userEvent.click(screen.getByText('Friendly')); // anywhere on the row
    await waitFor(() => expect(router.state.location.pathname).toBe(`/matches/${done.id}/report`));
  });

  it('a finished match offers Match report and Reopen in its ⋯ menu', async () => {
    const { done } = await seedTwoMatches();
    const router = renderApp();
    const user = userEvent.setup();
    const menu = async () => user.click(await screen.findByRole('button', { name: /match actions: lions u14 vs harbour united/i }));

    await menu();
    expect(screen.queryByRole('menuitem', { name: 'Mark finished' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('menuitem', { name: 'Reopen' }));
    await waitFor(async () => expect((await repos.matches.get(done.id))?.status).toBe('in_progress'));

    await repos.matches.update(done.id, { status: 'finished' });
    await waitFor(() => expect(screen.getAllByText('Finished')).toHaveLength(1));
    await menu();
    await user.click(await screen.findByRole('menuitem', { name: 'Match report' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/matches/${done.id}/report`));
  });

  it('an in-progress match offers Open and Mark finished, but no report', async () => {
    const { live } = await seedTwoMatches();
    const router = renderApp();
    const user = userEvent.setup();
    const menu = async () => user.click(await screen.findByRole('button', { name: /match actions: lions u14 vs riverside fc/i }));

    await menu();
    expect(screen.queryByRole('menuitem', { name: 'Match report' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('menuitem', { name: 'Mark finished' }));
    await waitFor(async () => expect((await repos.matches.get(live.id))?.status).toBe('finished'));

    await repos.matches.update(live.id, { status: 'in_progress' });
    await waitFor(() => expect(screen.getAllByText('In progress')).toHaveLength(1));
    await menu();
    await user.click(await screen.findByRole('menuitem', { name: 'Open' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/matches/${live.id}/collect`));
  });

  it('deletes a match after confirmation (soft delete)', async () => {
    const { live } = await seedTwoMatches();
    renderApp();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /match actions: lions u14 vs riverside fc/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/its 2 events/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete match' }));

    await waitFor(() => expect(screen.queryByText('Riverside FC')).not.toBeInTheDocument());
    expect((await repos.matches.get(live.id))?.deletedAt).toBeDefined();
  });

  it('opens the ☰ menu with navigation and theme options', async () => {
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    const nav = await screen.findByRole('navigation', { name: 'Menu' });
    expect(within(nav).getByRole('link', { name: 'Squads' })).toHaveAttribute('href', '/squads');
    expect(screen.getByRole('radio', { name: /dark/i })).toBeInTheDocument();
  });

  it('shows a plain-text footer with app and storage info', async () => {
    renderApp();
    const footer = await screen.findByRole('contentinfo');
    expect(within(footer).getByText('Data is stored only in this browser')).toBeInTheDocument();
    // jsdom has no StorageManager, so persistence can't be granted.
    expect(await within(footer).findByText('Storage may be cleared by the browser')).toBeInTheDocument();
    expect(within(footer).queryAllByRole('link')).toHaveLength(0);
    expect(within(footer).queryAllByRole('button')).toHaveLength(0);
  });
});
