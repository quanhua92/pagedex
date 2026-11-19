import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

export default function LoginScreen({ vaults = [], defaultVault = '', onAuthenticated }) {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [selectedVault, setSelectedVault] = useState(() => defaultVault || vaults[0]?.id || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const effectiveVault = selectedVault || defaultVault || vaults[0]?.id || '';

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
      const payload = { token: clean };
      if (effectiveVault) payload.vault = effectiveVault;
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
        {vaults.length > 1 && (
          <div className="field">
            <label htmlFor="pagedex-auth-vault">Vault</label>
            <select
              id="pagedex-auth-vault"
              value={effectiveVault}
              onChange={(e) => setSelectedVault(e.target.value)}
              disabled={busy}
            >
              {vaults.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="pagedex-auth-token">Access token</label>
          <div className="password-input-wrap">
            <input
              id="pagedex-auth-token"
              type={showToken ? 'text' : 'password'}
              autoFocus
              autoComplete="current-password"
              placeholder="Paste token..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={busy}
            />
            <button
              type="button"
              className="password-toggle-btn"
              aria-label={showToken ? 'Hide token' : 'Show token'}
              title={showToken ? 'Hide token' : 'Show token'}
              onClick={() => setShowToken((s) => !s)}
              disabled={busy}
            >
              {showToken ? <EyeOff size={15} strokeWidth={1.9} /> : <Eye size={15} strokeWidth={1.9} />}
            </button>
          </div>
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
