import { ShieldIcon } from 'lucide-react';
import { cn } from '../cn';

const sizes = { sm: 'size-9 text-xs', md: 'size-11 text-sm', lg: 'size-16 text-lg' } as const;

export function Avatar({ src, fallback, face = false, kind = 'player', size = 'md', className }: {
  src?: string;
  /** Initials shown when there is no player photo. */
  fallback?: string;
  /** Show a default face instead of initials when there is no player photo. */
  face?: boolean;
  kind?: 'player' | 'team';
  size?: keyof typeof sizes;
  className?: string;
}) {
  const shape = kind === 'player' ? 'rounded-full' : 'rounded-xl';
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden font-semibold',
        sizes[size],
        shape,
        src ? (kind === 'team' ? 'bg-surface ring-1 ring-border' : 'bg-muted') : 'bg-primary-soft text-primary-soft-foreground',
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className={cn('size-full', kind === 'player' ? 'object-cover' : 'object-contain p-1')} />
      ) : kind === 'team' ? (
        <ShieldIcon className="size-1/2" />
      ) : face ? (
        <DefaultFace />
      ) : (
        fallback?.replace(/\./g, '').slice(0, 2)
      )}
    </span>
  );
}

function DefaultFace() {
  return (
    <svg viewBox="0 0 24 24" className="mt-[18%] size-[88%] self-end fill-current opacity-45">
      <circle cx="12" cy="9.5" r="4.6" />
      <path d="M3.5 24c0-5.2 3.8-8.6 8.5-8.6s8.5 3.4 8.5 8.6z" />
    </svg>
  );
}
