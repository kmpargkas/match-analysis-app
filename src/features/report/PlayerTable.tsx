import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { positionCatalog } from '@/domain/catalog';
import type { ReportPlayer } from '@/domain/report';
import type { StatValue } from '@/domain/stats';
import { t, type MessageKey } from '@/i18n';
import { cn } from '@/ui/cn';
import { statPct, statText } from '@/ui/report/format';
import { IncompleteMark } from '@/ui/report/PlayerBadges';

type Dir = 'asc' | 'desc';

interface Column {
  label: MessageKey;
  /** Sort key; equal keys keep report order. */
  sortBy: (p: ReportPlayer) => number | string;
  text: (p: ReportPlayer) => string;
  /** Direction of the first click: numbers rank highest first, labels A → Z. */
  firstDir: Dir;
  numeric: boolean;
}

const made = (v: StatValue) => (v.kind === 'ratio' ? v.made : v.value);
/** Ratios sort by made, then attempts. */
const ratioKey = (v: StatValue) => (v.kind === 'ratio' ? v.made * 10_000 + v.total : v.value);
const positionRank = new Map(positionCatalog.positions.map((p, i) => [p.id, i]));

const num = (label: MessageKey, value: (p: ReportPlayer) => StatValue): Column => ({ label, sortBy: (p) => ratioKey(value(p)), text: (p) => statText(value(p)), firstDir: 'desc', numeric: true });

const COLUMNS: Column[] = [
  { label: 'report.col.number', sortBy: (p) => p.line.shirtNumber, text: (p) => String(p.line.shirtNumber), firstDir: 'asc', numeric: true },
  { label: 'report.col.player', sortBy: (p) => p.name, text: (p) => p.name, firstDir: 'asc', numeric: false },
  { label: 'report.col.position', sortBy: (p) => positionRank.get(p.position ?? '') ?? 99, text: (p) => p.position ?? '—', firstDir: 'asc', numeric: false },
  { label: 'report.col.minutes', sortBy: (p) => p.line.minutes, text: (p) => `${p.line.minutes}'`, firstDir: 'desc', numeric: true },
  num('report.col.goals', (p) => p.line.stats.goals),
  num('report.col.assists', (p) => p.line.stats.assists),
  {
    label: 'report.col.shots',
    sortBy: (p) => made(p.line.stats.shots),
    text: (p) => (made(p.line.stats.shots) ? `${made(p.line.stats.shots)} (${made(p.line.stats.shots_on_target)})` : '0'),
    firstDir: 'desc',
    numeric: true,
  },
  num('report.col.passes', (p) => p.line.stats.passes),
  {
    label: 'report.col.passPct',
    sortBy: (p) => statPct(p.line.stats.passes) ?? -1,
    text: (p) => {
      const pct = statPct(p.line.stats.passes);
      return pct === null ? '—' : `${pct}%`;
    },
    firstDir: 'desc',
    numeric: true,
  },
  num('report.col.keyPasses', (p) => p.line.stats.key_passes),
  num('report.col.crosses', (p) => p.line.stats.crosses),
  num('report.col.dribbles', (p) => p.line.stats.dribbles),
  num('report.col.tackles', (p) => p.line.stats.tackles),
  num('report.col.duels', (p) => p.line.stats.duels),
  num('report.col.recoveries', (p) => p.line.stats.recoveries),
  num('report.col.fouls', (p) => p.line.stats.fouls_committed),
];

/** Every player who played. Click a header to sort (again to reverse); click a name for the popup. */
export function PlayerTable({ players, onSelect }: { players: readonly ReportPlayer[]; onSelect: (entryId: string) => void }) {
  const titleId = useId();
  const [sort, setSort] = useState<{ col: number; dir: Dir } | null>(null);

  const rows = [...players];
  if (sort) {
    const col = COLUMNS[sort.col]!;
    const sign = sort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const x = col.sortBy(a);
      const y = col.sortBy(b);
      return sign * (typeof x === 'string' ? x.localeCompare(String(y)) : x - (y as number));
    });
  }
  const toggle = (i: number) => setSort((s) => (s?.col === i ? { col: i, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col: i, dir: COLUMNS[i]!.firstDir }));

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-surface p-4 print:break-before-page print:[page:players]">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <h2 id={titleId} className="text-lg font-semibold">
          {t('report.players')}
        </h2>
        <span className="text-sm text-muted-foreground print:hidden">{t('report.playersHint')}</span>
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <table aria-labelledby={titleId} className="w-full border-collapse text-sm whitespace-nowrap tabular-nums">
          <thead>
            <tr className="border-b">
              {COLUMNS.map((col, i) => {
                const active = sort?.col === i;
                const Icon = sort?.dir === 'asc' ? ArrowUpIcon : ArrowDownIcon;
                return (
                  <th key={col.label} scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} className={cn('p-0 font-semibold', col.numeric && i > 0 ? 'text-right' : 'text-left')}>
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      className={cn('inline-flex cursor-pointer items-center gap-1 rounded px-2 py-2 hover:text-foreground', active ? 'text-primary' : 'text-foreground/75')}
                    >
                      {t(col.label)}
                      {active && <Icon aria-hidden className="size-3.5" />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.line.entryId} onClick={() => onSelect(p.line.entryId)} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/50">
                {COLUMNS.map((col, i) => (
                  <td key={col.label} className={cn('px-2 py-2', col.numeric && i > 0 && 'text-right', i === 0 && 'text-muted-foreground')}>
                    {col.label === 'report.col.player' ? (
                      <span className="inline-flex items-center gap-1.5">
                        <button type="button" onClick={(e) => (e.stopPropagation(), onSelect(p.line.entryId))} className="cursor-pointer font-semibold hover:underline focus-visible:underline focus-visible:outline-none">
                          {p.name}
                        </button>
                        {p.line.incompleteCount > 0 && <IncompleteMark />}
                      </span>
                    ) : (
                      col.text(p)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
