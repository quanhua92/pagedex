import { useMemo, useState } from 'react';

/**
 * Manage Git working-tree changes, file diffs, discard confirmation, and commit dialog state.
 */
export function useGitOps({ activePath, filter, fetchTree, openFile }) {
  const [diffData, setDiffData] = useState(null);
  const [discardTarget, setDiscardTarget] = useState(null);
  const [discardError, setDiscardError] = useState('');
  const [gitChanges, setGitChanges] = useState([]);
  const [changesSort, setChangesSort] = useState('path'); // 'path' | 'recent' | 'status'
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitPush, setCommitPush] = useState(false);
  const [commitSelected, setCommitSelected] = useState(() => new Set());
  const [commitBusy, setCommitBusy] = useState(false);
  const [commitStatus, setCommitStatus] = useState(null);

  async function loadDiff(relPath = activePath) {
    if (!relPath) return;
    const res = await fetch(`/api/v1/git/diff?path=${encodeURIComponent(relPath)}`);
    if (res.ok) {
      setDiffData(await res.json());
    } else {
      setDiffData(null);
    }
  }

  function requestDiscard({ path: targetPath = activePath, hunkIndex, lineIndex, previewText } = {}) {
    if (!targetPath) return;
    setDiscardError('');
    setDiscardTarget({ path: targetPath, hunkIndex, lineIndex, previewText });
  }

  async function confirmDiscard() {
    if (!discardTarget?.path) return;
    const { path: targetPath, hunkIndex, lineIndex } = discardTarget;
    const res = await fetch('/api/v1/git/discard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: targetPath, hunkIndex, lineIndex })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setDiscardTarget(null);
      setDiscardError('');
      await fetchTree();
      if (targetPath === activePath) {
        await openFile(activePath, true);
        await loadDiff(activePath);
      }
    } else {
      setDiscardError(data.error || 'Failed to discard');
    }
  }

  const sortedChanges = useMemo(() => {
    const filtered = gitChanges.filter((c) => !filter || c.path.toLowerCase().includes(filter));
    const copy = [...filtered];
    if (changesSort === 'recent') {
      copy.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0) || a.path.localeCompare(b.path));
    } else if (changesSort === 'status') {
      copy.sort((a, b) => a.status.localeCompare(b.status) || a.path.localeCompare(b.path));
    } else {
      copy.sort((a, b) => a.path.localeCompare(b.path));
    }
    return copy;
  }, [gitChanges, filter, changesSort]);

  function openCommitDialog() {
    setCommitSelected(new Set(gitChanges.map((c) => c.path)));
    setCommitMessage('');
    setCommitStatus(null);
    setCommitOpen(true);
  }

  async function handleCommitSubmit() {
    if (!commitMessage.trim()) return;
    setCommitBusy(true);
    setCommitStatus(null);
    try {
      const res = await fetch('/api/v1/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: commitMessage.trim(),
          files: Array.from(commitSelected),
          push: commitPush
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setCommitStatus({ ok: false, text: data.error || 'Commit failed' });
      } else {
        setCommitStatus({ ok: true, text: data.output || 'Committed successfully' });
        await fetchTree();
      }
    } catch (err) {
      setCommitStatus({ ok: false, text: err.message });
    } finally {
      setCommitBusy(false);
    }
  }

  return {
    diffData,
    setDiffData,
    discardTarget,
    setDiscardTarget,
    discardError,
    gitChanges,
    setGitChanges,
    changesSort,
    setChangesSort,
    sortedChanges,
    commitOpen,
    setCommitOpen,
    commitMessage,
    setCommitMessage,
    commitPush,
    setCommitPush,
    commitSelected,
    setCommitSelected,
    commitBusy,
    commitStatus,
    loadDiff,
    requestDiscard,
    confirmDiscard,
    openCommitDialog,
    handleCommitSubmit
  };
}
