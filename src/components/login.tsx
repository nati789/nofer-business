'use client';
import { useState } from 'react';
import { Flower2, ArrowLeft } from 'lucide-react';
export default function Login({ configured }: { configured: boolean }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <div className="login-card">
        <span className="brand-mark">
          <Flower2 size={32} />
        </span>
        <h1>העסק של נופר</h1>
        <p>כל מה שצריך, במקום אחד.</p>
        {configured ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                const res = await fetch('/api/auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password: new FormData(e.currentTarget).get('password') }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                window.location.assign(new URL('/', window.location.origin).href);
              } catch (err) {
                setError((err as Error).message);
                setBusy(false);
              }
            }}
          >
            <label>
              סיסמה
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                autoFocus
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              כניסה לעסק <ArrowLeft size={18} />
            </button>
          </form>
        ) : (
          <div className="notice">המערכת מוכנה. כדי להתחיל, יש להשלים את הגדרת הגישה המאובטחת.</div>
        )}
      </div>
    </main>
  );
}
