'use client';
import { useEffect, useState } from 'react';
export const themes = {
  pink: 'ורוד בהיר',
  purple: 'סגול',
  blue: 'כחול',
  green: 'ירוק',
  peach: 'אפרסק',
};
type Theme = keyof typeof themes;
export function ThemeInit() {
  useEffect(() => {
    try {
      const theme = localStorage.getItem('nofer-theme');
      if (theme && theme in themes) document.documentElement.dataset.theme = theme;
    } catch {
      /* The default remains usable when storage is unavailable. */
    }
  }, []);
  return null;
}
export function ThemeSettings() {
  const [selected, setSelected] = useState<Theme>(() => {
    const theme =
      typeof document !== 'undefined' ? document.documentElement.dataset.theme : undefined;
    return theme && theme in themes ? (theme as Theme) : 'pink';
  });
  const [message, setMessage] = useState('');
  return (
    <section className="panel">
      <h2>צבעי המערכת</h2>
      <p className="muted">בחרי צבע מוביל. הבחירה נשמרת במכשיר הזה.</p>
      <div className="theme-options">
        {Object.entries(themes).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={selected === key ? 'primary' : 'secondary'}
            aria-pressed={selected === key}
            onClick={() => {
              setSelected(key as Theme);
              document.documentElement.dataset.theme = key;
              try {
                localStorage.setItem('nofer-theme', key);
                setMessage('הצבע נשמר');
              } catch {
                setMessage('הצבע עודכן. שמירה במכשיר אינה זמינה');
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p role="status">{message}</p>
    </section>
  );
}
