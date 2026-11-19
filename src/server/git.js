import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getVaultRoot, isImagePath, isProtectedPath, resolveSafe } from './paths.js';
import { removeVaultCacheFile, updateVaultCacheFile } from './vault-cache.js';

export function getGitChanges() {
  try {
    const out = execFileSync('git', ['status', '--porcelain', '-uall'], {
      cwd: getVaultRoot(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const changes = out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const rawCode = line.slice(0, 2).trim() || 'M';
        let filePath = line.slice(3).trim();
        if (filePath.includes(' -> ')) filePath = filePath.split(' -> ').pop();
        if (filePath.startsWith('"') && filePath.endsWith('"')) {
          filePath = filePath.slice(1, -1);
        }
        const status = rawCode === '??' ? 'U' : rawCode[0];
        let mtimeMs = 0;
        if (status !== 'D') {
          try {
            mtimeMs = fs.statSync(path.join(getVaultRoot(), filePath)).mtimeMs;
          } catch {
            mtimeMs = 0;
          }
        }
        return { status, path: filePath, mtimeMs };
      })
      .filter((c) => c.path && !isProtectedPath(c.path));
    return { isGit: true, changes };
  } catch {
    return { isGit: false, changes: [] };
  }
}

export function gitCommitAndPush({ message, files = [], push = false }) {
  const msg = String(message || '').trim();
  if (!msg) return { error: 'Commit message is required' };
  try {
    const safeFiles = Array.isArray(files)
      ? files.filter((f) => typeof f === 'string' && f && !isProtectedPath(f) && resolveSafe(f))
      : [];
    if (safeFiles.length > 0) {
      execFileSync('git', ['add', '--', ...safeFiles], { cwd: getVaultRoot(), encoding: 'utf8' });
    } else {
      execFileSync('git', ['add', '-A'], { cwd: getVaultRoot(), encoding: 'utf8' });
    }
    const commitOut = execFileSync('git', ['commit', '-m', msg], { cwd: getVaultRoot(), encoding: 'utf8' });
    let pushOut = '';
    if (push) {
      pushOut = execFileSync('git', ['push'], { cwd: getVaultRoot(), encoding: 'utf8' });
    }
    return { ok: true, output: [commitOut, pushOut].filter(Boolean).join('\n').trim() };
  } catch (err) {
    const detail = err?.stderr?.toString?.() || err?.stdout?.toString?.() || err.message;
    return { error: detail.trim() || 'Git command failed' };
  }
}

function parseUnifiedDiff(raw) {
  const lines = raw.split('\n');
  const fileHeaders = [];
  const hunks = [];
  let current = null;
  let oldLn = 0;
  let newLn = 0;

  for (const line of lines) {
    if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
      fileHeaders.push(line);
      continue;
    }
    const hm = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
    if (hm) {
      oldLn = Number(hm[1]);
      newLn = Number(hm[3]);
      current = {
        header: line,
        oldStart: oldLn,
        newStart: newLn,
        lines: []
      };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith('+')) {
      current.lines.push({ type: 'add', text: line.slice(1), oldLine: null, newLine: newLn++ });
    } else if (line.startsWith('-')) {
      current.lines.push({ type: 'del', text: line.slice(1), oldLine: oldLn++, newLine: null });
    } else if (line.startsWith(' ')) {
      current.lines.push({ type: 'context', text: line.slice(1), oldLine: oldLn++, newLine: newLn++ });
    }
  }
  return { fileHeaders, hunks };
}

export function getGitDiff(relPath) {
  if (!relPath || isProtectedPath(relPath) || !resolveSafe(relPath)) {
    return { error: 'Invalid or protected path' };
  }
  const cleanPath = relPath.replace(/^\/+/, '');
  try {
    let raw = execFileSync('git', ['diff', '--no-color', '-U3', '--', cleanPath], {
      cwd: getVaultRoot(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let untracked = false;
    if (!raw.trim()) {
      const st = execFileSync('git', ['status', '--porcelain', '--', cleanPath], {
        cwd: getVaultRoot(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      if (st.startsWith('??')) {
        untracked = true;
        const full = resolveSafe(cleanPath);
        if (full && fs.existsSync(full) && !isImagePath(cleanPath)) {
          const textLines = fs.readFileSync(full, 'utf8').split('\n');
          if (textLines.at(-1) === '') textLines.pop();
          raw = [
            `--- /dev/null`,
            `+++ b/${cleanPath}`,
            `@@ -0,0 +1,${textLines.length} @@`,
            ...textLines.map((l) => `+${l}`)
          ].join('\n');
        }
      }
    }
    const { fileHeaders, hunks } = parseUnifiedDiff(raw);
    return { path: cleanPath, untracked, fileHeaders, hunks, raw };
  } catch (err) {
    return { error: err?.stderr?.toString?.() || err.message };
  }
}

export function discardGitChange({ path: relPath, hunkIndex, lineIndex }) {
  if (!relPath || isProtectedPath(relPath)) return { error: 'Invalid or protected path' };
  const cleanPath = relPath.replace(/^\/+/, '');
  const full = resolveSafe(cleanPath);
  if (!full) return { error: 'Invalid path' };

  try {
    if (hunkIndex === undefined || hunkIndex === null) {
      const st = execFileSync('git', ['status', '--porcelain', '--', cleanPath], {
        cwd: getVaultRoot(),
        encoding: 'utf8'
      });
      if (st.startsWith('??')) {
        if (fs.existsSync(full)) fs.unlinkSync(full);
        removeVaultCacheFile(cleanPath);
        return { ok: true, path: cleanPath, discarded: 'untracked' };
      }
      execFileSync('git', ['checkout', '--', cleanPath], { cwd: getVaultRoot(), encoding: 'utf8' });
      updateVaultCacheFile(cleanPath);
      return { ok: true, path: cleanPath, discarded: 'file' };
    }

    const diff = getGitDiff(cleanPath);
    if (diff.error) return diff;
    if (diff.untracked) return { error: 'Cannot discard single lines on an untracked file; discard whole file instead' };

    const hunk = diff.hunks[Number(hunkIndex)];
    if (!hunk) return { error: 'Hunk not found' };

    const rawText = fs.readFileSync(full, 'utf8');
    const hadTrailingNewline = rawText.endsWith('\n');
    const fileLines = rawText.split('\n');
    if (hadTrailingNewline) fileLines.pop();

    if (lineIndex === undefined || lineIndex === null) {
      const startIdx = hunk.newStart === 0 ? 0 : hunk.newStart - 1;
      const deleteCount = hunk.lines.filter((l) => l.type === 'context' || l.type === 'add').length;
      const restoreLines = hunk.lines
        .filter((l) => l.type === 'context' || l.type === 'del')
        .map((l) => l.text);
      fileLines.splice(startIdx, deleteCount, ...restoreLines);
      const out = fileLines.join('\n') + (hadTrailingNewline ? '\n' : '');
      fs.writeFileSync(full, out, 'utf8');
      updateVaultCacheFile(cleanPath);
      return { ok: true, path: cleanPath, discarded: 'hunk' };
    }

    const targetIdx = Number(lineIndex);
    const targetLine = hunk.lines[targetIdx];
    if (!targetLine || targetLine.type === 'context') {
      return { error: 'Line is not a change' };
    }

    if (targetLine.type === 'add') {
      fileLines.splice(targetLine.newLine - 1, 1);
    } else {
      let insertAt = hunk.newStart === 0 ? 0 : hunk.newStart - 1;
      for (let i = targetIdx - 1; i >= 0; i--) {
        if (hunk.lines[i].newLine !== null) {
          insertAt = hunk.lines[i].newLine;
          break;
        }
      }
      fileLines.splice(insertAt, 0, targetLine.text);
    }

    const out = fileLines.join('\n') + (hadTrailingNewline ? '\n' : '');
    fs.writeFileSync(full, out, 'utf8');
    updateVaultCacheFile(cleanPath);
    return { ok: true, path: cleanPath, discarded: 'line' };
  } catch (err) {
    return { error: err?.stderr?.toString?.() || err.message };
  }
}
