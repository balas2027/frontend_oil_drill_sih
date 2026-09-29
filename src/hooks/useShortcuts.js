import { useEffect, useRef } from 'react';

/** Section 9 usability: "/" to search, "g m" for map, ... ("?" lists them). */
export const SHORTCUTS = [
  { keys: ['/'], action: 'search', labelKey: 'shortcuts.search' },
  { keys: ['g', 'd'], action: '/dashboard', labelKey: 'shortcuts.go_dashboard' },
  { keys: ['g', 'm'], action: '/map', labelKey: 'shortcuts.go_map' },
  { keys: ['g', 'a'], action: '/alerts', labelKey: 'shortcuts.go_alerts' },
  { keys: ['g', 'c'], action: '/correlation', labelKey: 'shortcuts.go_correlation' },
  { keys: ['g', 'o'], action: '/documents', labelKey: 'shortcuts.go_documents' },
  { keys: ['?'], action: 'help', labelKey: 'shortcuts.help' },
];

const CHORD_MS = 1200;

/**
 * Resolve a key press given the pending chord prefix.
 * @returns {{action: string|null, pending: string|null}}
 */
export function resolveShortcut(pending, key) {
  const seq = pending ? [pending, key] : [key];
  const hit = SHORTCUTS.find(
    (s) => s.keys.length === seq.length && s.keys.every((k, i) => k === seq[i])
  );
  if (hit) return { action: hit.action, pending: null };
  const isPrefix = !pending && SHORTCUTS.some((s) => s.keys.length > 1 && s.keys[0] === key);
  return { action: null, pending: isPrefix ? key : null };
}

function isTyping(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Global shortcut listener; `onAction(action)` gets a route or 'search' / 'help'. */
export function useShortcuts(onAction) {
  const handler = useRef(onAction);
  handler.current = onAction;

  useEffect(() => {
    let pending = null;
    let timer = null;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const r = resolveShortcut(pending, e.key);
      clearTimeout(timer);
      pending = r.pending;
      if (pending) timer = setTimeout(() => (pending = null), CHORD_MS);
      if (r.action) {
        e.preventDefault();
        handler.current(r.action);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  }, []);
}
