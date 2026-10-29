import { ArrowLeftRightIcon, RefreshCwIcon } from 'lucide-react';
import { useRef, type PointerEvent } from 'react';
import { fromScreen, isDrag, toScreen } from '@/domain/coords';
import { possessionAt } from '@/domain/possession';
import type { MatchEvent, Point, PossessionTeam } from '@/domain/schemas';
import { t } from '@/i18n';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/components/button';
import { Pitch, PITCH_LENGTH, PITCH_WIDTH, toPitch } from '@/ui/pitch/Pitch';
import { groupColour, typeById } from './catalogView';
import { useCollectorContext } from './context';
import { useCollector } from './store';
import { useCollectorActions } from './useCollectorActions';

export function PitchPanel() {
  const { data } = useCollectorContext();
  const actions = useCollectorActions();
  const timeS = useCollector((s) => s.timeS);
  const possession = possessionAt(timeS, data.possession);

  return (
    <section aria-label={t('collector.pitch.title')} className="flex min-h-0 shrink-0 basis-[62%] flex-col items-center gap-2 overflow-hidden rounded-xl border bg-surface p-3">
      <MapPrompt />
      <Minimap possession={possession} />
      <div className="flex shrink-0 items-center gap-2">
        <ChangeSides dir={actions.attackDir} onFlip={() => void actions.flipDirection()} />
        <ChangePossession current={possession} onToggle={() => void actions.togglePossession()} />
      </div>
    </section>
  );
}

function useMappingTarget(): { event: MatchEvent; awaiting: boolean } | null {
  const { data } = useCollectorContext();
  const awaitingId = useCollector((s) => s.awaitingLocationId);
  const activeId = useCollector((s) => s.activeEventId);
  const id = awaitingId ?? activeId;
  const event = id ? data.events.find((e) => e.id === id) : undefined;
  if (!event || typeById.get(event.typeId)?.location === 'none') return null;
  return { event, awaiting: id === awaitingId };
}

function MapPrompt() {
  const target = useMappingTarget();
  const pendingStart = useCollector((s) => s.pendingStart);
  if (!target) return <p className="h-6 shrink-0" />;
  const line = typeById.get(target.event.typeId)?.location === 'line';
  const text = !target.awaiting ? t('collector.pitch.remap') : pendingStart ? t('collector.pitch.mapPassEnd') : line ? t('collector.pitch.mapPass') : '';
  return (
    <p className="flex h-6 shrink-0 items-center gap-2 text-sm" role="status">
      {target.awaiting && <span className="rounded-md bg-warning px-2 py-0.5 text-xs font-semibold text-black">{t('collector.pitch.mapEvent')}</span>}
      <span className="text-muted-foreground">{text}</span>
    </p>
  );
}

const VIEW_PAD = 3;

/** Pointer position → 0–100 pitch coordinates as drawn on screen. */
function screenPoint(svg: SVGSVGElement, e: PointerEvent): Point {
  const ctm = svg.getScreenCTM?.();
  let x: number;
  let y: number;
  if (ctm) {
    x = (e.clientX - ctm.e) / ctm.a;
    y = (e.clientY - ctm.f) / ctm.d;
  } else {
    const rect = svg.getBoundingClientRect();
    x = ((e.clientX - rect.left) / rect.width) * (PITCH_LENGTH + 2 * VIEW_PAD) - VIEW_PAD;
    y = ((e.clientY - rect.top) / rect.height) * (PITCH_WIDTH + 2 * VIEW_PAD) - VIEW_PAD;
  }
  return { x: (x / PITCH_LENGTH) * 100, y: (y / PITCH_WIDTH) * 100 };
}

function Minimap({ possession }: { possession: PossessionTeam | null }) {
  const { data } = useCollectorContext();
  const actions = useCollectorActions();
  const target = useMappingTarget();
  const pendingStart = useCollector((s) => s.pendingStart);
  const down = useRef<Point | null>(null);
  const dir = actions.attackDir;

  async function place(event: MatchEvent, start: Point, end: Point | undefined) {
    const state = useCollector.getState();
    await actions.setLocation(event.id, fromScreen(start, dir), end && fromScreen(end, dir));
    state.setAwaitingLocation(null);
    const type = typeById.get(event.typeId);
    if (type?.needsPlayer && !event.lineupEntryId && data.match.settings.autoOpenPlayerSearch) state.openPlayerSearch(event.id);
  }

  function onPointerDown(e: PointerEvent<SVGRectElement>) {
    if (!target) return;
    down.current = screenPoint(e.currentTarget.ownerSVGElement!, e);
  }

  function onPointerUp(e: PointerEvent<SVGRectElement>) {
    const from = down.current;
    down.current = null;
    if (!target || !from) return;
    const to = screenPoint(e.currentTarget.ownerSVGElement!, e);
    const { event } = target;
    if (typeById.get(event.typeId)?.location === 'point') return void place(event, from, undefined);
    if (isDrag(from, to)) return void place(event, from, to);
    if (pendingStart) {
      useCollector.getState().setPendingStart(null);
      return void place(event, pendingStart, from);
    }
    useCollector.getState().setPendingStart(from);
  }

  const shown = target?.event;
  const colour = groupColour(shown && typeById.get(shown.typeId)?.category);
  const start = shown?.start && toScreen(shown.start, dir);
  const end = shown?.end && toScreen(shown.end, dir);

  return (
    <div className="flex min-h-0 w-full flex-1 items-center justify-center">
      <div
        className={cn(
          'h-full max-h-full overflow-hidden rounded-lg shadow-inner ring-1 ring-black/10 transition-[filter] duration-300 [&_svg]:h-full [&_svg]:w-auto',
          possession === 'them' && 'grayscale',
          possession === null && 'grayscale-[0.4]',
          target && 'ring-2 ring-warning',
        )}
        style={{ aspectRatio: `${PITCH_LENGTH + 2 * VIEW_PAD} / ${PITCH_WIDTH + 2 * VIEW_PAD}` }}
      >
        <Pitch title={t('collector.pitch.title')}>
          <defs>
            <marker id="collector-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={colour} />
            </marker>
          </defs>
          <AttackArrow dir={dir} />
          {start && end && <line {...lineProps(start, end)} stroke={colour} strokeWidth={0.9} strokeLinecap="round" markerEnd="url(#collector-arrow)" />}
          {start && <circle {...dot(start)} r={1.6} fill={colour} stroke="white" strokeWidth={0.4} />}
          {pendingStart && <circle {...dot(pendingStart)} r={1.4} fill="none" stroke="var(--foreground)" strokeWidth={0.5} strokeDasharray="0.8 0.6" />}
          <rect
            x={-VIEW_PAD}
            y={-VIEW_PAD}
            width={PITCH_LENGTH + 2 * VIEW_PAD}
            height={PITCH_WIDTH + 2 * VIEW_PAD}
            fill="transparent"
            className={cn(target && 'cursor-crosshair')}
            data-testid="minimap-surface"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          />
        </Pitch>
      </div>
    </div>
  );
}

const dot = (p: Point) => {
  const { x, y } = toPitch(p.x, p.y);
  return { cx: x, cy: y };
};

const lineProps = (a: Point, b: Point) => {
  const from = toPitch(a.x, a.y);
  const to = toPitch(b.x, b.y);
  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
};

/** Faint arrow across the middle of the pitch showing the goal we attack; it never takes clicks. */
function AttackArrow({ dir }: { dir: 'ltr' | 'rtl' }) {
  const cy = PITCH_WIDTH / 2;
  const [tail, head] = dir === 'ltr' ? [PITCH_LENGTH * 0.3, PITCH_LENGTH * 0.7] : [PITCH_LENGTH * 0.7, PITCH_LENGTH * 0.3];
  const back = dir === 'ltr' ? head - 5 : head + 5;
  return (
    <g aria-hidden pointerEvents="none" fill="none" stroke="var(--foreground)" strokeOpacity={0.22} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <line x1={tail} y1={cy} x2={head} y2={cy} />
      <path d={`M ${back} ${cy - 5} L ${head} ${cy} L ${back} ${cy + 5}`} />
    </g>
  );
}

function ChangeSides({ dir, onFlip }: { dir: 'ltr' | 'rtl'; onFlip: () => void }) {
  const label = `${t('collector.pitch.attacking')} ${dir === 'ltr' ? t('collector.pitch.ltr') : t('collector.pitch.rtl')}`;
  return (
    <Button variant="outline" size="sm" className="shrink-0" onClick={onFlip} aria-label={`${t('collector.pitch.changeSides')}. ${label}`} title={label}>
      <ArrowLeftRightIcon />
      {t('collector.pitch.changeSides')}
    </Button>
  );
}

/** Pitch colour shows who has the ball: green for us, grey for the opponent. */
function ChangePossession({ current, onToggle }: { current: PossessionTeam | null; onToggle: () => void }) {
  const { data } = useCollectorContext();
  const holder = current === 'us' ? (data.team?.name ?? t('collector.possession.us')) : current === 'them' ? t('collector.possession.them') : t('collector.possession.unknown');
  const label = `${t('collector.possession.title')}: ${holder}`;
  return (
    <Button variant="outline" size="sm" className="shrink-0" onClick={onToggle} aria-label={`${t('collector.possession.change')}. ${label}`} title={label}>
      <RefreshCwIcon />
      {t('collector.possession.change')}
    </Button>
  );
}
