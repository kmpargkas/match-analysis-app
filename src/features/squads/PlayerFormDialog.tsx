import { useId, useState, type FormEvent } from 'react';
import type { Player } from '@/domain/schemas';
import { initials } from '@/domain/squads/players';
import { validatePositions } from '@/domain/squads/positions';
import { t } from '@/i18n';
import { useRepositories } from '@/storage';
import { Button } from '@/ui/components/button';
import { Dialog, DialogBody, DialogContent, DialogForm, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/components/dialog';
import { Field, Input } from '@/ui/components/form';
import { ImagePicker } from '@/ui/components/image-picker';
import { toast } from '@/ui/components/toaster';
import { imageLabels } from './imageLabels';
import { PositionPicker } from './PositionPicker';

export function PlayerFormDialog({ open, onOpenChange, teamId, teamName, player }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  player?: Player;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')} className="max-w-xl">
        <PlayerForm teamId={teamId} teamName={teamName} player={player} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PlayerForm({ teamId, teamName, player, onDone }: { teamId: string; teamName: string; player?: Player; onDone: () => void }) {
  const repos = useRepositories();
  const nameId = useId();
  const [name, setName] = useState(player?.name ?? '');
  const [photo, setPhoto] = useState(player?.photo);
  const [positions, setPositions] = useState<string[]>(player?.positions ?? []);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const nameError = submitted && !name.trim() ? t('player.form.nameRequired') : undefined;
  const positionsError = submitted && validatePositions(positions) ? t('player.form.positionsRequired') : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!name.trim() || validatePositions(positions)) return;
    setSaving(true);
    try {
      const values = { name: name.trim(), photo, positions };
      if (player) await repos.players.update(player.id, values);
      else await repos.players.create({ ...values, teamId });
      toast.success(player ? t('player.saved') : t('player.added'));
      onDone();
    } catch {
      toast.error(t('common.saveFailed'));
      setSaving(false);
    }
  }

  return (
    <DialogForm onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>{player ? t('player.form.editTitle') : t('player.form.addTitle')}</DialogTitle>
        <DialogDescription>{teamName}</DialogDescription>
      </DialogHeader>

      <DialogBody className="gap-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Field label={t('player.form.name')} htmlFor={nameId} error={nameError}>
            <Input id={nameId} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('player.form.namePlaceholder')} aria-invalid={!!nameError} autoFocus />
          </Field>
          <Field label={t('player.form.photo')} optional optionalLabel={t('common.optional')}>
            <ImagePicker kind="player" value={photo} onChange={setPhoto} fallback={initials(name)} labels={imageLabels()} />
          </Field>
        </div>

        <Field label={t('player.form.positions')} hint={t('player.form.positionsHint')} error={positionsError}>
          <PositionPicker value={positions} onChange={setPositions} invalid={!!positionsError} />
        </Field>
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t('common.saving') : player ? t('common.save') : t('player.form.add')}
        </Button>
      </DialogFooter>
    </DialogForm>
  );
}
