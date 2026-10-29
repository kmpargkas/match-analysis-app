import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appRoutes } from '@/app/router';
import { RepositoryProvider, type Repositories } from '@/storage';
import { createTestRepositories } from '@/test/repositories';

const files = vi.hoisted(() => ({ downloads: [] as { name: string; text: string }[], lastBackupAt: null as string | null }));
vi.mock('@/platform/textFile', () => ({
  downloadTextFile: (name: string, text: string) => files.downloads.push({ name, text }),
  readLastBackupAt: () => files.lastBackupAt,
  writeLastBackupAt: (at: string) => {
    files.lastBackupAt = at;
  },
}));

let repos: Repositories;
const disposers: (() => Promise<void>)[] = [];

beforeEach(() => {
  files.downloads.length = 0;
  files.lastBackupAt = null;
  repos = fresh();
});

afterEach(async () => {
  while (disposers.length) await disposers.pop()!();
});

function fresh(): Repositories {
  const { repos: r, dispose } = createTestRepositories();
  disposers.push(dispose);
  return r;
}

async function seed(into: Repositories) {
  const team = await into.teams.create({ name: 'Lions U14' });
  const player = await into.players.create({ teamId: team.id, name: 'Stelios Striker', positions: ['ST'] });
  const match = await into.matches.createWithLineup(
    { teamId: team.id, opponentName: 'Riverside FC', date: '2026-10-04', formationId: '4-3-3', score: { us: 1, them: 0 } },
    [{ playerId: player.id, shirtNumber: 9, role: 'starter', positionSlotId: 'ST' }],
  );
  await into.events.create({ matchId: match.id, videoTimeS: 5, clockS: 5, typeId: 'recovery', attackDir: 'ltr' });
  return match;
}

function renderHome() {
  const router = createMemoryRouter(appRoutes, { initialEntries: ['/'] });
  render(
    <RepositoryProvider repositories={repos}>
      <RouterProvider router={router} />
    </RepositoryProvider>,
  );
}

const upload = async (text: string) => userEvent.upload(await screen.findByLabelText('Backup file'), new File([text], 'backup.json', { type: 'application/json' }));

async function backupText(of: Repositories) {
  const before = files.downloads.length;
  const { exportAllData } = await import('@/storage');
  await exportAllData(of);
  return files.downloads[before]!.text;
}

describe('JSON backup on Home', () => {
  it('exports everything and remembers when, for the backup reminder', async () => {
    await seed(repos);
    renderHome();
    const user = userEvent.setup();

    expect(await screen.findByText('Never backed up')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export all' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Export all' }));

    await waitFor(() => expect(files.downloads).toHaveLength(1));
    expect(files.downloads[0]!.name).toMatch(/^match-analysis-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const backup = JSON.parse(files.downloads[0]!.text);
    expect(backup).toMatchObject({ app: 'match-analysis', exportVersion: 1 });
    expect(backup.matches).toHaveLength(1);
    expect(backup.events).toHaveLength(1);
    expect(await screen.findByText('Last backup: today')).toBeInTheDocument();
  });

  it('says how long ago the last backup was', async () => {
    files.lastBackupAt = new Date(Date.now() - 12 * 86_400_000).toISOString();
    await seed(repos);
    renderHome();
    expect(await screen.findByText('Last backup: 12 days ago')).toBeInTheDocument();
  });

  it('exports one match with its team and players from the row menu', async () => {
    await seed(repos);
    renderHome();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /match actions: lions u14 vs riverside fc/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Export JSON' }));
    await waitFor(() => expect(files.downloads).toHaveLength(1));
    expect(files.downloads[0]!.name).toBe('match-lions-u14-vs-riverside-fc-2026-10-04.json');
    const backup = JSON.parse(files.downloads[0]!.text);
    expect(backup.matches).toHaveLength(1);
    expect(backup.teams).toHaveLength(1);
    expect(backup.players).toHaveLength(1);
    // A per-match export is not a full backup.
    expect(files.lastBackupAt).toBeNull();
  });

  it('imports a backup into an empty browser', async () => {
    const other = fresh();
    await seed(other);
    const text = await backupText(other);
    renderHome();

    await upload(text);
    expect(await screen.findByText('Imported 1 match')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /riverside fc/i })).toBeInTheDocument();
    expect(await repos.events.list()).toHaveLength(1);
  });

  it('asks before importing records that are already here: keep both makes a copy', async () => {
    await seed(repos);
    const text = await backupText(repos);
    renderHome();
    const user = userEvent.setup();

    await upload(text);
    const dialog = await screen.findByRole('alertdialog', { name: 'Some of this is already here' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep both' }));
    await waitFor(async () => expect(await repos.matches.list()).toHaveLength(2));
    expect(await repos.teams.list()).toHaveLength(2);
    await waitFor(() => expect(screen.getAllByRole('link', { name: /riverside fc/i })).toHaveLength(2));
  });

  it('replace puts the stored records back to what the file says', async () => {
    const match = await seed(repos);
    const text = await backupText(repos);
    await repos.matches.update(match.id, { score: { us: 7, them: 7 } });
    renderHome();
    const user = userEvent.setup();

    await upload(text);
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Replace' }));
    await waitFor(async () => expect((await repos.matches.get(match.id))?.score).toEqual({ us: 1, them: 0 }));
    expect(await repos.matches.list()).toHaveLength(1);
  });

  it('explains why a file cannot be imported', async () => {
    renderHome();
    await upload('not json');
    expect(await screen.findByText('This file isn’t valid JSON.')).toBeInTheDocument();
    await upload(JSON.stringify({ hello: 'world' }));
    expect(await screen.findByText('This isn’t a match-analysis backup file.')).toBeInTheDocument();
  });
});
