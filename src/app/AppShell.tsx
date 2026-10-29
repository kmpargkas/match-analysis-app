import { CheckIcon, MenuIcon, MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useMatches } from 'react-router';
import { t } from '@/i18n';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/components/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/components/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/ui/components/sheet';
import { Toaster } from '@/ui/components/toaster';
import { LogoMark } from '@/ui/LogoMark';
import { useTheme, type ThemePreference } from '@/ui/theme';
import { AppFooter } from './AppFooter';
import { navItems } from './nav';
import { paths, type RouteHandle } from './paths';

const themeOptions: { value: ThemePreference; label: 'theme.light' | 'theme.dark' | 'theme.system'; icon: typeof SunIcon }[] = [
  { value: 'light', label: 'theme.light', icon: SunIcon },
  { value: 'dark', label: 'theme.dark', icon: MoonIcon },
  { value: 'system', label: 'theme.system', icon: MonitorIcon },
];

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { preference, setPreference } = useTheme();
  const fill = useMatches().some((m) => (m.handle as RouteHandle | undefined)?.layout === 'fill');

  return (
    <div className={cn('flex flex-col', fill ? 'h-dvh overflow-hidden' : 'min-h-screen')}>
      <header className="sticky top-0 z-40 border-b print:hidden bg-background/85 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('nav.open')}>
                <MenuIcon className="!size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent closeLabel={t('nav.close')}>
              <div className="flex h-14 items-center gap-2 border-b px-5">
                <LogoMark className="text-primary" />
                <SheetTitle>{t('app.name')}</SheetTitle>
                <SheetDescription className="sr-only">{t('nav.title')}</SheetDescription>
              </div>

              <nav className="flex flex-1 flex-col gap-1 p-3" aria-label={t('nav.title')}>
                {navItems.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted',
                        isActive && 'bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft',
                      )
                    }
                  >
                    <Icon className="size-4" />
                    {t(label)}
                  </NavLink>
                ))}
              </nav>

              <div className="border-t p-4">
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('nav.theme')}</p>
                <div role="radiogroup" aria-label={t('nav.theme')} className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                  {themeOptions.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={preference === value}
                      onClick={() => setPreference(value)}
                      className={cn(
                        'flex cursor-pointer flex-col items-center gap-1 rounded-md py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        preference === value && 'bg-surface text-foreground shadow-sm',
                      )}
                    >
                      <Icon className="size-4" />
                      {t(label)}
                    </button>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Link to={paths.home} className="flex items-center gap-2 font-semibold tracking-tight">
            <LogoMark className="text-primary" />
            {t('app.name')}
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label={t('nav.title')}>
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                    isActive && 'bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft hover:text-primary-soft-foreground',
                  )
                }
              >
                <Icon className="size-4" />
                {t(label)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto hidden md:block">
            <ThemeMenu preference={preference} onChange={setPreference} />
          </div>
        </div>
      </header>

      <main className={cn('flex-1', fill && 'min-h-0')}>
        <Outlet />
      </main>

      {!fill && <AppFooter />}

      <Toaster theme={preference} />
    </div>
  );
}

function ThemeMenu({ preference, onChange }: { preference: ThemePreference; onChange: (pref: ThemePreference) => void }) {
  const CurrentIcon = themeOptions.find((o) => o.value === preference)?.icon ?? MonitorIcon;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('nav.theme')} title={t('nav.theme')}>
          <CurrentIcon className="!size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => onChange(value)}>
            <Icon />
            <span className="flex-1">{t(label)}</span>
            {preference === value && <CheckIcon />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
