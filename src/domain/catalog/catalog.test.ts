import { describe, expect, it } from 'vitest';
import { actionCatalog, findFormation, formationCatalog, positionCatalog } from '.';

describe('actionCatalog', () => {
  it('ships every v1 action type exactly once', () => {
    const ids = actionCatalog.types.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      'pass', 'cross', 'shot', 'dribble', 'offside', 'error', 'own_goal',
      'tackle', 'interception', 'recovery', 'clearance', 'block', 'dribbled_past',
      'duel_ground', 'duel_aerial', 'foul',
      'gk_save', 'gk_claim', 'gk_punch', 'gk_sweeper', 'card', 'substitution',
    ]);
  });

  it('only pass and cross are lines; card and substitution have no location', () => {
    const byLocation = (loc: string) => actionCatalog.types.filter((t) => t.location === loc).map((t) => t.id);
    expect(byLocation('line')).toEqual(['pass', 'cross']);
    expect(byLocation('none')).toEqual(['card', 'substitution']);
  });

  it('only the shot body part is a required attribute', () => {
    const required = actionCatalog.types.flatMap((t) => t.attributes.filter((a) => a.required).map((a) => `${t.id}.${a.key}`));
    expect(required).toEqual(['shot.bodyPart']);
  });
});

describe('action panel layout', () => {
  it('puts every type in a known group, with only match actions (cards, subs) under More', () => {
    const groups = new Set(actionCatalog.groups.map((g) => g.id));
    expect(actionCatalog.types.every((t) => groups.has(t.category))).toBe(true);
    expect(actionCatalog.groups.filter((g) => g.more).map((g) => g.id)).toEqual(['match']);
  });

  it('only presets outcomes the type has', () => {
    for (const type of actionCatalog.types) {
      for (const button of type.buttons ?? []) if (button.outcome) expect(type.outcomes, `${type.id} ${button.outcome}`).toContain(button.outcome);
    }
  });

  it('labels every outcome, attribute and option', () => {
    const { outcomes, attributes, options } = actionCatalog.labels;
    for (const type of actionCatalog.types) {
      for (const outcome of type.outcomes) expect(outcomes[outcome], `${type.id} outcome ${outcome}`).toBeDefined();
      for (const attr of type.attributes) {
        expect(attributes[attr.key], `${type.id} attribute ${attr.key}`).toBeDefined();
        for (const option of attr.options) expect(options[option], `${type.id} option ${option}`).toBeDefined();
      }
    }
  });

  it('splits the common outcomes into their own buttons', () => {
    const labels = (id: string) => actionCatalog.types.find((t) => t.id === id)?.buttons?.map((b) => b.labels.en);
    expect(labels('pass')).toEqual(['Pass ✓', 'Pass ✗']);
    expect(labels('shot')).toEqual(['Goal', 'Saved', 'Off target', 'Blocked']);
  });
});

describe('formationCatalog', () => {
  const positionIds = new Set(positionCatalog.positions.map((p) => p.id));
  const each = formationCatalog.formations.map((f) => [f.id, f] as const);

  it('ships the v1 11v11 shapes, each once', () => {
    const ids = formationCatalog.formations.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      '4-4-2', '4-3-3', '4-2-3-1', '4-1-4-1', '4-1-2-1-2', '4-4-1-1', '4-3-1-2', '4-3-2-1', '4-5-1',
      '3-5-2', '3-4-3', '3-4-2-1', '3-4-1-2', '5-3-2', '5-4-1',
    ]);
    expect(formationCatalog.formations.every((f) => f.format === '11v11')).toBe(true);
  });

  it.each(each)('%s has 11 unique slots on known positions and one goalkeeper', (_, formation) => {
    expect(formation.slots).toHaveLength(11);
    expect(new Set(formation.slots.map((s) => s.id)).size).toBe(11);
    expect(formation.slots.every((s) => positionIds.has(s.position))).toBe(true);
    expect(formation.slots.filter((s) => s.position === 'GK')).toHaveLength(1);
  });

  it.each(each)('%s has as many outfield slots as its name says', (id, formation) => {
    const outfield = id.split('-').reduce((sum, n) => sum + Number(n), 0);
    expect(formation.slots.filter((s) => s.position !== 'GK')).toHaveLength(outfield);
  });

  it.each(each)('%s keeps slots far enough apart to click (≥ 9 m)', (_, formation) => {
    const metres = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(((a.x - b.x) / 100) * 105, ((a.y - b.y) / 100) * 68);
    for (const [i, a] of formation.slots.entries()) {
      for (const b of formation.slots.slice(i + 1)) expect(metres(a, b), `${a.id}–${b.id}`).toBeGreaterThanOrEqual(9);
    }
  });

  it('puts right-sided slots below the centre line and left-sided ones above (y = 0 is the left touchline)', () => {
    for (const formation of formationCatalog.formations) {
      for (const slot of formation.slots) {
        if (slot.id.startsWith('R')) expect(slot.y, `${formation.id} ${slot.id}`).toBeGreaterThan(50);
        if (slot.id.startsWith('L')) expect(slot.y, `${formation.id} ${slot.id}`).toBeLessThan(50);
      }
    }
  });

  it('finds formations by id', () => {
    expect(findFormation('4-3-3')?.slots).toHaveLength(11);
    expect(findFormation('9-9-9')).toBeUndefined();
  });
});
