import { useId, useState, type FormEvent } from 'react';
import type { Team } from '@/domain/schemas';
import { t } from '@/i18n';
import { useRepositories } from '@/storage';
import { Button } from '@/ui/components/button';
import { Dialog, DialogBody, DialogContent, DialogForm, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/components/dialog';
import { Field, Input, Label, Switch } from '@/ui/components/form';
import { ImagePicker } from '@/ui/components/image-picker';
import { toast } from '@/ui/components/toaster';
import { imageLabels } from './imageLabels';

export function TeamFormDialog({ open, onOpenChange, team, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Team;
  onSaved?: (team: Team) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')}>
        {/* Mounted only while open, so every opening starts from the stored values. */}
        <TeamForm team={team} onDone={(saved) => { onOpenChange(false); onSaved?.(saved); }} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function TeamForm({ team, onDone, onCancel }: { team?: Team; onDone: (team: Team) => void; onCancel: () => void }) {
  const repos = useRepositories();
  const ids = { name: useId(), coach: useId(), initials: useId() };
  const [name, setName] = useState(team?.name ?? '');
  const [logo, setLogo] = useState(team?.logo);
  const [coachName, setCoachName] = useState(team?.coachName ?? '');
  const [initials, setInitials] = useState(team?.nameDisplay === 'initials');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const nameError = submitted && !name.trim() ? t('team.form.nameRequired') : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!name.trim()) return;
    setSaving(true);
    try {
      const values = { name: name.trim(), logo, coachName: coachName.trim() || undefined, nameDisplay: initials ? 'initials' : 'full' } as const;
      const saved = team ? await repos.teams.update(team.id, values) : await repos.teams.create(values);
      toast.success(team ? t('team.saved') : t('team.created'));
      onDone(saved);
    } catch {
      toast.error(t('common.saveFailed'));
      setSaving(false);
    }
  }

  return (
    <DialogForm onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>{team ? t('team.form.editTitle') : t('team.form.createTitle')}</DialogTitle>
        <DialogDescription>{t('team.form.description')}</DialogDescription>
      </DialogHeader>

      <DialogBody>
        <Field label={t('team.form.name')} htmlFor={ids.name} error={nameError}>
          <Input id={ids.name} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('team.form.namePlaceholder')} aria-invalid={!!nameError} autoFocus />
        </Field>

        <Field label={t('team.form.logo')} optional optionalLabel={t('common.optional')}>
          <ImagePicker kind="team" value={logo} onChange={setLogo} labels={imageLabels()} />
        </Field>

        <Field label={t('team.form.coach')} htmlFor={ids.coach} optional optionalLabel={t('common.optional')}>
          <Input id={ids.coach} value={coachName} onChange={(e) => setCoachName(e.target.value)} />
        </Field>

        <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <div className="grid gap-0.5">
            <Label htmlFor={ids.initials}>{t('team.form.initials')}</Label>
            <p className="text-xs text-muted-foreground">{t('team.form.initialsHint')}</p>
          </div>
          <Switch id={ids.initials} checked={initials} onCheckedChange={setInitials} />
        </div>
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t('common.saving') : team ? t('common.save') : t('team.form.create')}
        </Button>
      </DialogFooter>
    </DialogForm>
  );
}
