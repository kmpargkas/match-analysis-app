import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../cn';

const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    variant: {
      primary: 'bg-primary-soft text-primary-soft-foreground',
      muted: 'bg-muted text-muted-foreground',
      warning: 'bg-warning-soft text-warning-soft-foreground',
    },
  },
  defaultVariants: { variant: 'muted' },
});

export function Badge({ className, variant, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
