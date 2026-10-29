import type { ActionCatalog, ActionType } from '../catalog';
import type { MatchEvent } from '../schemas';
import { inOpponentBox, intoFinalThird, isLongBall, isProgressive } from './geometry';



/** Report categories, in display order. */
export const STAT_CATEGORIES = ['passing', 'shooting', 'on_ball', 'defending', 'duels', 'fouls_cards', 'errors', 'goalkeeping'] as const;
export type StatCategory = (typeof STAT_CATEGORIES)[number];

export type StatEvent = Pick<MatchEvent, 'typeId' | 'attributes'> & Partial<Pick<MatchEvent, 'outcome' | 'start' | 'end' | 'lineupEntryId'>>;

/** A plain count, or made out of total (shown as "made/total · %"). */
export type StatValue = { kind: 'count'; value: number } | { kind: 'ratio'; made: number; total: number };

interface StatContext {
  typeById: ReadonlyMap<string, ActionType>;
}

export interface StatDef<I extends string = string> {
  id: I;
  category: StatCategory;
  /** Catalog action types this stat reads. */
  typeIds: readonly string[];
  compute(events: readonly StatEvent[], ctx: StatContext): StatValue;
}

type Test = (e: StatEvent) => boolean;

const is = (typeId: string, ...outcomes: string[]): Test => (e) => e.typeId === typeId && (outcomes.length === 0 || (e.outcome !== undefined && outcomes.includes(e.outcome)));
const any = (...tests: Test[]): Test => (e) => tests.some((t) => t(e));
const attr = (key: string, value: string | boolean): Test => (e) => e.attributes[key] === value;
const both = (a: Test, b: Test): Test => (e) => a(e) && b(e);
const tally = (events: readonly StatEvent[], test: Test) => events.reduce((n, e) => (test(e) ? n + 1 : n), 0);

const located = (e: StatEvent): e is StatEvent & Required<Pick<StatEvent, 'start' | 'end'>> => !!e.start && !!e.end;

function count<I extends string>(id: I, category: StatCategory, typeIds: string[], test: Test): StatDef<I> {
  return { id, category, typeIds, compute: (events) => ({ kind: 'count', value: tally(events, test) }) };
}

/** `attempted` defaults to the types' events whose outcome is set: one not set yet is not guessed as a failure. */
function ratio<I extends string>(id: I, category: StatCategory, typeIds: string[], made: Test, attempted: Test = (e) => typeIds.includes(e.typeId) && e.outcome !== undefined): StatDef<I> {
  return { id, category, typeIds, compute: (events) => ({ kind: 'ratio', made: tally(events, both(attempted, made)), total: tally(events, attempted) }) };
}

function countsAsTouch(e: StatEvent, ctx: StatContext): boolean {
  const rule = ctx.typeById.get(e.typeId)?.countsAsTouch;
  if (rule === undefined || rule === false) return false;
  if (rule === true) return true;
  return e.outcome !== undefined && rule.outcomes.includes(e.outcome);
}

const groundWon = any(is('duel_ground', 'won'), is('dribble', 'success'), is('tackle', 'won'));
const groundLost = any(is('duel_ground', 'lost'), is('dribble', 'fail'), is('tackle', 'lost'), is('dribbled_past'));
const aerialWon = is('duel_aerial', 'won');
const aerialLost = is('duel_aerial', 'lost');

const longPass: Test = (e) => e.typeId === 'pass' && e.outcome !== undefined && located(e) && isLongBall(e.start, e.end);
const completePass = is('pass', 'complete');

export const STATS = [
  // Crosses are not passes: they have their own accuracy.
  ratio('passes', 'passing', ['pass'], completePass),
  ratio('crosses', 'passing', ['cross'], is('cross', 'complete')),
  ratio('long_balls', 'passing', ['pass'], completePass, longPass),
  count('into_final_third', 'passing', ['pass'], (e) => completePass(e) && located(e) && intoFinalThird(e.start, e.end)),
  count('progressive_passes', 'passing', ['pass'], (e) => completePass(e) && located(e) && isProgressive(e.start, e.end)),
  count('key_passes', 'passing', ['pass', 'cross'], both(any(is('pass'), is('cross')), attr('chance', 'key_pass'))),
  count('assists', 'passing', ['pass', 'cross'], both(any(is('pass'), is('cross')), attr('chance', 'assist'))),
  count('shots', 'shooting', ['shot'], is('shot')),
  ratio('shots_on_target', 'shooting', ['shot'], is('shot', 'goal', 'saved')),
  count('goals', 'shooting', ['shot'], is('shot', 'goal')),
  count('shots_off_target', 'shooting', ['shot'], is('shot', 'off_target')),
  count('shots_blocked', 'shooting', ['shot'], is('shot', 'blocked')),
  count('shots_woodwork', 'shooting', ['shot'], is('shot', 'woodwork')),
  count('big_chances', 'shooting', ['shot'], both(is('shot'), attr('bigChance', true))),
  ratio('conversion', 'shooting', ['shot'], is('shot', 'goal')),
  ratio('dribbles', 'on_ball', ['dribble'], is('dribble', 'success')),
  {
    id: 'touches',
    category: 'on_ball',
    typeIds: [],
    compute: (events, ctx) => ({ kind: 'count', value: tally(events, (e) => countsAsTouch(e, ctx)) }),
  } as StatDef<'touches'>,
  {
    id: 'touches_in_box',
    category: 'on_ball',
    typeIds: [],
    compute: (events, ctx) => ({ kind: 'count', value: tally(events, (e) => countsAsTouch(e, ctx) && !!e.start && inOpponentBox(e.start)) }),
  } as StatDef<'touches_in_box'>,
  count('offsides', 'on_ball', ['offside'], is('offside')),
  ratio('tackles', 'defending', ['tackle'], is('tackle', 'won')),
  count('interceptions', 'defending', ['interception'], is('interception')),
  count('recoveries', 'defending', ['recovery'], is('recovery')),
  count('clearances', 'defending', ['clearance'], is('clearance')),
  count('blocks', 'defending', ['block'], is('block')),
  count('dribbled_past', 'defending', ['dribbled_past'], is('dribbled_past')),
  // Duels: dribbles, tackles and dribbled past are ground duels too
  ratio('ground_duels', 'duels', ['duel_ground', 'dribble', 'tackle', 'dribbled_past'], groundWon, any(groundWon, groundLost)),
  ratio('aerial_duels', 'duels', ['duel_aerial'], aerialWon, any(aerialWon, aerialLost)),
  ratio('duels', 'duels', ['duel_ground', 'dribble', 'tackle', 'dribbled_past', 'duel_aerial'], any(groundWon, aerialWon), any(groundWon, groundLost, aerialWon, aerialLost)),
  // Fouls and cards: a second yellow is both a yellow card and a sending off
  count('fouls_committed', 'fouls_cards', ['foul'], is('foul', 'committed')),
  count('fouls_won', 'fouls_cards', ['foul'], is('foul', 'won')),
  count('penalties_won', 'fouls_cards', ['foul'], both(is('foul'), attr('penalty', 'won'))),
  count('penalties_conceded', 'fouls_cards', ['foul'], both(is('foul'), attr('penalty', 'conceded'))),
  count('yellow_cards', 'fouls_cards', ['card'], is('card', 'yellow', 'second_yellow')),
  count('red_cards', 'fouls_cards', ['card'], is('card', 'red', 'second_yellow')),
  count('errors', 'errors', ['error'], is('error')),
  count('errors_led_to_attempt', 'errors', ['error'], is('error', 'led_to_attempt')),
  count('errors_led_to_goal', 'errors', ['error'], is('error', 'led_to_goal')),
  count('own_goals', 'errors', ['own_goal'], is('own_goal')),
  count('saves', 'goalkeeping', ['gk_save'], is('gk_save')),
  count('saves_caught', 'goalkeeping', ['gk_save'], both(is('gk_save'), attr('handling', 'caught'))),
  count('saves_parried', 'goalkeeping', ['gk_save'], both(is('gk_save'), attr('handling', 'parried'))),
  count('penalty_saves', 'goalkeeping', ['gk_save'], both(is('gk_save'), attr('penalty', true))),
  ratio('claims', 'goalkeeping', ['gk_claim'], is('gk_claim', 'success')),
  count('punches', 'goalkeeping', ['gk_punch'], is('gk_punch')),
  ratio('sweeper_actions', 'goalkeeping', ['gk_sweeper'], is('gk_sweeper', 'success')),
] as const satisfies readonly StatDef[];

export type StatId = (typeof STATS)[number]['id'];
export type StatValues = Record<StatId, StatValue>;

/**
 * Every stat over the given events: all of a match's events for the team,
 * one player's events for that player. Types missing from the catalog are ignored.
 */
export function computeStats(events: readonly StatEvent[], catalog: ActionCatalog): StatValues {
  const ctx: StatContext = { typeById: new Map(catalog.types.map((t) => [t.id, t])) };
  const known = events.filter((e) => ctx.typeById.has(e.typeId));
  return Object.fromEntries(STATS.map((def) => [def.id, def.compute(known, ctx)])) as StatValues;
}
