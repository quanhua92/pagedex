import React, { useState } from 'react';
import { Lock } from 'lucide-react';

export default function LoginScreen({ onAuthenticated }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const clean = token.trim();
    if (!clean) {
      setError('Please enter an access token');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: clean })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Invalid token');
        return;
      }
      setToken('');
      onAuthenticated();
    } catch {
      setError('Network error while signing in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="modal login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <img src="/pagedex-logo.svg" alt="PageDex" width="44" height="44" className="brand-logo" />
          <div>
            <h2>PageDex</h2>
            <p className="modal-note">Enter your access token to unlock this vault.</p>
          </div>
        </div>
        <div className="field">
          <label htmlFor="pagedex-auth-token">Access token</label>
          <input
            id="pagedex-auth-token"
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="Paste token..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={busy}
          />
        </div>
        {error && <div className="login-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="submit" className="btn primary" disabled={busy}>
            <Lock size={14} strokeWidth={2} />
            <span>{busy ? 'Unlocking...' : 'Unlock'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
