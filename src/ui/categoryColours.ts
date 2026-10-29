/** One colour per action group (catalog `groups`), used in the collector and the report. Keep in sync with the `--cat-*` tokens in index.css. */
const GROUP_COLOURS: Record<string, string> = {
  passing: 'var(--cat-passing)',
  shooting: 'var(--cat-shooting)',
  on_ball: 'var(--cat-onball)',
  errors: 'var(--cat-errors)',
  defending: 'var(--cat-defending)',
  duels: 'var(--cat-duels)',
  fouls: 'var(--cat-fouls)',
  goalkeeper: 'var(--cat-goalkeeper)',
  match: 'var(--cat-match)',
};

export const groupColour = (groupId: string | undefined) => GROUP_COLOURS[groupId ?? ''] ?? 'var(--cat-match)';
