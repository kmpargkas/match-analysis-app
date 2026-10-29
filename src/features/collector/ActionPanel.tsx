import { ChevronDownIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { actionCatalog, type ActionType } from '@/domain/catalog';
import { t } from '@/i18n';
import { Button } from '@/ui/components/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/ui/components/dropdown-menu';
import { groupColour } from './catalogView';
import { useCollectorActions } from './useCollectorActions';

interface PanelButton {
  key: string;
  type: ActionType;
  outcome?: string;
  label: string;
}

/** The key alone logs the type's first (successful) button; Shift+key logs the second. Types without outcomes have no Shift variant. */
const SHORTCUTS: Record<string, string> = {
  pass: 'p',
  cross: 'c',
  dribble: 'd',
  tackle: 't',
  interception: 'i',
  recovery: 'r',
  block: 'b',
  duel_ground: 'g',
  duel_aerial: 'a',
};

type SplitItem = { kind: 'split'; type: ActionType; success: PanelButton; fail: PanelButton; shortcut: string };
type PanelItem = { kind: 'single'; button: PanelButton; shortcut?: string } | SplitItem;

function buttonsOf(groupId: string): PanelButton[] {
  return actionCatalog.types
    .filter((type) => type.category === groupId)
    .flatMap((type) =>
      type.buttons?.length
        ? type.buttons.map((b) => ({ key: `${type.id}:${b.outcome ?? ''}`, type, outcome: b.outcome, label: b.labels.en }))
        : [{ key: type.id, type, label: type.labels.en }],
    );
}

const buttonsOfType = (type: ActionType) => buttonsOf(type.category).filter((b) => b.type === type);

/** A type with a shortcut and a ✓/✗ pair becomes one split button; everything else keeps one button per catalog button. */
function itemsOf(groupId: string): PanelItem[] {
  return buttonsOf(groupId).flatMap((button): PanelItem[] => {
    const shortcut = SHORTCUTS[button.type.id];
    const [success, fail, ...rest] = buttonsOfType(button.type);
    if (!shortcut || !success || !fail || rest.length) return [{ kind: 'single', button, shortcut }];
    return button.key === success.key ? [{ kind: 'split', type: button.type, success, fail, shortcut }] : [];
  });
}

const mainGroups = actionCatalog.groups.filter((g) => !g.more);
const moreGroups = actionCatalog.groups.filter((g) => g.more);
const mainItems = mainGroups.map((group) => ({ group, items: itemsOf(group.id) }));

export function ActionPanel() {
  const actions = useCollectorActions();
  const log = (b: PanelButton) => void actions.logAction(b.type, b.outcome);
  useActionShortcuts(log);

  return (
    <section aria-label={t('collector.actions.title')} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-surface">
      <div className="flex items-center gap-3 border-b px-4 py-1">
        <h2 className="font-semibold">{t('collector.actions.title')}</h2>
        <div className="flex-1" />
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {t('collector.actions.more')}
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {moreGroups.map((group, i) => (
              <div key={group.id} role="group" aria-label={group.labels.en}>
                {i > 0 && <DropdownMenuSeparator />}
                <p className="px-2 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{group.labels.en}</p>
                {buttonsOf(group.id).map((b) => (
                  <DropdownMenuItem key={b.key} onSelect={() => log(b)}>
                    <span className="size-2 rounded-full" style={{ backgroundColor: groupColour(group.id) }} />
                    {b.label}
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex min-h-0 flex-1 flex-wrap content-start gap-x-5 gap-y-2 overflow-y-auto px-4 py-2.5">
        {mainItems.map(({ group, items }) => (
          <div key={group.id} role="group" aria-label={group.labels.en} className="flex min-w-0 flex-col gap-0.5">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{group.labels.en}</p>
            <div className="flex flex-wrap gap-1.5">
              {items.map((item) =>
                item.kind === 'split' ? (
                  <SplitButton key={item.type.id} item={item} colour={groupColour(group.id)} onLog={log} />
                ) : (
                  <button
                    key={item.button.key}
                    type="button"
                    onClick={() => log(item.button)}
                    aria-keyshortcuts={item.shortcut?.toUpperCase()}
                    className={buttonClass}
                  >
                    <span className="h-3.5 w-1 shrink-0 rounded-full" style={{ backgroundColor: groupColour(group.id) }} />
                    <span className="truncate">{item.button.label}</span>
                    {item.shortcut && <KeyHint>{item.shortcut.toUpperCase()}</KeyHint>}
                  </button>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const buttonClass =
  'flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-lg border bg-background px-2.5 text-left text-sm font-medium whitespace-nowrap transition-colors outline-none hover:border-primary/60 hover:bg-primary-soft/40 focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px';

const halfClass =
  'flex h-full cursor-pointer items-center gap-1.5 px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none hover:bg-primary-soft/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:translate-y-px';

function SplitButton({ item, colour, onLog }: { item: SplitItem; colour: string; onLog: (b: PanelButton) => void }) {
  const key = item.shortcut.toUpperCase();
  return (
    <div className="flex h-8 min-w-0 items-stretch overflow-hidden rounded-lg border bg-background transition-colors has-[:hover]:border-primary/60">
      <button type="button" onClick={() => onLog(item.success)} aria-label={item.success.label} aria-keyshortcuts={key} className={halfClass}>
        <span className="h-3.5 w-1 shrink-0 rounded-full" style={{ backgroundColor: colour }} />
        <span>{item.type.labels.en}</span>
        <span aria-hidden className="text-success">
          ✓
        </span>
        <KeyHint>{key}</KeyHint>
      </button>
      <span aria-hidden className="my-1.5 w-px bg-border" />
      <button type="button" onClick={() => onLog(item.fail)} aria-label={item.fail.label} aria-keyshortcuts={`Shift+${key}`} className={halfClass}>
        <span aria-hidden className="text-fail">
          ✗
        </span>
        <KeyHint>{`⇧${key}`}</KeyHint>
      </button>
    </div>
  );
}

function KeyHint({ children }: { children: string }) {
  return (
    <kbd aria-hidden className="rounded border bg-muted px-1 font-sans text-[10px] leading-4 font-semibold text-muted-foreground">
      {children}
    </kbd>
  );
}

const typeByShortcut = new Map(Object.entries(SHORTCUTS).map(([typeId, key]) => [key, actionCatalog.types.find((type) => type.id === typeId)!]));

/** Logs the shortcut's action like a click. Ignored while typing in a field or while a dialog or menu has focus. */
function useActionShortcuts(log: (b: PanelButton) => void) {
  const logRef = useRef(log);
  useEffect(() => {
    logRef.current = log;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const type = typeByShortcut.get(e.key.toLowerCase());
      if (!type) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      const button = buttonsOfType(type)[e.shiftKey ? 1 : 0];
      if (!button) return;
      e.preventDefault();
      logRef.current(button);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
