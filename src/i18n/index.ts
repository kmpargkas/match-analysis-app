import { en, type MessageKey } from './en';

export type { MessageKey };

/** Translate a UI string. `{name}` placeholders are filled from `params`. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const message: string = en[key];
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
