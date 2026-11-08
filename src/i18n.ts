import { useCallback, useSyncExternalStore } from 'react';
/**
 * Sinhala and Tamil for the storefront. The English text is the key, so a string that has no translation
 * simply shows in English. Placeholders look like {n} and are filled from the second argument.
 * The admin stays in English.
 */
export type Lang = 'en' | 'si' | 'ta';
export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'si', label: 'සිංහල', short: 'සි' },
  { id: 'ta', label: 'தமிழ்', short: 'த' },
];
// The Sinhala and Tamil word lists are only downloaded when someone actually chooses that language.
const DICT: Record<Lang, Record<string, string>> = { en: {}, si: {}, ta: {} };
const loaded: Record<Lang, boolean> = { en: true, si: false, ta: false };
export async function loadLang(l: Lang): Promise<void> {
  if (loaded[l]) return;
  try {
    DICT[l] = l === 'si' ? (await import('./lang/si')).SI : (await import('./lang/ta')).TA;
    loaded[l] = true;
  } catch { /* offline or blocked: stay in English */ }
}
const KEY = 'ee_lang';
const EVT = 'ee-lang';

const read = (): Lang => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'si' || v === 'ta' || v === 'en') return v;
  } catch { /* ignore */ }
  return 'en';
};

export function setLang(l: Lang) {
  // load the words first so the page switches in one go, with no flash of English
  void loadLang(l).then(() => {
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
    document.documentElement.lang = l;
    window.dispatchEvent(new Event(EVT));
  });
}

const sub = (cb: () => void) => { window.addEventListener(EVT, cb); return () => window.removeEventListener(EVT, cb); };
export const useLang = (): Lang => useSyncExternalStore(sub, read, () => 'en');

/** Translate outside React (uses the current language). */
export function tr(s: string, vars?: Record<string, string | number>): string {
  const text = DICT[read()][s] ?? s;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

/** The translate function for a component; it re-renders when the language changes. */
export function useT() {
  const lang = useLang();
  return useCallback((s: string, vars?: Record<string, string | number>) => {
    const text = DICT[lang][s] ?? s;
    return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
  }, [lang]);
}

/** On first load: set <html lang> and fetch the saved language's words (resolves at once for English). */
export function initLang(): Promise<void> {
  document.documentElement.lang = read();
  return loadLang(read());
}
