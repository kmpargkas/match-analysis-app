import type { LineupProblem } from '@/domain/lineup';
import type { Team } from '@/domain/schemas';
import { t } from '@/i18n';
import type { MatchInfo } from './matchInfo';

export function setupProblems({ team, info, lineupProblems }: { team: Team | undefined; info: MatchInfo; lineupProblems: LineupProblem[] }): string[] {
  if (!team) return [t('matchSetup.problem.team')];
  const messages: string[] = [];
  if (!info.opponentName.trim()) messages.push(t('matchSetup.problem.opponent'));
  if (!info.date) messages.push(t('matchSetup.problem.date'));

  const count = (code: LineupProblem['code']) => lineupProblems.filter((p) => p.code === code).length;
  if (count('numberMissing') > 0) messages.push(t('matchSetup.problem.numbersMissing', { count: count('numberMissing') }));
  if (count('numberInvalid') > 0) messages.push(t('matchSetup.problem.numbersInvalid'));
  if (count('numberDuplicate') > 0) messages.push(t('matchSetup.problem.numbersDuplicate'));
  if (count('formationMissing') > 0) messages.push(t('matchSetup.problem.formation'));

  const empty = lineupProblems.flatMap((p) => (p.code === 'slotEmpty' ? [p.slotId] : []));
  if (empty.length > 0) messages.push(t('matchSetup.problem.slotsEmpty', { slots: empty.join(', ') }));
  return messages;
}
