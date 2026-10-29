import { HomeIcon, PlusCircleIcon, UsersIcon, type LucideIcon } from 'lucide-react';
import type { MessageKey } from '@/i18n';
import { paths } from './paths';

export interface NavItem {
  to: string;
  label: MessageKey;
  icon: LucideIcon;
  /** Only highlight on an exact match (Home would otherwise match every page). */
  end?: boolean;
}

/** Entries in the nav bar (the ☰ menu on narrow screens). A new page adds one line here. */
export const navItems: NavItem[] = [
  { to: paths.home, label: 'nav.home', icon: HomeIcon, end: true },
  { to: paths.newMatch, label: 'nav.newMatch', icon: PlusCircleIcon },
  { to: paths.squads, label: 'nav.squads', icon: UsersIcon },
];
