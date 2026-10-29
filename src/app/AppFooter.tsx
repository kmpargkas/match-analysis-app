import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import { requestPersistentStorage } from '@/platform/storagePersistence';
import { cn } from '@/ui/cn';

export function AppFooter() {
  const persisted = useStoragePersisted();

  return (
    <footer className="print:hidden border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4 text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{t('app.name')}</span> · {t('footer.version', { version: __APP_VERSION__ })}
        </p>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <li>{t('footer.localData')}</li>
          <li>{t('footer.noTracking')}</li>
          <li className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn('size-1.5 rounded-full', persisted === undefined ? 'bg-muted-foreground' : persisted ? 'bg-primary' : 'bg-warning')}
            />
            {persisted === undefined ? t('footer.storage.checking') : persisted ? t('footer.storage.persisted') : t('footer.storage.notPersisted')}
          </li>
        </ul>
      </div>
    </footer>
  );
}

function useStoragePersisted(): boolean | undefined {
  const [persisted, setPersisted] = useState<boolean>();
  useEffect(() => {
    let active = true;
    void requestPersistentStorage().then((value) => active && setPersisted(value));
    return () => {
      active = false;
    };
  }, []);
  return persisted;
}
