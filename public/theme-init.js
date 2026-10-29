// Keep in sync with src/ui/theme.ts (storage key and values).
try {
  var pref = localStorage.getItem('theme') || 'system';
  var dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
} catch (e) {
  // Storage blocked: fall back to the light theme.
}
