import { Toaster as Sonner } from 'sonner';

export { toast } from 'sonner';

export function Toaster({ theme }: { theme: 'light' | 'dark' | 'system' }) {
  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      toastOptions={{ classNames: { toast: '!bg-surface !text-surface-foreground !border-border' } }}
    />
  );
}
