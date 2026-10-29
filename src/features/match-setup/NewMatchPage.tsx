import { CheckCircle2Icon, CircleAlertIcon, PlayIcon } from 'lucide-react';
import { useReducer, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { paths } from '@/app/paths';
import { emptyDraft, lineupReducer, toLineupEntries, validateLineup } from '@/domain/lineup';
import type { Team } from '@/domain/schemas';
import { sortSquad } from '@/domain/squads/players';
import { t } from '@/i18n';
import { useRepoQuery, useRepositories } from '@/storage';
import { Button } from '@/ui/components/button';
import { Page } from '@/ui/components/page';
import { toast } from '@/ui/components/toaster';
import { LineupSection } from './LineupSection';
import { emptyInfo, type MatchInfo } from './matchInfo';
import { MatchInfoSection } from './MatchInfoSection';
import { MatchdaySquadSection } from './MatchdaySquadSection';
import { setupProblems } from './setupProblems';
import { TeamSection } from './TeamSection';

/** Nothing is saved until "Start collecting", which stores the match and its lineup together. */
export function NewMatchPage() {
  const repos = useRepositories();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [teamId, setTeamId] = useState<string | undefined>(params.get('team') ?? undefined);
  const [info, setInfo] = useState<MatchInfo>(emptyInfo);
  const [draft, dispatch] = useReducer(lineupReducer, emptyDraft);
  const [saving, setSaving] = useState(false);

  const teams = useRepoQuery(async () => {
    const all = await repos.teams.list();
    const withCounts = await Promise.all(
      all.map(async (team) => ({ team, playerCount: (await repos.players.listByTeam(team.id)).filter((p) => !p.archived).length })),
    );
    return withCounts.sort((a, b) => a.team.name.localeCompare(b.team.name));
  }, [repos]);

  const team: Team | undefined = teams?.find((x) => x.team.id === teamId)?.team;
  const squad = useRepoQuery(async () => (teamId ? sortSquad((await repos.players.listByTeam(teamId)).filter((p) => !p.archived)) : []), [repos, teamId]);

  const coachName = info.coachName ?? team?.coachName ?? '';
  const problems = setupProblems({ team, info, lineupProblems: validateLineup(draft) });

  function changeTeam(id: string | undefined) {
    setTeamId(id);
    dispatch({ type: 'reset' });
    setInfo((current) => ({ ...current, coachName: undefined }));
  }

  async function start() {
    if (!team || problems.length > 0) return;
    setSaving(true);
    try {
      const optional = (value: string) => value.trim() || undefined;
      const match = await repos.matches.createWithLineup(
        {
          teamId: team.id,
          opponentName: info.opponentName.trim(),
          date: info.date,
          kickoffTime: optional(info.kickoffTime),
          competition: optional(info.competition),
          venue: optional(info.venue),
          homeAway: info.homeAway,
          formationId: draft.formationId!,
          coachName: optional(coachName),
          notes: optional(info.notes),
        },
        toLineupEntries(draft),
      );
      toast.success(t('matchSetup.created'));
      navigate(paths.collector(match.id));
    } catch {
      toast.error(t('common.saveFailed'));
      setSaving(false);
    }
  }

  return (
    <Page title={t('matchSetup.title')} subtitle={t('matchSetup.subtitle')}>
      <div className="grid gap-6">
        <Section step={1} title={t('matchSetup.team.title')} hint={team ? undefined : t('matchSetup.team.hint')}>
          <TeamSection teams={teams} team={team} hasLineup={draft.squad.length > 0} onPick={changeTeam} onChange={() => changeTeam(undefined)} />
        </Section>

        {team && squad && (
          <>
            <Section step={2} title={t('matchSetup.info.title')}>
              <MatchInfoSection info={info} coachName={coachName} onChange={(changes) => setInfo((current) => ({ ...current, ...changes }))} />
            </Section>

            <Section step={3} title={t('matchSetup.squad.title')} hint={t('matchSetup.squad.hint')}>
              <MatchdaySquadSection team={team} players={squad} draft={draft} dispatch={dispatch} />
            </Section>

            <Section step={4} title={t('matchSetup.lineup.title')} hint={t('matchSetup.lineup.hint')}>
              <LineupSection team={team} players={squad} draft={draft} dispatch={dispatch} />
            </Section>
          </>
        )}
      </div>

      <footer className="sticky bottom-4 z-20 mt-6 rounded-2xl border bg-surface/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="flex items-center gap-4 px-5 py-3">
          <div className="min-w-0 flex-1" aria-live="polite">
            {problems.length === 0 ? (
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <CheckCircle2Icon className="size-4" />
                {t('matchSetup.ready')}
              </p>
            ) : (
              <div className="flex items-start gap-2 text-sm">
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
                <p className="min-w-0">
                  <span className="font-medium">{t('matchSetup.missing')}: </span>
                  <span className="text-muted-foreground">{problems.join(' · ')}</span>
                </p>
              </div>
            )}
          </div>
          <Button asChild variant="ghost">
            <Link to={paths.home}>{t('matchSetup.cancel')}</Link>
          </Button>
          <Button size="lg" disabled={problems.length > 0 || saving} onClick={start}>
            <PlayIcon />
            {saving ? t('matchSetup.starting') : t('matchSetup.start')}
          </Button>
        </div>
      </footer>
    </Page>
  );
}

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: ReactNode }) {
  const id = `setup-step-${step}`;
  return (
    <section aria-labelledby={id} className="rounded-2xl border bg-surface p-6 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{step}</span>
        <div>
          <h2 id={id} className="text-lg leading-7 font-semibold">
            {title}
          </h2>
          {hint && <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
