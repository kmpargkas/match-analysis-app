import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import type { MatchLogRow } from '@/domain/matches/matchLog';
import { t } from '@/i18n';
import { useRepositories } from '@/storage';
import { Button } from '@/ui/components/button';
import { Page } from '@/ui/components/page';
import { toast } from '@/ui/components/toaster';
import { BackupControls } from './BackupControls';
import { DeleteMatchDialog } from './DeleteMatchDialog';
import { EmptyState } from './EmptyState';
import { MatchLogTable } from './MatchLogTable';
import { useMatchLog } from './useMatchLog';

export function HomePage() {
  const repos = useRepositories();
  const log = useMatchLog();
  const [pendingDelete, setPendingDelete] = useState<MatchLogRow | null>(null);

  async function confirmDelete(row: MatchLogRow) {
    setPendingDelete(null);
    await repos.matches.softDelete(row.matchId);
    toast.success(t('home.delete.done'));
  }

  return (
    <Page
      title={t('home.title')}
      subtitle={t('home.subtitle')}
      actions={
        <>
          <BackupControls hasData={!!log?.rows.length} />
          <Button asChild>
            <Link to={paths.newMatch}>
              <PlusIcon />
              {t('home.newMatch')}
            </Link>
          </Button>
        </>
      }
    >
      {log === undefined ? (
        <p className="py-16 text-center text-sm text-muted-foreground" role="status">
          {t('home.loading')}
        </p>
      ) : log.rows.length === 0 ? (
        <EmptyState hasTeams={log.hasTeams} />
      ) : (
        <MatchLogTable rows={log.rows} onDelete={setPendingDelete} />
      )}

      <DeleteMatchDialog row={pendingDelete} onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete} />
    </Page>
  );
}
