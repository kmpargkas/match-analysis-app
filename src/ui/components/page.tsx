import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { t } from '@/i18n';
import { Button } from './button';

export function Page({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <Page title={title}>
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">{t('app.comingSoon')}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/">{t('app.backHome')}</Link>
        </Button>
      </div>
    </Page>
  );
}
