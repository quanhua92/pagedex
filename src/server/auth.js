import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';

const COOKIE_NAME = 'pagedex_auth';
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

export function isAuthEnabled() {
  return Boolean(process.env.PAGEDEX_AUTH_TOKEN_FILE);
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

export function readAuthTokens() {
  return readTokenFile(process.env.PAGEDEX_AUTH_TOKEN_FILE);
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
}

export function matchAuthToken(candidate) {
  if (typeof candidate !== 'string' || !candidate) return null;
  const tokens = readAuthTokens();
  let matched = null;
  for (const t of tokens) {
    if (safeEqual(candidate, t)) {
      matched = t;
    }
  }
  return matched;
}

function signSessionValue(token) {
  const nonce = randomBytes(16).toString('hex');
  const sig = createHmac('sha256', token).update(nonce).digest('hex');
  return `${nonce}.${sig}`;
}

function verifySessionValue(value) {
  if (typeof value !== 'string') return false;
  const dot = value.indexOf('.');
  if (dot <= 0) return false;
  const nonce = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!nonce || !sig) return false;
  const tokens = readAuthTokens();
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

function buildCookieHeader(value, maxAge, secure) {
  const parts = [`${COOKIE_NAME}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function isRequestAuthenticated(c) {
  if (!isAuthEnabled()) return true;
  const auth = c.req.header('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (match && matchAuthToken(match[1].trim())) {
    return true;
  }
  const cookieVal = parseCookie(c.req.header('cookie') || '', COOKIE_NAME);
  return verifySessionValue(cookieVal);
}

export async function authMiddleware(c, next) {
  if (!isAuthEnabled()) return next();
  const reqPath = c.req.path;
  if (reqPath === '/api/v1/auth/status' || reqPath === '/api/v1/auth/login' || reqPath === '/api/v1/auth/logout') {
    return next();
  }
  if (!isRequestAuthenticated(c)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
}

export function registerAuthRoutes(app) {
  app.get('/api/v1/auth/status', (c) => {
    return c.json({
      required: isAuthEnabled(),
      authenticated: isRequestAuthenticated(c)
    });
  });

  app.post('/api/v1/auth/login', async (c) => {
    if (!isAuthEnabled()) {
      return c.json({ ok: true, required: false });
    }
    const retryAfter = getLockRemainingSeconds();
    if (retryAfter > 0) {
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: `Too many failed attempts. Try again in ${retryAfter}s.`, retryAfter }, 429);
    }
    let token = '';
    const auth = c.req.header('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match) {
      token = match[1].trim();
    } else {
      try {
        const body = await c.req.json();
        token = typeof body?.token === 'string' ? body.token.trim() : '';
      } catch {
        token = '';
      }
    }
    const matched = matchAuthToken(token);
    if (!matched) {
      recordLoginFailure();
      return c.json({ error: 'Invalid token' }, 401);
    }
    resetAuthRateLimit();
    const sessionVal = signSessionValue(matched);
    c.header('Set-Cookie', buildCookieHeader(sessionVal, COOKIE_MAX_AGE, isHttpsRequest(c)));
    return c.json({ ok: true });
  });

  app.post('/api/v1/auth/logout', (c) => {
    c.header('Set-Cookie', buildCookieHeader('', 0, isHttpsRequest(c)));
    return c.json({ ok: true });
  });
}
