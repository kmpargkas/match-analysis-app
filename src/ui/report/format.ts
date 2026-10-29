import type { ReportPlayer } from '@/domain/report';
import type { StatCategory, StatValue } from '@/domain/stats';
import { t } from '@/i18n';

/** Report category → catalog group, for the category colour. */
export const CATEGORY_GROUP: Record<StatCategory, string> = {
  passing: 'passing',
  shooting: 'shooting',
  on_ball: 'on_ball',
  defending: 'defending',
  duels: 'duels',
  fouls_cards: 'fouls',
  errors: 'errors',
  goalkeeping: 'goalkeeper',
};

/** "12" for a count, "262/312" for a ratio. */
export const statText = (v: StatValue) => (v.kind === 'count' ? String(v.value) : `${v.made}/${v.total}`);

/** Success % for a ratio with attempts, rounded; null otherwise. */
export const statPct = (v: StatValue) => (v.kind === 'ratio' && v.total > 0 ? Math.round((v.made / v.total) * 100) : null);

export const isEmptyStat = (v: StatValue) => (v.kind === 'count' ? v.value === 0 : v.total === 0);

/** "#9 Stelios Striker": the accessible name of a player everywhere in the report. */
export const playerLabel = (p: ReportPlayer) => t('report.player', { number: p.line.shirtNumber, name: p.name });
