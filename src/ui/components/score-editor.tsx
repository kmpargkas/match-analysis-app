import { MinusIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import type { Match } from '@/domain/schemas';
import { t } from '@/i18n';
import { Button } from './button';

/** The manual score: click a number to type it, or use − / +. */
export function ScoreEditor({ score, onChange }: { score: Match['score']; onChange: (score: Match['score']) => void }) {
  const side = (key: 'us' | 'them', label: string) => (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="size-7 print:hidden" aria-label={t('score.minus', { side: label })} disabled={score[key] === 0} onClick={() => onChange({ ...score, [key]: score[key] - 1 })}>
        <MinusIcon />
      </Button>
      <NumberField value={score[key]} label={label} onCommit={(value) => onChange({ ...score, [key]: value })} />
      <Button variant="ghost" size="icon" className="size-7 print:hidden" aria-label={t('score.plus', { side: label })} onClick={() => onChange({ ...score, [key]: score[key] + 1 })}>
        <PlusIcon />
      </Button>
    </div>
  );

  return (
    <div role="group" aria-label={t('score.label')} className="flex items-center gap-1 rounded-lg border bg-background px-1 py-0.5">
      {side('us', t('score.us'))}
      <span className="text-muted-foreground">–</span>
      {side('them', t('score.them'))}
    </div>
  );
}

/** A number shown as text; click to type a new value, Enter or leaving the field saves it. */
function NumberField({ value, label, onCommit }: { value: number; label: string; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const next = Number(draft);
    if (draft !== null && draft !== '' && Number.isInteger(next) && next >= 0 && next !== value) onCommit(next);
    setDraft(null);
  };

  if (draft === null) {
    return (
      <button type="button" aria-label={label} onClick={() => setDraft(String(value))} className="min-w-7 cursor-text rounded-md px-1 text-center text-lg font-bold tabular-nums hover:bg-muted">
        {value}
      </button>
    );
  }
  return (
    <input
      aria-label={label}
      autoFocus
      inputMode="numeric"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setDraft(null);
      }}
      className="w-8 rounded-md border bg-surface text-center text-lg font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring"
    />
  );
}
