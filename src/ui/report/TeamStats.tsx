import { useId } from 'react';
import { STAT_CATEGORIES, STATS, type StatCategory, type StatValues } from '@/domain/stats';
import { t } from '@/i18n';
import { groupColour } from '@/ui/categoryColours';
import { CATEGORY_GROUP, isEmptyStat, statPct, statText } from './format';

/** One card per category; a category with no events at all is left out. `hideZeroRows` also drops empty rows (player popup). */
export function TeamStats({ stats, hideZeroRows = false }: { stats: StatValues; hideZeroRows?: boolean }) {
  const categories = STAT_CATEGORIES.filter((category) => STATS.some((def) => def.category === category && !isEmptyStat(stats[def.id])));
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
      {categories.map((category) => (
        <StatCard key={category} category={category} stats={stats} hideZeroRows={hideZeroRows} />
      ))}
    </div>
  );
}

function StatCard({ category, stats, hideZeroRows }: { category: StatCategory; stats: StatValues; hideZeroRows: boolean }) {
  const id = useId();
  const colour = groupColour(CATEGORY_GROUP[category]);
  return (
    <section aria-labelledby={id} className="break-inside-avoid rounded-xl border bg-surface px-4 py-3.5 print:py-2.5">
      <h3 id={id} className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-foreground/80 uppercase">
        <span aria-hidden className="size-2.5 rounded-[3px]" style={{ backgroundColor: colour }} />
        {t(`stats.category.${category}`)}
      </h3>
      <table className="w-full text-sm">
        <tbody>
          {STATS.filter((def) => def.category === category && !(hideZeroRows && isEmptyStat(stats[def.id]))).map((def) => {
            const value = stats[def.id];
            const pct = statPct(value);
            return (
              <tr key={def.id} className="align-baseline">
                <th scope="row" className="py-1 pr-2 text-left font-normal text-foreground/80">
                  {t(`stats.${def.id}`)}
                  {value.kind === 'ratio' && (
                    <span aria-hidden className="mt-1 block h-1 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full" style={{ width: `${pct ?? 0}%`, backgroundColor: colour }} />
                    </span>
                  )}
                </th>
                <td className="py-1 text-right font-semibold tabular-nums">{statText(value)}</td>
                <td className="w-12 py-1 text-right text-xs font-medium text-muted-foreground tabular-nums">{pct === null ? '' : `${pct}%`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
