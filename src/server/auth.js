import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import {
  getActiveVault,
  getDefaultVault,
  getVault,
  isMultiVault,
  isVaultReadOnly,
  listVaults
} from './vault-manager.js';

const COOKIE_NAME = 'pagedex_auth';
const VAULT_COOKIE_NAME = 'pagedex_vault';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const rateState = { failures: [], lockedUntil: 0 };

function readPositiveInt(envVal, fallback) {
  const n = Number(envVal);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function getRateLimitConfig() {
  return {
    maxAttempts: readPositiveInt(process.env.PAGEDEX_AUTH_MAX_ATTEMPTS, 5),
    windowMs: readPositiveInt(process.env.PAGEDEX_AUTH_WINDOW_MS, 60_000),
    lockoutMs: readPositiveInt(process.env.PAGEDEX_AUTH_LOCKOUT_MS, 60_000)
  };
}

export function resetAuthRateLimit() {
  rateState.failures = [];
  rateState.lockedUntil = 0;
}

function getLockRemainingSeconds(now = Date.now()) {
  if (now >= rateState.lockedUntil) return 0;
  return Math.max(1, Math.ceil((rateState.lockedUntil - now) / 1000));
}

function recordLoginFailure(now = Date.now()) {
  const { maxAttempts, windowMs, lockoutMs } = getRateLimitConfig();
  const cutoff = now - windowMs;
  rateState.failures = rateState.failures.filter((ts) => ts > cutoff);
  rateState.failures.push(now);
  if (rateState.failures.length >= maxAttempts) {
    rateState.lockedUntil = now + lockoutMs;
    rateState.failures = [];
  }
}

export function isVaultAuthEnabled(vault = getActiveVault()) {
  if (!vault) return Boolean(process.env.PAGEDEX_AUTH_TOKEN_FILE);
  return Boolean(vault.authTokenFile || (vault.allowGlobalAuth && process.env.PAGEDEX_AUTH_TOKEN_FILE));
}

export function isAuthEnabled() {
  const all = listVaults();
  if (all.length === 0) return Boolean(process.env.PAGEDEX_AUTH_TOKEN_FILE);
  return all.some((v) => isVaultAuthEnabled(v));
}

export function parseTokenList(raw) {
  if (typeof raw !== 'string') return [];
  return raw
    .split(/[,\r\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function readTokenFile(filePath) {
  if (!filePath) return [];
  try {
    return parseTokenList(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

export function getVaultAuthTokens(vault = getActiveVault()) {
  const tokens = [];
  if (vault?.authTokenFile) {
    tokens.push(...readTokenFile(vault.authTokenFile));
  }
  if ((!vault || vault.allowGlobalAuth) && process.env.PAGEDEX_AUTH_TOKEN_FILE) {
    tokens.push(...readTokenFile(process.env.PAGEDEX_AUTH_TOKEN_FILE));
  }
  return tokens;
}

export function readAuthTokens() {
  return getVaultAuthTokens(getActiveVault());
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
}

export function matchTokenInList(candidate, tokens) {
  if (typeof candidate !== 'string' || !candidate) return null;
  let matched = null;
  for (const t of tokens) {
    if (safeEqual(candidate, t)) {
      matched = t;
    }
  }
  return matched;
}

export function matchAuthToken(candidate, vault = getActiveVault()) {
  return matchTokenInList(candidate, getVaultAuthTokens(vault));
}

function signSessionValue(token) {
  const nonce = randomBytes(16).toString('hex');
  const sig = createHmac('sha256', token).update(nonce).digest('hex');
  return `${nonce}.${sig}`;
}

function verifySessionValue(value, tokens = readAuthTokens()) {
  if (typeof value !== 'string') return false;
  const dot = value.indexOf('.');
  if (dot <= 0) return false;
  const nonce = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!nonce || !sig) return false;
  let valid = false;
  for (const t of tokens) {
    const expected = createHmac('sha256', t).update(nonce).digest('hex');
    if (safeEqual(sig, expected)) {
      valid = true;
    }
  }
  return valid;
}

function parseCookie(header, name) {
  if (!header) return '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    if (k === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return '';
}

function isHttpsRequest(c) {
  const proto = c.req.header('x-forwarded-proto') || '';
  if (proto.split(',')[0].trim().toLowerCase() === 'https') return true;
  return c.req.url.startsWith('https://');
}

function buildCookieHeader(value, maxAge, secure, name = COOKIE_NAME) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function parseVaultCookie(header) {
  return parseCookie(header, VAULT_COOKIE_NAME);
}

export function isRequestAuthenticated(c, vault = getActiveVault()) {
  if (!isVaultAuthEnabled(vault)) return true;
  const tokens = getVaultAuthTokens(vault);
  const auth = c.req.header('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (match && matchTokenInList(match[1].trim(), tokens)) {
    return true;
  }
  const cookieVal = parseCookie(c.req.header('cookie') || '', COOKIE_NAME);
  return verifySessionValue(cookieVal, tokens);
}

export async function authMiddleware(c, next) {
  const reqPath = c.req.path;
  if (reqPath === '/api/v1/auth/status' || reqPath === '/api/v1/auth/login' || reqPath === '/api/v1/auth/logout') {
    return next();
  }
  const vault = getActiveVault();
  if (!isVaultAuthEnabled(vault)) return next();
  if (!isRequestAuthenticated(c, vault)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
}

export function registerAuthRoutes(app) {
  app.get('/api/v1/auth/status', (c) => {
    const active = getActiveVault();
    const payload = {
      required: isVaultAuthEnabled(active),
      authenticated: isRequestAuthenticated(c, active)
    };
    if (isMultiVault()) payload.activeVault = active.id;
    return c.json(payload);
  });

  app.get('/api/v1/vaults', (c) => {
    const active = getActiveVault();
    const accessible = listVaults()
      .filter((v) => isRequestAuthenticated(c, v))
      .map((v) => ({ id: v.id, readOnly: isVaultReadOnly(v) }));
    return c.json({
      activeVault: active.id,
      multiVault: isMultiVault(),
      vaults: accessible
    });
  });

  app.post('/api/v1/vault/select', async (c) => {
    let vaultId = '';
    try {
      const body = await c.req.json();
      vaultId = typeof body?.vault === 'string' ? body.vault.trim() : '';
    } catch {
      vaultId = '';
    }
    const target = getVault(vaultId);
    if (!target) {
      return c.json({ error: 'Unknown vault' }, 404);
    }
    if (!isRequestAuthenticated(c, target)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    c.header('Set-Cookie', buildCookieHeader(target.id, COOKIE_MAX_AGE, isHttpsRequest(c), VAULT_COOKIE_NAME));
    return c.json({ ok: true, vault: target.id, readOnly: isVaultReadOnly(target) });
  });

  app.post('/api/v1/auth/login', async (c) => {
    const active = getActiveVault();
    if (!isAuthEnabled()) {
      return c.json({ ok: true, required: false, vault: active.id });
    }
    const retryAfter = getLockRemainingSeconds();
    if (retryAfter > 0) {
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: `Too many failed attempts. Try again in ${retryAfter}s.`, retryAfter }, 429);
    }
    let token = '';
    let requestedVaultId = '';
    const auth = c.req.header('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match) {
      token = match[1].trim();
    } else {
      try {
        const body = await c.req.json();
        token = typeof body?.token === 'string' ? body.token.trim() : '';
        requestedVaultId = typeof body?.vault === 'string' ? body.vault.trim() : '';
      } catch {
        token = '';
      }
    }

    let matched = null;
    let matchedVault = null;
    if (requestedVaultId) {
      const target = getVault(requestedVaultId);
      if (target && isVaultAuthEnabled(target)) {
        matched = matchAuthToken(token, target);
        if (matched) matchedVault = target;
      }
    } else {
      const def = getDefaultVault();
      const ordered = def ? [def, ...listVaults().filter((v) => v.id !== def.id)] : listVaults();
      for (const v of ordered) {
        if (!isVaultAuthEnabled(v)) continue;
        const m = matchAuthToken(token, v);
        if (m) {
          matched = m;
          matchedVault = v;
          break;
        }
      }
    }

    if (!matched || !matchedVault) {
      recordLoginFailure();
      return c.json({ error: 'Invalid token' }, 401);
    }
    resetAuthRateLimit();
    const secure = isHttpsRequest(c);
    const sessionVal = signSessionValue(matched);
    c.header('Set-Cookie', buildCookieHeader(sessionVal, COOKIE_MAX_AGE, secure, COOKIE_NAME));
    if (isMultiVault()) {
      c.header('Set-Cookie', buildCookieHeader(matchedVault.id, COOKIE_MAX_AGE, secure, VAULT_COOKIE_NAME), {
        append: true
      });
    }
    return c.json({ ok: true, vault: matchedVault.id });
  });

  app.post('/api/v1/auth/logout', (c) => {
    const secure = isHttpsRequest(c);
    c.header('Set-Cookie', buildCookieHeader('', 0, secure, COOKIE_NAME));
    if (isMultiVault()) {
      c.header('Set-Cookie', buildCookieHeader('', 0, secure, VAULT_COOKIE_NAME), { append: true });
    }
    return c.json({ ok: true });
  });
}
