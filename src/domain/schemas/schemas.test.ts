import { describe, expect, it } from 'vitest';
import { lineupEntrySchema, matchEventSchema, matchSchema, playerSchema, teamSchema } from '.';

const base = {
  id: '0b6c1c64-3f1e-4c47-9d8f-2f1d2c7a5e01',
  createdAt: '2026-10-08T10:00:00.000Z',
  updatedAt: '2026-10-08T10:00:00.000Z',
  schemaVersion: 1,
};
const teamId = '5f0e9a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b';

describe('teamSchema', () => {
  it('accepts a minimal team and defaults nameDisplay to full', () => {
    const team = teamSchema.parse({ ...base, name: 'U14' });
    expect(team.nameDisplay).toBe('full');
  });

  it('rejects an empty name', () => {
    expect(teamSchema.safeParse({ ...base, name: '  ' }).success).toBe(false);
  });

  it('rejects a non-UUID id and a bad timestamp', () => {
    expect(teamSchema.safeParse({ ...base, id: 'abc', name: 'U14' }).success).toBe(false);
    expect(teamSchema.safeParse({ ...base, createdAt: 'yesterday', name: 'U14' }).success).toBe(false);
  });
});

describe('matchSchema', () => {
  const minimal = { ...base, teamId, opponentName: 'Atromitos', date: '2026-10-04', formationId: '4-3-3', catalogVersion: 1 };

  it('fills defaults from the data model', () => {
    const match = matchSchema.parse(minimal);
    expect(match).toMatchObject({
      homeAway: 'home',
      halfLengthMin: 45,
      score: { us: 0, them: 0 },
      status: 'in_progress',
      settings: { autoOpenPlayerSearch: true },
    });
  });

  it('requires an opponent and a valid date', () => {
    expect(matchSchema.safeParse({ ...minimal, opponentName: '' }).success).toBe(false);
    expect(matchSchema.safeParse({ ...minimal, date: '04/10/2026' }).success).toBe(false);
  });

  it('rejects a negative or fractional score', () => {
    expect(matchSchema.safeParse({ ...minimal, score: { us: -1, them: 0 } }).success).toBe(false);
    expect(matchSchema.safeParse({ ...minimal, score: { us: 1.5, them: 0 } }).success).toBe(false);
  });

  it('still reads a match saved with a video and video settings, and drops them', () => {
    const old = {
      ...minimal,
      video: { kind: 'youtube', videoId: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ' },
      settings: { reactionLagS: 0.8, seekStepS: 10, autoOpenPlayerSearch: false },
    };
    const match = matchSchema.parse(old);
    expect(match).not.toHaveProperty('video');
    expect(match.settings).toEqual({ autoOpenPlayerSearch: false });
  });
});

describe('matchEventSchema', () => {
  const minimal = {
    ...base,
    matchId: teamId,
    videoTimeS: 12.4,
    clockS: 12.4,
    typeId: 'pass',
    attackDir: 'ltr',
  };

  it('accepts an event without player or location (filled in later)', () => {
    const event = matchEventSchema.parse(minimal);
    expect(event.attributes).toEqual({});
  });

  it('rejects coordinates outside 0–100', () => {
    expect(matchEventSchema.safeParse({ ...minimal, start: { x: 101, y: 50 } }).success).toBe(false);
  });

  it('rejects a negative timeline time', () => {
    expect(matchEventSchema.safeParse({ ...minimal, videoTimeS: -1 }).success).toBe(false);
  });
});

describe('playerSchema', () => {
  const minimal = { ...base, teamId, name: 'Giorgos Papadopoulos', positions: ['CB'] };

  it('accepts a minimal player and defaults archived to false', () => {
    expect(playerSchema.parse(minimal).archived).toBe(false);
  });

  it('requires a name and 1–3 valid positions', () => {
    expect(playerSchema.safeParse({ ...minimal, name: ' ' }).success).toBe(false);
    expect(playerSchema.safeParse({ ...minimal, positions: [] }).success).toBe(false);
    expect(playerSchema.safeParse({ ...minimal, positions: ['CB', 'DM', 'CM', 'AM'] }).success).toBe(false);
    expect(playerSchema.safeParse({ ...minimal, positions: ['GK', 'CB'] }).success).toBe(false);
    expect(playerSchema.safeParse({ ...minimal, positions: ['SW'] }).success).toBe(false);
  });

  it('accepts only an image data URL as photo', () => {
    expect(playerSchema.safeParse({ ...minimal, photo: 'data:image/jpeg;base64,/9j/4AAQ' }).success).toBe(true);
    expect(playerSchema.safeParse({ ...minimal, photo: 'https://example.com/face.jpg' }).success).toBe(false);
  });
});

describe('team logo', () => {
  it('is an optional image data URL', () => {
    expect(teamSchema.safeParse({ ...base, name: 'U14', logo: 'data:image/png;base64,iVBORw0KGgo' }).success).toBe(true);
    expect(teamSchema.safeParse({ ...base, name: 'U14', logo: 'logo.png' }).success).toBe(false);
  });
});

describe('lineupEntrySchema', () => {
  const starter = { ...base, matchId: 'm1', playerId: 'p1', shirtNumber: 8, role: 'starter', positionSlotId: 'RCM' };
  const sub = { ...base, matchId: 'm1', playerId: 'p2', shirtNumber: 14, role: 'sub' };

  it('accepts a starter in a slot and a sub without one', () => {
    expect(lineupEntrySchema.parse(starter)).toMatchObject({ role: 'starter', positionSlotId: 'RCM' });
    expect(lineupEntrySchema.parse(sub).positionSlotId).toBeUndefined();
  });

  it('needs a slot for starters and none for subs', () => {
    expect(lineupEntrySchema.safeParse({ ...starter, positionSlotId: undefined }).success).toBe(false);
    expect(lineupEntrySchema.safeParse({ ...sub, positionSlotId: 'ST' }).success).toBe(false);
  });

  it('takes shirt numbers 1–99 only', () => {
    for (const n of [1, 99]) expect(lineupEntrySchema.safeParse({ ...starter, shirtNumber: n }).success).toBe(true);
    for (const n of [0, 100, 7.5]) expect(lineupEntrySchema.safeParse({ ...starter, shirtNumber: n }).success).toBe(false);
  });
});
