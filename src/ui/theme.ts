import { useCallback, useEffect, useState } from 'react';

// Keep in sync with public/theme-init.js, which applies the theme before first paint.
const STORAGE_KEY = 'theme';

export type ThemePreference = 'light' | 'dark' | 'system';

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function applyPreference(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);

  useEffect(() => {
    applyPreference(preference);
    if (preference !== 'system') return;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyPreference('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // Storage blocked: the choice lasts for this session only.
    }
    setPreferenceState(pref);
  }, []);

  return { preference, setPreference };
}
