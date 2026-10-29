import { AlertDialog as AlertPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../cn';
import { buttonVariants } from './button';

export const AlertDialog = AlertPrimitive.Root;

export function AlertDialogContent({ className, children, ...props }: ComponentProps<typeof AlertPrimitive.Content>) {
  return (
    <AlertPrimitive.Portal>
      <AlertPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay" />
      <AlertPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-surface p-6 text-surface-foreground shadow-xl',
          className,
        )}
        {...props}
      >
        {children}
      </AlertPrimitive.Content>
    </AlertPrimitive.Portal>
  );
}

export function AlertDialogTitle({ className, ...props }: ComponentProps<typeof AlertPrimitive.Title>) {
  return <AlertPrimitive.Title className={cn('text-lg font-semibold', className)} {...props} />;
}

export function AlertDialogDescription({ className, ...props }: ComponentProps<typeof AlertPrimitive.Description>) {
  return <AlertPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex justify-end gap-2', className)} {...props} />;
}

export function AlertDialogCancel({ className, ...props }: ComponentProps<typeof AlertPrimitive.Cancel>) {
  return <AlertPrimitive.Cancel className={cn(buttonVariants({ variant: 'outline' }), className)} {...props} />;
}

export function AlertDialogAction({ className, ...props }: ComponentProps<typeof AlertPrimitive.Action>) {
  return <AlertPrimitive.Action className={cn(buttonVariants({ variant: 'destructive' }), className)} {...props} />;
}
