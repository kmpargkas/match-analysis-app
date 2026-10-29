import { describe, expect, it } from 'vitest';
import { t } from '.';

describe('t', () => {
  it('returns the English string', () => {
    expect(t('home.title')).toBe('Matches');
  });

  it('fills placeholders and leaves unknown ones visible', () => {
    expect(t('home.incompleteCount', { count: 3 })).toBe('3 incomplete');
    expect(t('home.delete.body', { match: 'U14 vs Atromitos' })).toBe('U14 vs Atromitos and its {count} events will be removed from your match log.');
  });
});
