import { useId } from 'react';
import type { Formation } from '@/domain/catalog';
import type { ReportPlayer } from '@/domain/report';
import { t } from '@/i18n';
import { Avatar } from '@/ui/components/avatar';
import { Pitch, PITCH_LENGTH, PITCH_WIDTH, toPitch } from '@/ui/pitch/Pitch';
import { playerLabel } from '@/ui/report/format';
import { IncompleteMark, PlayerBadges } from '@/ui/report/PlayerBadges';

const PAD = 3;
/** Formation slot (0–100, we attack →) → position over the pitch SVG, in % of its box. */
function slotPosition(x: number, y: number) {
  const p = toPitch(x, y);
  return { left: `${((p.x + PAD) / (PITCH_LENGTH + 2 * PAD)) * 100}%`, top: `${((p.y + PAD) / (PITCH_WIDTH + 2 * PAD)) * 100}%` };
}

/** Starters in their formation slots on a horizontal pitch (attacking →), the subs who came on below. */
export function FormationView({ formation, players, onSelect }: { formation: Formation | undefined; players: readonly ReportPlayer[]; onSelect: (entryId: string) => void }) {
  const titleId = useId();
  const subsId = useId();
  const slots = new Map(formation?.slots.map((s) => [s.id, s]));
  const starters = players.filter((p) => p.line.role === 'starter' && p.line.slotId && slots.has(p.line.slotId));
  const subs = players.filter((p) => p.line.role === 'sub' && p.line.played);

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3 rounded-xl border bg-surface p-4">
      <div className="flex items-baseline gap-2.5">
        <h2 id={titleId} className="text-lg font-semibold">
          {t('report.formation')}
        </h2>
        {formation && <span className="text-sm text-muted-foreground">{formation.labels.en}</span>}
      </div>

      <div className="relative overflow-hidden rounded-lg">
        <Pitch title={t('report.formation')} />
        <ul className="absolute inset-0">
          {starters.map((p) => {
            const slot = slots.get(p.line.slotId!)!;
            const offBadges = p.line.badges.filter((b) => b.kind !== 'sub_on');
            return (
              <li key={p.line.entryId} className="absolute w-24 -translate-x-1/2 -translate-y-1/2" style={slotPosition(slot.x, slot.y)}>
                <button type="button" aria-label={playerLabel(p)} onClick={() => onSelect(p.line.entryId)} className="group flex w-full cursor-pointer flex-col items-center gap-0.5 rounded-md text-white outline-none focus-visible:ring-2 focus-visible:ring-white">
                <span className="relative">
                  <Avatar src={p.player.photo} face size="sm" className="shadow-md ring-2 ring-white transition-transform group-hover:scale-110" />
                  <span className="absolute -bottom-1 -left-2 min-w-5 rounded-full bg-neutral-900 px-1 text-center text-[11px] leading-5 font-bold">{p.line.shirtNumber}</span>
                  {p.line.incompleteCount > 0 && (
                    <span className="absolute -top-1.5 -left-2">
                      <IncompleteMark />
                    </span>
                  )}
                  <PlayerBadges badges={offBadges.filter((b) => b.kind !== 'sub_off')} className="absolute -top-1.5 left-7 w-16" />
                </span>
                <span className="max-w-full truncate rounded bg-black/60 px-1.5 text-xs font-semibold">{p.shortName}</span>
                <PlayerBadges badges={offBadges.filter((b) => b.kind === 'sub_off')} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h3 id={subsId} className="text-xs font-bold tracking-wide text-foreground/80 uppercase">
          {t('report.subsPlayed')}
        </h3>
        {subs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('report.noSubsPlayed')}</p>
        ) : (
          <ul aria-labelledby={subsId} className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-2">
            {subs.map((p) => (
              <li key={p.line.entryId}>
                <button type="button" aria-label={playerLabel(p)} onClick={() => onSelect(p.line.entryId)} className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border bg-background px-2.5 py-2 text-left hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <Avatar src={p.player.photo} face size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">
                    <span className="text-muted-foreground tabular-nums">{p.line.shirtNumber}</span> {p.shortName}
                  </span>
                  <PlayerBadges badges={p.line.badges} />
                </span>
                {p.line.incompleteCount > 0 && <IncompleteMark />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
