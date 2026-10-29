import { positionCatalog } from '@/domain/catalog';
import { cn } from '@/ui/cn';

const labels = new Map(positionCatalog.positions.map((p) => [p.id, p.labels.en]));

export function PositionChips({ positions, className }: { positions: string[]; className?: string }) {
  return (
    <span className={cn('flex flex-wrap gap-1', className)}>
      {positions.map((id, i) => (
        <span
          key={id}
          title={labels.get(id)}
          className={cn(
            'inline-flex h-5 min-w-8 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold tracking-wide',
            i === 0 ? 'bg-primary-soft text-primary-soft-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          {id}
        </span>
      ))}
    </span>
  );
}
