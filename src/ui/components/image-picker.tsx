import { ImagePlusIcon, Trash2Icon } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Avatar } from './avatar';
import { Button } from './button';
import { resizeImageFile } from '../image';

export function ImagePicker({ value, onChange, kind, fallback, labels }: {
  value?: string;
  onChange: (value: string | undefined) => void;
  kind: 'player' | 'team';
  fallback?: string;
  labels: { choose: string; change: string; remove: string; error: string; hint: string };
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(false);
    try {
      onChange(await resizeImageFile(file, { mode: kind === 'player' ? 'cover' : 'contain' }));
    } catch {
      setError(true);
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar src={value} kind={kind} fallback={fallback} size="lg" />
      <div className="grid gap-1.5">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
            <ImagePlusIcon />
            {value ? labels.change : labels.choose}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
              <Trash2Icon />
              {labels.remove}
            </Button>
          )}
        </div>
        {error ? <p role="alert" className="text-xs text-destructive">{labels.error}</p> : <p className="text-xs text-muted-foreground">{labels.hint}</p>}
      </div>
      <input id={inputId} ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
