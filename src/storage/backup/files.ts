import { downloadTextFile, readLastBackupAt, writeLastBackupAt } from '@/platform/textFile';
import type { Repositories } from '../repositories';
import { makeBackup, matchRecords } from '.';

const slug = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-') || 'match';

const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Downloads every match, team and squad. Only this counts as a backup for the reminder. */
export async function exportAllData(repos: Repositories, now = new Date()) {
  const backup = makeBackup(await repos.backup.readAll(), now.toISOString());
  downloadTextFile(`match-analysis-backup-${localDate(now)}.json`, JSON.stringify(backup, null, 2));
  writeLastBackupAt(now.toISOString());
}

/** Downloads one match with its team and players. */
export async function exportMatchData(repos: Repositories, matchId: string, now = new Date()) {
  const records = matchRecords(await repos.backup.readAll(), matchId);
  const match = records.matches[0];
  if (!match) throw new Error(`Match ${matchId} not found`);
  const team = records.teams[0]?.name ?? 'team';
  downloadTextFile(`match-${slug(team)}-vs-${slug(match.opponentName)}-${match.date}.json`, JSON.stringify(makeBackup(records, now.toISOString()), null, 2));
}

export { readLastBackupAt as lastBackupAt };
