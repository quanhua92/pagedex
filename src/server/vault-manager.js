import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const vaultStorage = new AsyncLocalStorage();

const vaults = new Map();
let defaultVaultId = 'default';
let configPath = '';
let configMtimeMs = 0;
let configWatcher = null;
let configReloadTimer = null;
let onVaultAddedHook = null;
let onVaultRemovedHook = null;

export function expandHome(p) {
  if (typeof p !== 'string') return '';
  const trimmed = p.trim();
  if (!trimmed) return '';
  if (trimmed === '~') return os.homedir();
  if (trimmed.startsWith('~/') || trimmed.startsWith(`~${path.sep}`)) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  return trimmed;
}

function createVaultContext(id, opts) {
  const resolvedRoot = path.resolve(expandHome(opts.root || process.cwd()));
  const authTokenFile = opts.authTokenFile ? path.resolve(expandHome(opts.authTokenFile)) : '';
  const mcpTokenFile = opts.mcpTokenFile ? path.resolve(expandHome(opts.mcpTokenFile)) : '';
  const allowGlobalAuth =
    typeof opts.allowGlobalAuth === 'boolean' ? opts.allowGlobalAuth : !authTokenFile;
  return {
    id,
    root: resolvedRoot,
    authTokenFile,
    mcpTokenFile,
    allowGlobalAuth,
    readOnly: Boolean(opts.readOnly),
    cache: {
      tree: null,
      flatFiles: null,
      fileStats: null,
      sortedStats: null,
      backlinks: null,
      builtAt: 0
    },
    search: {
      db: null,
      dbPath: '',
      indexDisabled: false
    },
    watcher: null,
    watchTimer: null,
    lastChanged: '',
    subscribers: new Set()
  };
}

function parseConfigFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || !parsed.vaults || typeof parsed.vaults !== 'object') {
    throw new Error('PAGEDEX_ROOT_CONFIG must be JSON with a "vaults" object');
  }
  const entries = Object.entries(parsed.vaults).filter(
    ([id, cfg]) => id && cfg && typeof cfg === 'object' && typeof cfg.root === 'string' && cfg.root.trim()
  );
  if (entries.length === 0) {
    throw new Error('PAGEDEX_ROOT_CONFIG "vaults" must define at least one vault with a "root"');
  }
  const def =
    typeof parsed.default === 'string' && entries.some(([id]) => id === parsed.default)
      ? parsed.default
      : entries[0][0];
  return { defaultId: def, entries };
}

function applyVaultEntries(defaultId, entries) {
  const nextIds = new Set(entries.map(([id]) => id));
  for (const [id, existing] of vaults) {
    if (!nextIds.has(id)) {
      if (existing.watcher) {
        try {
          existing.watcher.close();
        } catch {}
        existing.watcher = null;
      }
      clearTimeout(existing.watchTimer);
      onVaultRemovedHook?.(existing);
      vaults.delete(id);
    }
  }

  for (const [id, cfg] of entries) {
    const nextCtx = createVaultContext(id, cfg);
    const existing = vaults.get(id);
    if (existing && existing.root === nextCtx.root) {
      existing.authTokenFile = nextCtx.authTokenFile;
      existing.mcpTokenFile = nextCtx.mcpTokenFile;
      existing.allowGlobalAuth = nextCtx.allowGlobalAuth;
      existing.readOnly = nextCtx.readOnly;
    } else {
      if (existing) {
        if (existing.watcher) {
          try {
            existing.watcher.close();
          } catch {}
          existing.watcher = null;
        }
        clearTimeout(existing.watchTimer);
        onVaultRemovedHook?.(existing);
      }
      vaults.set(id, nextCtx);
      onVaultAddedHook?.(nextCtx);
    }
  }

  defaultVaultId = defaultId;
}

export function initVaultManager({ onVaultAdded, onVaultRemoved } = {}) {
  if (onVaultAdded) onVaultAddedHook = onVaultAdded;
  if (onVaultRemoved) onVaultRemovedHook = onVaultRemoved;

  const cfgEnv = process.env.PAGEDEX_ROOT_CONFIG ? path.resolve(expandHome(process.env.PAGEDEX_ROOT_CONFIG)) : '';
  if (cfgEnv) {
    configPath = cfgEnv;
    try {
      const stat = fs.statSync(configPath);
      configMtimeMs = stat.mtimeMs;
    } catch {
      configMtimeMs = 0;
    }
    const { defaultId, entries } = parseConfigFile(configPath);
    applyVaultEntries(defaultId, entries);
    startConfigWatcher();
  } else {
    configPath = '';
    const singleRoot = process.env.PAGEDEX_ROOT || process.env.VAULT_ROOT || process.cwd();
    const globalReadOnly = process.env.PAGEDEX_READ_ONLY === '1' || process.env.PAGEDEX_READ_ONLY === 'true';
    applyVaultEntries('default', [
      [
        'default',
        {
          root: singleRoot,
          authTokenFile: '',
          mcpTokenFile: '',
          allowGlobalAuth: true,
          readOnly: globalReadOnly
        }
      ]
    ]);
  }
}

function reloadConfigIfChanged() {
  if (!configPath) return;
  try {
    const stat = fs.statSync(configPath);
    if (stat.mtimeMs === configMtimeMs) return;
    const { defaultId, entries } = parseConfigFile(configPath);
    configMtimeMs = stat.mtimeMs;
    applyVaultEntries(defaultId, entries);
  } catch (err) {
    console.warn('PAGEDEX_ROOT_CONFIG reload warning:', err.message);
  }
}

function startConfigWatcher() {
  if (!configPath || configWatcher) return;
  const dir = path.dirname(configPath);
  const base = path.basename(configPath);
  try {
    configWatcher = fs.watch(dir, (_event, filename) => {
      if (filename && filename !== base) return;
      clearTimeout(configReloadTimer);
      configReloadTimer = setTimeout(reloadConfigIfChanged, 120);
    });
  } catch (err) {
    console.warn('PAGEDEX_ROOT_CONFIG watch warning:', err.message);
  }
}

function ensureInitialized() {
  if (vaults.size === 0) {
    initVaultManager();
  }
}

export function getActiveVault() {
  const scoped = vaultStorage.getStore();
  if (scoped) return scoped;
  ensureInitialized();
  return vaults.get(defaultVaultId) || vaults.values().next().value;
}

export function getDefaultVault() {
  ensureInitialized();
  return vaults.get(defaultVaultId) || vaults.values().next().value;
}

export function getVault(id) {
  ensureInitialized();
  if (!id || typeof id !== 'string') return null;
  return vaults.get(id) || null;
}

export function listVaults() {
  ensureInitialized();
  return Array.from(vaults.values());
}

export function isMultiVault() {
  ensureInitialized();
  return Boolean(configPath);
}

export function isVaultReadOnly(vault = getActiveVault()) {
  const globalReadOnly = process.env.PAGEDEX_READ_ONLY === '1' || process.env.PAGEDEX_READ_ONLY === 'true';
  return Boolean(globalReadOnly || vault?.readOnly);
}
