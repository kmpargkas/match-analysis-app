import type { MissingField } from '@/domain/events';
import { t } from '@/i18n';
import { attributeLabel } from './catalogView';

const fixed = {
  outcome: 'collector.log.missing.outcome',
  player: 'collector.log.missing.player',
  playerOn: 'collector.log.missing.playerOn',
  location: 'collector.log.missing.location',
  unknownType: 'collector.log.missing.unknownType',
} as const;

/** "player, location, body part" */
export function missingText(missing: readonly MissingField[]): string {
  return missing.map((field) => (field in fixed ? t(fixed[field as keyof typeof fixed]) : attributeLabel(field).toLocaleLowerCase())).join(', ');
}
