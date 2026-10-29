import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRoutes } from '@/app/router';
import { RepositoryProvider, type Repositories } from '@/storage';
import { createTestRepositories } from '@/test/repositories';

let repos: Repositories;
let addLineupEntry: (playerId: string) => Promise<unknown>;
let dispose: () => Promise<void>;

beforeEach(() => {
  ({ repos, addLineupEntry, dispose } = createTestRepositories());
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

const position = (name: RegExp) => screen.getByRole('checkbox', { name });

describe('Teams list', () => {
  it('creates a team and opens its page', async () => {
    const user = userEvent.setup();
    const router = renderApp('/squads');

    expect(await screen.findByText('No teams yet')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Create team' })[0]!);
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Create team' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a team name.');

    await user.type(within(dialog).getByLabelText('Team name'), 'Lions U14');
    await user.type(within(dialog).getByLabelText(/Coach/), 'A. Coach');
    await user.click(within(dialog).getByRole('button', { name: 'Create team' }));

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/squads\/[0-9a-f-]{36}$/));
    expect(await screen.findByRole('heading', { name: 'Lions U14' })).toBeInTheDocument();
  });

  it('lists teams with player counts and an Access team button', async () => {
    const team = await repos.teams.create({ name: 'Lions U14' });
    await repos.players.create({ teamId: team.id, name: 'Al Back', positions: ['CB'] });
    await repos.players.create({ teamId: team.id, name: 'Bo Keeper', positions: ['GK'] });
    renderApp('/squads');

    expect(await screen.findByText('2 players')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Access team: Lions U14' })).toHaveAttribute('href', `/squads/${team.id}`);
  });

  it('opens the Create team dialog when linked from Home', async () => {
    renderApp('/squads?new=team');
    expect(await screen.findByRole('dialog', { name: 'Create team' })).toBeInTheDocument();
  });
});

describe('Team page', () => {
  it('adds a player with positions picked on the pitch', async () => {
    const user = userEvent.setup();
    const team = await repos.teams.create({ name: 'Lions U14' });
    renderApp(`/squads/${team.id}`);

    await user.click((await screen.findAllByRole('button', { name: 'Add player' }))[0]!);
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Add player' }));
    expect(within(dialog).getAllByRole('alert').map((a) => a.textContent)).toEqual(['Enter the player’s name.', 'Pick at least one position.']);

    await user.type(within(dialog).getByLabelText('Player name'), 'Giorgos Papadopoulos');
    await user.click(position(/^Centre back/));
    await user.click(position(/^Defensive midfielder/));
    await user.click(position(/^Central midfielder/));
    expect(position(/^Centre back/)).toHaveAttribute('aria-checked', 'true');
    // Three is the maximum, and GK can't be added to outfield positions.
    expect(position(/^Striker/)).toHaveAttribute('aria-disabled', 'true');
    expect(position(/^Goalkeeper/)).toHaveAttribute('aria-disabled', 'true');
    await user.click(within(dialog).getByRole('button', { name: 'Add player' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const row = screen.getByText('Giorgos Papadopoulos').closest('li')!;
    expect(within(row).getAllByText(/^(CB|DM|CM)$/).map((c) => c.textContent)).toEqual(['CB', 'DM', 'CM']);
    const [stored] = await repos.players.listByTeam(team.id);
    expect(stored).toMatchObject({ name: 'Giorgos Papadopoulos', positions: ['CB', 'DM', 'CM'], archived: false });
  });

  it('a goalkeeper blocks every other position', async () => {
    const user = userEvent.setup();
    const team = await repos.teams.create({ name: 'Lions U14' });
    renderApp(`/squads/${team.id}`);
    await user.click((await screen.findAllByRole('button', { name: 'Add player' }))[0]!);
    await screen.findByRole('dialog');

    await user.click(position(/^Goalkeeper/));
    expect(position(/^Centre back/)).toHaveAttribute('aria-disabled', 'true');
    await user.click(position(/^Centre back/));
    expect(position(/^Centre back/)).toHaveAttribute('aria-checked', 'false');
  });

  it('edits a player in the same form, filled with their data', async () => {
    const user = userEvent.setup();
    const team = await repos.teams.create({ name: 'Lions U14' });
    const player = await repos.players.create({ teamId: team.id, name: 'Al Back', positions: ['LB', 'LWB'] });
    renderApp(`/squads/${team.id}`);

    await user.click(await screen.findByRole('button', { name: 'Actions for Al Back' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit player' });
    expect(within(dialog).getByLabelText('Player name')).toHaveValue('Al Back');
    expect(position(/^Left back/)).toHaveAttribute('aria-checked', 'true');
    expect(position(/^Left wing-back/)).toHaveAttribute('aria-checked', 'true');

    await user.click(position(/^Left back/)); // deselect
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await repos.players.get(player.id))?.positions).toEqual(['LWB']));
  });

  it('removes a player without match data after confirmation', async () => {
    const user = userEvent.setup();
    const team = await repos.teams.create({ name: 'Lions U14' });
    const player = await repos.players.create({ teamId: team.id, name: 'Al Back', positions: ['CB'] });
    renderApp(`/squads/${team.id}`);

    await user.click(await screen.findByRole('button', { name: 'Actions for Al Back' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(await within(dialog).findByText('Al Back will be removed from the squad.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Remove player' }));

    await waitFor(() => expect(screen.queryByText('Al Back')).not.toBeInTheDocument());
    expect((await repos.players.get(player.id))?.deletedAt).toBeDefined();
  });

  it('archives a player with match data, and restores them from the archive', async () => {
    const user = userEvent.setup();
    const team = await repos.teams.create({ name: 'Lions U14' });
    const player = await repos.players.create({ teamId: team.id, name: 'Al Back', positions: ['CB'] });
    await addLineupEntry(player.id);
    renderApp(`/squads/${team.id}`);

    await user.click(await screen.findByRole('button', { name: 'Actions for Al Back' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(await within(dialog).findByText(/already has match data, so they will move to the archive/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Remove player' }));

    await user.click(await screen.findByRole('button', { name: /Archive \(1\)/ }));
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(async () => expect((await repos.players.get(player.id))?.archived).toBe(false));
    expect(screen.queryByRole('button', { name: /Archive/ })).not.toBeInTheDocument();
  });

  it('shows names as initials when the team asks for it', async () => {
    const team = await repos.teams.create({ name: 'Lions U12', nameDisplay: 'initials' });
    await repos.players.create({ teamId: team.id, name: 'Giorgos Papadopoulos', positions: ['ST'] });
    renderApp(`/squads/${team.id}`);
    expect(await screen.findByText('G.P.')).toBeInTheDocument();
    expect(screen.queryByText('Giorgos Papadopoulos')).not.toBeInTheDocument();
  });

  it('deletes a team without matches', async () => {
    const user = userEvent.setup();
    const team = await repos.teams.create({ name: 'Lions U14' });
    const router = renderApp(`/squads/${team.id}`);

    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete team' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete team' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/squads'));
    expect((await repos.teams.get(team.id))?.deletedAt).toBeDefined();
  });

  it('blocks deleting a team that has matches', async () => {
    const user = userEvent.setup();
    const team = await repos.teams.create({ name: 'Lions U14' });
    await repos.matches.create({ teamId: team.id, opponentName: 'Riverside FC', date: '2026-10-04', formationId: '4-3-3' });
    renderApp(`/squads/${team.id}`);

    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    const item = await screen.findByRole('menuitem', { name: /Delete team/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(within(item).getByText('Teams with matches can’t be deleted')).toBeInTheDocument();
  });
});
