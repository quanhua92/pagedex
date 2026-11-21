import { useRef, useState } from 'react';
import { baseTitle, buildNewFolderPath, buildNewNotePath } from '../lib/paths.js';

/**
 * Manage file/folder creation, rename, move, delete, upload, and context menu state.
 */
export function useFileCrud({
  activePath,
  flatFiles,
  tabs,
  setTabs,
  setActiveTabId,
  setContent,
  setDirty,
  setViewMode,
  setTree,
  setFlatFiles,
  setFileStats,
  setGitChanges,
  setPinned,
  setCollapsed,
  fetchTree,
  openFile,
  openInNewTab,
  showToast
}) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [fileMenu, setFileMenu] = useState(null); // { type, path, x, y }
  const [renameTarget, setRenameTarget] = useState(null); // { type, oldPath, parentDir, newName }
  const [renameError, setRenameError] = useState('');
  const [moveTarget, setMoveTarget] = useState(null); // { type, oldPath, name, destFolder }
  const [moveError, setMoveError] = useState('');
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteFolder, setNewNoteFolder] = useState('');
  const [newNoteError, setNewNoteError] = useState('');
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParent, setNewFolderParent] = useState('');
  const [newFolderError, setNewFolderError] = useState('');
  const uploadInputRef = useRef(null);
  const uploadDirRef = useRef('');

  async function confirmDeleteFile() {
    if (!deleteTarget) return;
    setDeleteError('');
    const isDir = typeof deleteTarget === 'object' && deleteTarget.type === 'dir';
    const targetPath = typeof deleteTarget === 'string' ? deleteTarget : deleteTarget.path;
    const endpoint = isDir ? '/api/v1/dir' : '/api/v1/file';
    const res = await fetch(`${endpoint}?path=${encodeURIComponent(targetPath)}`, {
      method: 'DELETE'
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const deleted = targetPath;
      const matchesDeleted = (p) =>
        Boolean(p) && (p === deleted || (isDir && p.startsWith(`${deleted}/`)));
      setDeleteTarget(null);
      if (matchesDeleted(localStorage.getItem('vault-last-path'))) {
        localStorage.removeItem('vault-last-path');
      }
      const pruneNodes = (nodes) =>
        nodes
          .filter((n) => !matchesDeleted(n.path))
          .map((n) => (n.type === 'dir' ? { ...n, children: pruneNodes(n.children || []) } : n));
      setTree((prev) => pruneNodes(prev));
      setFlatFiles((prev) => prev.filter((f) => !matchesDeleted(f)));
      setFileStats((prev) => prev.filter((f) => !matchesDeleted(f.path)));
      setGitChanges((prev) => prev.filter((c) => !matchesDeleted(c.path)));
      setPinned((prev) => prev.filter((p) => !matchesDeleted(p.path)));

      if (matchesDeleted(activePath)) {
        setViewMode('preview');
        const remaining = tabs.filter((t) => !matchesDeleted(t.path));
        if (remaining.length > 0) {
          const nextTab = remaining[remaining.length - 1];
          setTabs(remaining);
          setActiveTabId(nextTab.id);
          if (nextTab.path) {
            await openFile(nextTab.path, false, nextTab.id);
          } else {
            setContent('');
            location.hash = '';
          }
        } else {
          const fresh = { id: `tab-${Date.now()}`, path: null, title: 'New tab', preview: '' };
          setTabs([fresh]);
          setActiveTabId(fresh.id);
          setContent('');
          setDirty(false);
          location.hash = '';
        }
      } else {
        setTabs((prev) => prev.filter((t) => !matchesDeleted(t.path)));
      }
      await fetchTree();
    } else {
      setDeleteError(data.error || `Failed to delete ${isDir ? 'folder' : 'file'} (${res.status})`);
    }
  }

  async function handleUploadToDir(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const dir = uploadDirRef.current || '';
    const form = new FormData();
    form.append('dir', dir);
    for (const f of files) form.append('files', f);
    const res = await fetch('/api/v1/file/upload', { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      await fetchTree();
      if (data.uploaded?.length === 1) {
        const p = data.uploaded[0].path;
        if (/\.(md|markdown|txt|png|jpe?g|gif|webp|svg|ico)$/i.test(p)) {
          openFile(p);
        }
      }
    }
  }

  async function performRenameOrMove(type, oldPath, cleanNew, onError) {
    const isDir = type === 'dir';
    const endpoint = isDir ? '/api/v1/dir/rename' : '/api/v1/file/rename';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newPath: cleanNew })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      onError(data.error || 'Operation failed');
      return false;
    }
    await fetchTree();
    setTabs((prev) =>
      prev.map((t) => {
        if (!t.path) return t;
        if (isDir && t.path.startsWith(`${oldPath}/`)) {
          const nextPath = `${cleanNew}${t.path.slice(oldPath.length)}`;
          return { ...t, path: nextPath, title: baseTitle(nextPath) };
        }
        if (!isDir && t.path === oldPath) {
          return { ...t, path: cleanNew, title: baseTitle(cleanNew) };
        }
        return t;
      })
    );
    setPinned((prev) =>
      prev.map((item) => {
        if (isDir) {
          if (item.path === oldPath) return { ...item, path: cleanNew };
          if (item.path.startsWith(`${oldPath}/`)) {
            return { ...item, path: `${cleanNew}${item.path.slice(oldPath.length)}` };
          }
        } else if (item.path === oldPath) {
          return { ...item, path: cleanNew };
        }
        return item;
      })
    );
    if (isDir) {
      if (activePath.startsWith(`${oldPath}/`)) {
        openFile(`${cleanNew}${activePath.slice(oldPath.length)}`);
      }
    } else if (oldPath === activePath) {
      openFile(cleanNew);
    }
    return true;
  }

  async function confirmRenameFile() {
    if (!renameTarget?.oldPath) return;
    const cleanName = renameTarget.newName.trim();
    if (!cleanName) {
      setRenameError('Please enter a name');
      return;
    }
    if (cleanName.includes('/')) {
      setRenameError('Name cannot contain / (use Move to change folder)');
      return;
    }
    setRenameError('');
    const cleanNew = renameTarget.parentDir ? `${renameTarget.parentDir}/${cleanName}` : cleanName;
    if (cleanNew === renameTarget.oldPath) {
      setRenameTarget(null);
      return;
    }
    const ok = await performRenameOrMove(renameTarget.type, renameTarget.oldPath, cleanNew, setRenameError);
    if (ok) setRenameTarget(null);
  }

  async function confirmMoveItem() {
    if (!moveTarget?.oldPath) return;
    setMoveError('');
    const cleanDest = (moveTarget.destFolder || '').trim().replace(/^\/+|\/+$/g, '');
    const cleanNew = cleanDest ? `${cleanDest}/${moveTarget.name}` : moveTarget.name;
    if (cleanNew === moveTarget.oldPath) {
      setMoveTarget(null);
      return;
    }
    const ok = await performRenameOrMove(moveTarget.type, moveTarget.oldPath, cleanNew, setMoveError);
    if (ok) setMoveTarget(null);
  }

  function openRowMenu(targetPath, rect, type = 'file') {
    const menuW = window.innerWidth <= 768 ? 215 : 175;
    const menuH = window.innerWidth <= 768 ? 360 : 300;
    const x = Math.min(rect.right - menuW, window.innerWidth - (menuW + 12));
    const y = Math.min(rect.bottom + 4, window.innerHeight - menuH);
    setFileMenu({ type, path: targetPath, x: Math.max(8, x), y: Math.max(8, y) });
  }

  function openNewNoteDialog(defaultFolder = null) {
    const fallbackFolder = activePath.includes('/') ? activePath.split('/').slice(0, -1).join('/') : '';
    const resolved = typeof defaultFolder === 'string' ? defaultFolder : fallbackFolder;
    setNewNoteTitle('');
    setNewNoteFolder(resolved.replace(/^\/+|\/+$/g, ''));
    setNewNoteError('');
    setNewNoteOpen(true);
  }

  async function confirmNewNote() {
    const relPath = buildNewNotePath(newNoteTitle, newNoteFolder);
    if (!relPath) {
      setNewNoteError('Please enter a note title');
      return;
    }
    if (flatFiles.includes(relPath)) {
      setNewNoteError(`Already exists: ${relPath}`);
      return;
    }
    setNewNoteError('');
    const heading = newNoteTitle.trim().replace(/\.md$/i, '');
    const res = await fetch('/api/v1/file', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: relPath, content: `# ${heading}\n\n` })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      setNewNoteError(data.error || 'Failed to create note');
      return;
    }
    setNewNoteOpen(false);
    await fetchTree();
    await openInNewTab(relPath, 'preview');
  }

  function openNewFolderDialog(defaultFolder = null) {
    const fallbackFolder = activePath.includes('/') ? activePath.split('/').slice(0, -1).join('/') : '';
    const resolved = typeof defaultFolder === 'string' ? defaultFolder : fallbackFolder;
    setNewFolderName('');
    setNewFolderParent(resolved.replace(/^\/+|\/+$/g, ''));
    setNewFolderError('');
    setNewFolderOpen(true);
  }

  async function confirmNewFolder() {
    const relPath = buildNewFolderPath(newFolderName, newFolderParent);
    if (!relPath) {
      setNewFolderError('Please enter a folder name');
      return;
    }
    setNewFolderError('');
    const res = await fetch('/api/v1/dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: relPath })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      setNewFolderError(data.error || 'Failed to create folder');
      return;
    }
    setNewFolderOpen(false);
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (newFolderParent) next.delete(newFolderParent);
      next.delete(relPath);
      return next;
    });
    await fetchTree();
    showToast(`Created folder ${relPath}`);
  }

  return {
    deleteTarget,
    setDeleteTarget,
    deleteError,
    setDeleteError,
    fileMenu,
    setFileMenu,
    renameTarget,
    setRenameTarget,
    renameError,
    setRenameError,
    moveTarget,
    setMoveTarget,
    moveError,
    setMoveError,
    newNoteOpen,
    setNewNoteOpen,
    newNoteTitle,
    setNewNoteTitle,
    newNoteFolder,
    setNewNoteFolder,
    newNoteError,
    newFolderOpen,
    setNewFolderOpen,
    newFolderName,
    setNewFolderName,
    newFolderParent,
    setNewFolderParent,
    newFolderError,
    uploadInputRef,
    uploadDirRef,
    confirmDeleteFile,
    handleUploadToDir,
    confirmRenameFile,
    confirmMoveItem,
    openRowMenu,
    openNewNoteDialog,
    confirmNewNote,
    openNewFolderDialog,
    confirmNewFolder
  };
}
