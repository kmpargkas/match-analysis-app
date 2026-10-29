import { useId, useState, type FormEvent } from 'react';
import { t } from '@/i18n';
import { Button } from '@/ui/components/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogForm, DialogHeader, DialogTitle } from '@/ui/components/dialog';
import { Label, Switch } from '@/ui/components/form';
import { useCollectorContext } from './context';
import { useCollectorActions } from './useCollectorActions';

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')} className="max-w-lg">
        <SettingsForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({ onDone }: { onDone: () => void }) {
  const { data } = useCollectorContext();
  const actions = useCollectorActions();
  const id = useId();
  const { settings } = data.match;
  const [autoOpen, setAutoOpen] = useState(settings.autoOpenPlayerSearch);

  async function submit(e: FormEvent) {
    e.preventDefault();
    await actions.updateSettings({ ...settings, autoOpenPlayerSearch: autoOpen });
    onDone();
  }

  return (
    <DialogForm onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>{t('collector.settings.title')}</DialogTitle>
      </DialogHeader>
      <DialogBody className="gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor={`${id}-auto`}>{t('collector.settings.autoOpen')}</Label>
            <p className="text-xs text-muted-foreground">{t('collector.settings.autoOpenHint')}</p>
          </div>
          <Switch id={`${id}-auto`} checked={autoOpen} onCheckedChange={setAutoOpen} />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit">
          {t('common.save')}
        </Button>
      </DialogFooter>
    </DialogForm>
  );
}
