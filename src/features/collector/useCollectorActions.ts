import { clockAt, clockCommand, type ClockCommand } from '@/domain/clock';
import { newEvent } from '@/domain/events';
import type { ActionType } from '@/domain/catalog';
import { possessionAt, possessionChangeFor } from '@/domain/possession';
import type { AttackDir, Half, Match, Point, PossessionTeam } from '@/domain/schemas';
import { useRepositories } from '@/storage';
import { toast } from '@/ui/components/toaster';
import { t } from '@/i18n';
import { useCollectorContext } from './context';
import { useCollector, type PlayerField } from './store';

/** Every change the collector makes. Each write is saved at once and tracked for the Saved indicator. */
export function useCollectorActions() {
  const repos = useRepositories();
  const { data, now } = useCollectorContext();
  const { match } = data;
  const store = useCollector;
  const save = <T,>(write: Promise<T>) =>
    store
      .getState()
      .save(write)
      .catch((error: unknown) => {
        toast.error(t('common.saveFailed'));
        throw error;
      });

  const attackDir: AttackDir = match.attackDir ?? 'ltr';
  const updateMatch = (changes: Parameters<typeof repos.matches.update>[1]) => save(repos.matches.update(match.id, changes));
  const half: Half = match.half ?? 1;

  async function clock(command: ClockCommand, t = now()) {
    const anchor = clockCommand(command, t, data.anchors);
    if (anchor) await save(repos.clock.create({ matchId: match.id, ...anchor }));
  }

  async function setPossession(team: PossessionTeam, t0 = now()) {
    const action = possessionChangeFor(team, t0, data.possession);
    if (action.kind === 'add') await save(repos.possession.create({ matchId: match.id, videoTimeS: t0, team }));
    if (action.kind === 'replace') await save(repos.possession.update(action.id, { team }));
  }

  return {
    attackDir,
    half,

    async logAction(type: ActionType, outcome: string | undefined) {
      const draft = newEvent(type, outcome, { timeS: now(), half, anchors: data.anchors, attackDir });
      const event = await save(repos.events.create({ matchId: match.id, ...draft }));
      const needsLocation = type.location !== 'none';
      store.getState().activate(event.id, needsLocation);
      if (!needsLocation && type.needsPlayer && match.settings.autoOpenPlayerSearch) store.getState().openPlayerSearch(event.id);
    },

    async setLocation(eventId: string, start: Point, end: Point | undefined) {
      await save(repos.events.update(eventId, { start, end }));
    },

    async assignPlayer(eventId: string, field: PlayerField, lineupEntryId: string | undefined) {
      await save(repos.events.update(eventId, field === 'player' ? { lineupEntryId } : { relatedLineupEntryId: lineupEntryId }));
    },

    async setOutcome(eventId: string, outcome: string | undefined) {
      await save(repos.events.update(eventId, { outcome }));
    },

    async setAttribute(eventId: string, key: string, value: string | boolean | undefined) {
      const event = data.events.find((e) => e.id === eventId);
      if (!event) return;
      const attributes = { ...event.attributes };
      if (value === undefined) delete attributes[key];
      else attributes[key] = value;
      await save(repos.events.update(eventId, { attributes }));
    },

    async setEventClock(eventId: string, clockS: number) {
      await save(repos.events.update(eventId, { clockS }));
    },

    async deleteEvent(eventId: string) {
      const state = store.getState();
      if (state.activeEventId === eventId) state.activate(null);
      await save(repos.events.softDelete(eventId));
    },

    clock: (command: ClockCommand) => clock(command),
    toggleClock() {
      const t = now();
      return clock({ kind: clockAt(t, data.anchors).running ? 'stop' : 'start' }, t);
    },

    setPossession: (team: PossessionTeam) => setPossession(team),
    /** Unknown possession goes to us first. */
    togglePossession() {
      const t = now();
      return setPossession(possessionAt(t, data.possession) === 'us' ? 'them' : 'us', t);
    },

    /** The 2nd half starts with the clock stopped at the end of the 1st; going back only relabels. */
    async setHalf(next: Half) {
      if (next === half) return;
      await updateMatch({ half: next });
      if (next === 2) await clock({ kind: 'set', clockS: match.halfLengthMin * 60, running: false });
    },

    flipDirection: () => updateMatch({ attackDir: attackDir === 'ltr' ? 'rtl' : 'ltr' }),
    setScore: (score: Match['score']) => updateMatch({ score }),
    updateSettings: (settings: Match['settings']) => updateMatch({ settings }),
    finish: () => updateMatch({ status: 'finished' }),
  };
}
