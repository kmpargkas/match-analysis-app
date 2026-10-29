import { describe, expect, it } from 'vitest';
import type { Player, Team } from '../schemas';
import { displayName, initials, pitchName, sortSquad } from './players';

const stamp = { createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z', schemaVersion: 1 };
const team = (nameDisplay: Team['nameDisplay']): Team => ({ ...stamp, id: 't1', name: 'Lions U14', nameDisplay });
const player = (name: string, positions: string[], id = name): Player => ({ ...stamp, id, teamId: 't1', name, positions, archived: false });

describe('initials', () => {
  it('uses the first letter of each part of the name', () => {
    expect(initials('Giorgos Papadopoulos')).toBe('G.P.');
    expect(initials('  ana  maria   lopez ')).toBe('A.M.L.');
    expect(initials('Pelé')).toBe('P.');
  });

  it('handles Greek names', () => {
    expect(initials('Γιώργος Παπαδόπουλος')).toBe('Γ.Π.');
  });
});

describe('displayName', () => {
  it("follows the team's initials setting", () => {
    const p = player('Giorgos Papadopoulos', ['CB']);
    expect(displayName(p, team('full'))).toBe('Giorgos Papadopoulos');
    expect(displayName(p, team('initials'))).toBe('G.P.');
  });
});

describe('pitchName', () => {
  it('uses the surname so labels fit on a formation pitch', () => {
    expect(pitchName(player('Giorgos Papadopoulos', ['CB']), team('full'))).toBe('Papadopoulos');
    expect(pitchName(player('Pelé', ['ST']), team('full'))).toBe('Pelé');
  });

  it("follows the team's initials setting", () => {
    expect(pitchName(player('Giorgos Papadopoulos', ['CB']), team('initials'))).toBe('G.P.');
  });
});

describe('sortSquad', () => {
  it('orders by primary position from GK to ST, then by name', () => {
    const squad = [
      player('Zed', ['ST']),
      player('Bob', ['CB', 'DM']),
      player('Al', ['CB']),
      player('Kim', ['GK']),
      player('Eve', ['DM', 'CB']),
    ];
    expect(sortSquad(squad).map((p) => p.name)).toEqual(['Kim', 'Al', 'Bob', 'Eve', 'Zed']);
  });

  it('does not change the input array', () => {
    const squad = [player('B', ['ST']), player('A', ['GK'])];
    sortSquad(squad);
    expect(squad.map((p) => p.name)).toEqual(['B', 'A']);
  });
});
