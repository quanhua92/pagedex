import fs from 'node:fs';
import path from 'node:path';
import { IGNORED, getVaultRoot, isImagePath, isProtectedPath, resolveSafe } from './paths.js';
import { getActiveVault } from './vault-manager.js';

export function invalidateVaultCache() {
  const vault = getActiveVault();
  if (vault) vault.vaultCache = null;
}

function sortTreeNodes(nodes) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function insertTreeFile(nodes, relPath, mtimeMs = 0) {
  const parts = relPath.split('/');
  let list = nodes;
  for (let i = 0; i < parts.length - 1; i++) {
    const dirName = parts[i];
    const dirPath = parts.slice(0, i + 1).join('/');
    let dirNode = list.find((n) => n.type === 'dir' && n.name === dirName);
    if (!dirNode) {
      dirNode = { type: 'dir', name: dirName, path: dirPath, mtimeMs, children: [] };
      list.push(dirNode);
      sortTreeNodes(list);
    } else if (mtimeMs > (dirNode.mtimeMs || 0)) {
      dirNode.mtimeMs = mtimeMs;
    }
    list = dirNode.children;
  }
  const fileName = parts[parts.length - 1];
  const existing = list.find((n) => n.type === 'file' && n.path === relPath);
  if (!existing) {
    list.push({ type: 'file', name: fileName, path: relPath, mtimeMs });
    sortTreeNodes(list);
  } else {
    existing.mtimeMs = mtimeMs;
  }
}

function removeTreeFile(nodes, relPath) {
  const parts = relPath.split('/');
  if (parts.length === 1) {
    const idx = nodes.findIndex((n) => n.type === 'file' && n.name === parts[0]);
    if (idx !== -1) nodes.splice(idx, 1);
    return;
  }
  const dirNode = nodes.find((n) => n.type === 'dir' && n.name === parts[0]);
  if (!dirNode) return;
  removeTreeFile(dirNode.children, parts.slice(1).join('/'));
  dirNode.mtimeMs = dirNode.children.reduce((max, n) => Math.max(max, n.mtimeMs || 0), 0);
  if (dirNode.children.length === 0 && !fs.existsSync(path.join(getVaultRoot(), dirNode.path))) {
    const idx = nodes.indexOf(dirNode);
    if (idx !== -1) nodes.splice(idx, 1);
  }
}

function createWikiResolver(flatFiles) {
  const mdFiles = flatFiles.filter((p) => p.endsWith('.md'));
  const byName = new Map();
  const byNoExt = new Map();

  for (const p of mdFiles) {
    const noExt = p.slice(0, -3);
    const base = path.basename(noExt).toLowerCase();
    byNoExt.set(noExt.toLowerCase(), p);
    if (!byName.has(base)) byName.set(base, p);
  }

  return function resolveWiki(rawTarget) {
    const clean = rawTarget.split('|')[0].split('#')[0].trim().replace(/\.md$/i, '').replace(/^\/+/, '');
    if (!clean) return null;
    const lower = clean.toLowerCase();
    if (byNoExt.has(lower)) return byNoExt.get(lower);
    const base = path.basename(lower);
    return byName.get(base) || null;
  };
}

function extractWikiTargets(text, resolveWiki) {
  const stripped = text.replace(/```[\s\S]*?```/g, '');
  const wikiRe = /\[\[([^\]]+)\]\]/g;
  const targets = new Set();
  let match;
  while ((match = wikiRe.exec(stripped)) !== null) {
    const target = resolveWiki(match[1]);
    if (target) targets.add(target);
  }
  return targets;
}

export function removeVaultCacheFile(relPath) {
  const vaultCache = getActiveVault()?.vaultCache;
  if (!vaultCache || !relPath) return;
  const clean = relPath.replace(/^\/+/, '');
  const fIdx = vaultCache.flatFiles.indexOf(clean);
  if (fIdx !== -1) vaultCache.flatFiles.splice(fIdx, 1);
  vaultCache.fileStats = vaultCache.fileStats.filter((f) => f.path !== clean);
  vaultCache.sortedStats = vaultCache.sortedStats.filter((f) => f.path !== clean);
  removeTreeFile(vaultCache.tree, clean);
  delete vaultCache.backlinks[clean];
  for (const list of Object.values(vaultCache.backlinks)) {
    const i = list.indexOf(clean);
    if (i !== -1) list.splice(i, 1);
  }
}

export function updateVaultCacheFile(relPath) {
  const vaultCache = getActiveVault()?.vaultCache;
  if (!vaultCache || !relPath) return;
  const clean = relPath.replace(/^\/+/, '');
  if (isProtectedPath(clean)) return;
  const full = resolveSafe(clean);
  if (!full || !fs.existsSync(full)) {
    removeVaultCacheFile(clean);
    return;
  }
  let st;
  try {
    st = fs.statSync(full);
  } catch {
    return;
  }
  if (st.isDirectory()) {
    invalidateVaultCache();
    return;
  }
  if (!st.isFile()) return;

  const mtimeMs = Math.round(st.mtimeMs);
  if (!vaultCache.flatFiles.includes(clean)) {
    vaultCache.flatFiles.push(clean);
  }
  insertTreeFile(vaultCache.tree, clean, mtimeMs);

  const statEntry = vaultCache.fileStats.find((f) => f.path === clean);
  if (statEntry) statEntry.mtimeMs = mtimeMs;
  else vaultCache.fileStats.push({ path: clean, mtimeMs });

  vaultCache.sortedStats = vaultCache.sortedStats.filter((f) => f.path !== clean);
  vaultCache.sortedStats.unshift({ path: clean, mtimeMs });
  vaultCache.sortedStats.sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (clean.endsWith('.md')) {
    if (!vaultCache.backlinks[clean]) vaultCache.backlinks[clean] = [];
    for (const list of Object.values(vaultCache.backlinks)) {
      const i = list.indexOf(clean);
      if (i !== -1) list.splice(i, 1);
    }
    try {
      const text = fs.readFileSync(full, 'utf8');
      const resolveWiki = createWikiResolver(vaultCache.flatFiles);
      for (const target of extractWikiTargets(text, resolveWiki)) {
        if (target !== clean) {
          if (!vaultCache.backlinks[target]) vaultCache.backlinks[target] = [];
          vaultCache.backlinks[target].push(clean);
        }
      }
    } catch {
      // Ignore transient read error
    }
  }
}

export function sortTree(nodes, sort = 'name') {
  if (sort !== 'mtime') return nodes;
  return [...nodes]
    .map((n) => (n.type === 'dir' ? { ...n, children: sortTree(n.children, sort) } : n))
    .sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0) || a.name.localeCompare(b.name));
}

export function scanVault(dir = getVaultRoot(), relBase = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const dirs = [];
  const files = [];
  const flatFiles = [];
  const fileStats = [];

  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const sub = scanVault(full, rel);
      const dirMtime = sub.tree.reduce((max, n) => Math.max(max, n.mtimeMs || 0), 0);
      dirs.push({ type: 'dir', name: entry.name, path: rel, mtimeMs: dirMtime, children: sub.tree });
      flatFiles.push(...sub.flatFiles);
      fileStats.push(...sub.fileStats);
    } else if (entry.isFile()) {
      let mtimeMs = 0;
      try {
        mtimeMs = Math.round(fs.statSync(full).mtimeMs);
      } catch {
        mtimeMs = 0;
      }
      files.push({ type: 'file', name: entry.name, path: rel, mtimeMs });
      flatFiles.push(rel);
      fileStats.push({ path: rel, mtimeMs });
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  return { tree: [...dirs, ...files], flatFiles, fileStats };
}

export function buildLinkIndex(flatFiles) {
  const mdFiles = flatFiles.filter((p) => p.endsWith('.md'));
  const resolveWiki = createWikiResolver(flatFiles);
  const backlinks = Object.fromEntries(mdFiles.map((p) => [p, []]));

  for (const src of mdFiles) {
    const full = path.join(getVaultRoot(), src);
    let text = '';
    try {
      text = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    for (const target of extractWikiTargets(text, resolveWiki)) {
      if (target !== src) {
        backlinks[target]?.push(src);
      }
    }
  }

  return { backlinks, mdFiles };
}

export function getCachedVault() {
  const vault = getActiveVault();
  if (vault?.vaultCache) return vault.vaultCache;
  const { tree, flatFiles, fileStats } = scanVault();
  const { backlinks } = buildLinkIndex(flatFiles);
  const sortedStats = [...fileStats].sort((a, b) => b.mtimeMs - a.mtimeMs);
  const built = { tree, flatFiles, fileStats, sortedStats, backlinks };
  if (vault) vault.vaultCache = built;
  return built;
}

export function searchVault(query, limit = 50) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const { fileStats } = scanVault();
  const sorted = [...fileStats].sort((a, b) => b.mtimeMs - a.mtimeMs);
  const results = [];

  for (const { path: rel, mtimeMs } of sorted) {
    if (isImagePath(rel)) continue;
    const full = path.join(getVaultRoot(), rel);
    let text = '';
    try {
      text = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    const pathMatch = rel.toLowerCase().includes(q);
    const idx = text.toLowerCase().indexOf(q);
    if (pathMatch || idx !== -1) {
      const snippet =
        idx !== -1
          ? text.slice(Math.max(0, idx - 60), Math.min(text.length, idx + q.length + 100)).replace(/\s+/g, ' ').trim()
          : '';
      results.push({ path: rel, mtimeMs, snippet });
      if (results.length >= limit) break;
    }
  }
  return results;
}
