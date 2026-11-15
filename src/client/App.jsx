import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadSettings, resolveStartupPath } from './lib/settings.js';
import {
  baseTitle,
  isImagePath,
  isDownloadOnlyPath,
  resolveRelative,
  buildNewNotePath
} from './lib/paths.js';
import { renderMarkdownWithLinks, highlightRawFile } from './lib/markdown.js';
import { useEdgeSwipe } from './lib/useEdgeSwipe.js';
import Sidebar from './components/Sidebar.jsx';
import TopbarAndTabs, { DesktopTabs } from './components/TopbarAndTabs.jsx';
import NoteViewer from './components/NoteViewer.jsx';
import OutlineSidebar from './components/OutlineSidebar.jsx';
import MobileOverlays from './components/modals/MobileOverlays.jsx';
import QuickSwitcherModal from './components/modals/QuickSwitcherModal.jsx';
import FileContextMenu from './components/modals/FileContextMenu.jsx';
import {
  NewNoteModal,
  RenameModal,
  DeleteConfirmModal,
  DiscardConfirmModal
} from './components/modals/FileDialogs.jsx';
import GitCommitModal from './components/modals/GitCommitModal.jsx';
import SettingsModal from './components/modals/SettingsModal.jsx';

export default function App() {
  const [tree, setTree] = useState([]);
  const [flatFiles, setFlatFiles] = useState([]);
  const [fileStats, setFileStats] = useState([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [backlinks, setBacklinks] = useState({});
  const [settings, setSettings] = useState(loadSettings);
  const [settingsTab, setSettingsTab] = useState('general');
  const initialPath = resolveStartupPath(settings);
  const [tabs, setTabs] = useState(() => [
    { id: 'tab-1', path: initialPath, title: baseTitle(initialPath), preview: '' }
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const activePath = activeTab?.path || '';
  const [tabsOpen, setTabsOpen] = useState(false);
  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'edit' | 'diff' | 'raw'
  const [diffData, setDiffData] = useState(null);
  const [discardTarget, setDiscardTarget] = useState(null);
  const [discardError, setDiscardError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [fileMenu, setFileMenu] = useState(null); // { type, path, x, y }
  const [renameTarget, setRenameTarget] = useState(null); // { type, oldPath, newPath }
  const [renameError, setRenameError] = useState('');
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteFolder, setNewNoteFolder] = useState('');
  const [newNoteError, setNewNoteError] = useState('');
  const uploadInputRef = useRef(null);
  const uploadDirRef = useRef('');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('files'); // 'files' | 'changes'
  const [gitChanges, setGitChanges] = useState([]);
  const [changesSort, setChangesSort] = useState('path'); // 'path' | 'recent' | 'status'
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitPush, setCommitPush] = useState(false);
  const [commitSelected, setCommitSelected] = useState(() => new Set());
  const [commitBusy, setCommitBusy] = useState(false);
  const [commitStatus, setCommitStatus] = useState(null);
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set(settings.autoCollapsed));
  const [live, setLive] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [outlineDrawerOpen, setOutlineDrawerOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherTab, setSwitcherTab] = useState('recent'); // 'recent' | 'alpha'
  const [switcherQuery, setSwitcherQuery] = useState('');
  const [switcherIdx, setSwitcherIdx] = useState(0);
  const [contentHits, setContentHits] = useState([]);
  const [pagedFiles, setPagedFiles] = useState({ items: [], hasMore: false });
  const [reloadTick, setReloadTick] = useState(0);

  const searchRef = useRef(null);
  const switcherInputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    localStorage.setItem('vault-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSwitcher();
        return;
      }
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        openSwitcher();
      }
      if (e.key === 'Escape' && switcherOpen) {
        setSwitcherOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [switcherOpen]);

  function openSwitcher() {
    setSwitcherQuery('');
    setSwitcherIdx(0);
    setContentHits([]);
    setSwitcherOpen(true);
    setTimeout(() => switcherInputRef.current?.focus(), 40);
  }

  useEffect(() => {
    if (!switcherOpen) return;
    const q = switcherQuery.trim();
    if (!q) {
      setContentHits([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setContentHits(data.results || []);
      } catch {
        setContentHits([]);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [switcherQuery, switcherOpen]);

  const hiddenSet = useMemo(
    () => new Set(settings.hiddenFolders.map((d) => d.toLowerCase())),
    [settings.hiddenFolders]
  );

  const allFolders = useMemo(() => {
    const out = [''];
    const walk = (nodes) => {
      for (const n of nodes) {
        if (n.type === 'dir') {
          if (hiddenSet.has(n.path.toLowerCase()) || hiddenSet.has(n.name.toLowerCase())) continue;
          out.push(n.path);
          walk(n.children || []);
        }
      }
    };
    walk(tree);
    return out;
  }, [tree, hiddenSet]);

  const isLargeVault = totalFiles > fileStats.length;

  useEffect(() => {
    if (!switcherOpen || !isLargeVault) {
      setPagedFiles({ items: [], hasMore: false });
      return;
    }
    const sort = switcherTab === 'alpha' ? 'name' : 'mtime';
    const q = switcherQuery.trim();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/files?sort=${sort}&offset=0&limit=100&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setPagedFiles({ items: data.items || [], hasMore: Boolean(data.hasMore) });
      } catch {
        setPagedFiles({ items: [], hasMore: false });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [switcherOpen, isLargeVault, switcherTab, switcherQuery]);

  async function loadMorePagedFiles() {
    const sort = switcherTab === 'alpha' ? 'name' : 'mtime';
    const q = switcherQuery.trim();
    const offset = pagedFiles.items.length;
    const res = await fetch(`/api/v1/files?sort=${sort}&offset=${offset}&limit=100&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setPagedFiles((prev) => ({
      items: [...prev.items, ...(data.items || [])],
      hasMore: Boolean(data.hasMore)
    }));
  }

  const switcherData = useMemo(() => {
    const q = switcherQuery.trim().toLowerCase();
    const isExcluded = (p) => {
      const lower = p.toLowerCase();
      if (settings.hiddenFolders.some((dir) => lower.startsWith(dir.toLowerCase() + '/'))) return true;
      if (!settings.hideCollapsedInSearch) return false;
      return settings.autoCollapsed.some((dir) => {
        const prefix = dir.toLowerCase() + '/';
        return lower.startsWith(prefix) && !q.includes(dir.toLowerCase());
      });
    };

    const baseList = isLargeVault
      ? pagedFiles.items
      : fileStats.length > 0
        ? fileStats
        : flatFiles.map((p) => ({ path: p, mtimeMs: 0 }));
    const mtimeMap = new Map(baseList.map((f) => [f.path, f.mtimeMs || 0]));

    let candidates;
    if (!q) {
      candidates = baseList
        .filter((f) => !isExcluded(f.path))
        .map((f) => ({ path: f.path, mtimeMs: f.mtimeMs || 0, snippet: '' }));
    } else {
      const pathMatches = baseList
        .filter((f) => !isExcluded(f.path) && f.path.toLowerCase().includes(q))
        .map((f) => ({ path: f.path, mtimeMs: f.mtimeMs || 0, snippet: '' }));
      const seen = new Set(pathMatches.map((x) => x.path));
      for (const hit of contentHits) {
        if (!isExcluded(hit.path) && !seen.has(hit.path)) {
          seen.add(hit.path);
          pathMatches.push({
            path: hit.path,
            mtimeMs: hit.mtimeMs ?? mtimeMap.get(hit.path) ?? 0,
            snippet: hit.snippet || ''
          });
        }
      }
      candidates = pathMatches;
    }

    const maxVisible = isLargeVault ? candidates.length : 100;
    if (switcherTab === 'alpha') {
      const sorted = [...candidates]
        .sort((a, b) => {
          const nameA = a.path.split('/').pop().toLowerCase();
          const nameB = b.path.split('/').pop().toLowerCase();
          return nameA.localeCompare(nameB) || a.path.localeCompare(b.path);
        })
        .slice(0, maxVisible);
      return { groups: [{ label: null, items: sorted }], items: sorted };
    }

    const sorted = [...candidates].sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0)).slice(0, maxVisible);
    const now = Date.now();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();
    const dayMs = 86400000;

    const buckets = new Map([
      ['Today', []],
      ['Yesterday', []],
      ['Last 7 days', []],
      ['Last 30 days', []],
      ['Older', []]
    ]);
    for (const item of sorted) {
      const m = item.mtimeMs || 0;
      if (m >= todayMs) buckets.get('Today').push(item);
      else if (m >= todayMs - dayMs) buckets.get('Yesterday').push(item);
      else if (m >= todayMs - 7 * dayMs) buckets.get('Last 7 days').push(item);
      else if (m >= todayMs - 30 * dayMs) buckets.get('Last 30 days').push(item);
      else buckets.get('Older').push(item);
    }
    const groups = [];
    const flat = [];
    for (const [label, list] of buckets) {
      if (list.length > 0) {
        groups.push({ label, items: list });
        flat.push(...list);
      }
    }
    return { groups, items: flat };
  }, [
    switcherQuery,
    switcherTab,
    isLargeVault,
    pagedFiles.items,
    fileStats,
    flatFiles,
    contentHits,
    settings.autoCollapsed,
    settings.hiddenFolders,
    settings.hideCollapsedInSearch
  ]);

  const switcherItems = switcherData.items;

  async function fetchTree() {
    const [treeRes, changesRes] = await Promise.all([
      fetch('/api/v1/tree?limit=10000'),
      fetch('/api/v1/changes')
    ]);
    const data = await treeRes.json();
    setTree(data.tree);
    setFlatFiles(data.flatFiles);
    setFileStats(data.fileStats || []);
    setTotalFiles(data.totalFiles ?? data.flatFiles?.length ?? 0);
    setBacklinks(data.backlinks);
    if (changesRes.ok) {
      const cData = await changesRes.json();
      setGitChanges(cData.changes || []);
    }
  }

  function createNewTab() {
    const id = `tab-${Date.now()}`;
    setTabs((prev) => [...prev, { id, path: null, title: 'New tab', preview: '' }]);
    setActiveTabId(id);
    setContent('');
    setTabsOpen(false);
    setDrawerOpen(false);
    setFabOpen(false);
  }

  function closeTab(id, e) {
    e?.stopPropagation();
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        const fresh = { id: `tab-${Date.now()}`, path: null, title: 'New tab', preview: '' };
        setActiveTabId(fresh.id);
        setContent('');
        return [fresh];
      }
      if (id === activeTabId) {
        const target = next[next.length - 1];
        setActiveTabId(target.id);
        if (target.path) openFile(target.path, false, target.id);
        else setContent('');
      }
      return next;
    });
  }

  function switchTab(tab) {
    setActiveTabId(tab.id);
    setTabsOpen(false);
    if (tab.path) {
      openFile(tab.path, false, tab.id);
    } else {
      setContent('');
      location.hash = '';
    }
  }

  async function openFile(relPath, preserveScroll = false, targetTabId = activeTabId) {
    if (!relPath) {
      setContent('');
      return;
    }
    const prevScroll = scrollRef.current?.scrollTop ?? 0;

    let nextPreview = '';
    if (isImagePath(relPath) || isDownloadOnlyPath(relPath)) {
      const checkRes = await fetch(`/api/v1/file?path=${encodeURIComponent(relPath)}`, {
        method: 'HEAD'
      });
      if (!checkRes.ok) {
        if (relPath !== 'README.md') return openFile('README.md', false, targetTabId);
        return;
      }
      setContent('');
      setDraftContent('');
      setDirty(false);
      nextPreview = isImagePath(relPath) ? '[Image preview]' : '[Binary file — download]';
    } else {
      const res = await fetch(`/api/v1/file?path=${encodeURIComponent(relPath)}`);
      if (!res.ok) {
        if (relPath !== 'README.md') return openFile('README.md', false, targetTabId);
        return;
      }
      const text = await res.text();
      setContent(text);
      setDraftContent(text);
      setDirty(false);
      nextPreview = text.replace(/^#+\s*/gm, '').slice(0, 260);
    }

    location.hash = encodeURIComponent(relPath);
    localStorage.setItem('vault-last-path', relPath);

    setTabs((prev) =>
      prev.map((t) =>
        t.id === targetTabId ? { ...t, path: relPath, title: baseTitle(relPath), preview: nextPreview } : t
      )
    );

    if (!preserveScroll) {
      setDrawerOpen(false);
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      });
    } else {
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = prevScroll;
      });
    }
    if (viewMode === 'diff') loadDiff(relPath);
  }

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

  async function confirmDeleteFile() {
    if (!deleteTarget) return;
    setDeleteError('');
    const res = await fetch(`/api/v1/file?path=${encodeURIComponent(deleteTarget)}`, {
      method: 'DELETE'
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const deleted = deleteTarget;
      setDeleteTarget(null);
      if (localStorage.getItem('vault-last-path') === deleted) {
        localStorage.removeItem('vault-last-path');
      }
      const pruneNodes = (nodes) =>
        nodes
          .filter((n) => !(n.type === 'file' && n.path === deleted))
          .map((n) => (n.type === 'dir' ? { ...n, children: pruneNodes(n.children || []) } : n));
      setTree((prev) => pruneNodes(prev));
      setFlatFiles((prev) => prev.filter((f) => f !== deleted));
      setFileStats((prev) => prev.filter((f) => f.path !== deleted));
      setGitChanges((prev) => prev.filter((c) => c.path !== deleted));

      if (deleted === activePath) {
        setViewMode('preview');
        const remaining = tabs.filter((t) => t.path !== deleted);
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
          await openFile('README.md', false, activeTabId);
        }
      } else {
        setTabs((prev) => prev.filter((t) => t.path !== deleted));
      }
      await fetchTree();
    } else {
      setDeleteError(data.error || 'Failed to delete file');
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

  async function confirmRenameFile() {
    if (!renameTarget?.oldPath || !renameTarget?.newPath.trim()) return;
    setRenameError('');
    const isDir = renameTarget.type === 'dir';
    const endpoint = isDir ? '/api/v1/dir/rename' : '/api/v1/file/rename';
    const cleanNew = renameTarget.newPath.trim().replace(/^\/+|\/+$/g, '');
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldPath: renameTarget.oldPath,
        newPath: cleanNew
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const { oldPath } = renameTarget;
      setRenameTarget(null);
      await fetchTree();
      if (isDir) {
        if (activePath.startsWith(`${oldPath}/`)) {
          openFile(`${cleanNew}${activePath.slice(oldPath.length)}`);
        }
      } else if (oldPath === activePath) {
        openFile(cleanNew);
      }
    } else {
      setRenameError(data.error || 'Failed to rename');
    }
  }

  function openRowMenu(targetPath, rect, type = 'file') {
    const menuW = window.innerWidth <= 768 ? 215 : 175;
    const menuH = window.innerWidth <= 768 ? 310 : 250;
    const x = Math.min(rect.right - menuW, window.innerWidth - (menuW + 12));
    const y = Math.min(rect.bottom + 4, window.innerHeight - menuH);
    setFileMenu({ type, path: targetPath, x: Math.max(8, x), y: Math.max(8, y) });
  }

  function openNewNoteDialog(defaultFolder = '') {
    setNewNoteTitle('');
    setNewNoteFolder(defaultFolder.replace(/^\/+|\/+$/g, ''));
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
    setViewMode('edit');
    openFile(relPath);
  }

  useEffect(() => {
    fetchTree();
    openFile(activePath);
  }, []);

  useEffect(() => {
    const onHash = () => {
      const target = decodeURIComponent(location.hash.slice(1) || '');
      if (target && target !== activePath) openFile(target);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [activePath]);

  useEffect(() => {
    const es = new EventSource('/api/v1/events');
    es.onopen = () => setLive(true);
    es.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'reload') {
        await fetchTree();
        setReloadTick((t) => t + 1);
        await openFile(activePath, true);
      }
    };
    es.onerror = () => setLive(false);
    return () => es.close();
  }, [activePath]);

  async function saveActiveNote(markdown) {
    if (!activePath) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activePath, content: markdown })
      });
      if (res.ok) {
        setContent(markdown);
        setDraftContent(markdown);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  }

  const { renderedHtml, headings } = useMemo(() => {
    if (!activePath.endsWith('.md') || viewMode !== 'preview' || isImagePath(activePath) || isDownloadOnlyPath(activePath)) {
      return { renderedHtml: '', headings: [] };
    }
    return renderMarkdownWithLinks(content, activePath, flatFiles);
  }, [content, activePath, viewMode, flatFiles]);

  const highlightedRawHtml = useMemo(() => {
    if (!content) return '';
    if (viewMode !== 'raw' && activePath.endsWith('.md')) return '';
    return highlightRawFile(content, activePath);
  }, [content, activePath, viewMode]);

  function handleDocClick(e) {
    const wiki = e.target.closest('a.wikilink');
    if (wiki) {
      e.preventDefault();
      openFile(wiki.dataset.path);
      return;
    }
    const rel = e.target.closest('a.md-rel-link');
    if (rel) {
      e.preventDefault();
      const target = resolveRelative(activePath, rel.dataset.href);
      if (flatFiles.includes(target)) openFile(target);
    }
  }

  function toggleDir(dirPath) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
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

  const currentBacklinks = backlinks[activePath] || [];
  const isImg = isImagePath(activePath);
  const isBinaryDownload = isDownloadOnlyPath(activePath);

  const outlinePosition = settings.outlinePosition || 'right';
  const setOutlinePosition = (pos) => setSettings((s) => ({ ...s, outlinePosition: pos }));
  const handleOpenOutline = () => {
    setOutlinePosition('right');
    if (window.innerWidth <= 960) {
      setDrawerOpen(false);
      setOutlineDrawerOpen(true);
    }
  };
  const handleToggleOutline = () => {
    if (window.innerWidth <= 960) {
      if (outlinePosition === 'bottom') {
        setOutlinePosition('hidden');
        setOutlineDrawerOpen(false);
      } else {
        if (outlinePosition === 'hidden') setOutlinePosition('right');
        setDrawerOpen(false);
        setOutlineDrawerOpen((o) => !o);
      }
    } else {
      setOutlinePosition(outlinePosition === 'hidden' ? 'right' : 'hidden');
    }
  };

  useEdgeSwipe({
    drawerOpen,
    outlineDrawerOpen,
    outlinePosition,
    setDrawerOpen,
    onOpenOutline: handleOpenOutline,
    setOutlineDrawerOpen,
    disabled: Boolean(
      switcherOpen ||
        settingsOpen ||
        tabsOpen ||
        commitOpen ||
        fabOpen ||
        newNoteOpen ||
        renameTarget ||
        deleteTarget ||
        discardTarget
    )
  });

  return (
    <>
      <div
        className={`backdrop${drawerOpen || outlineDrawerOpen ? ' open' : ''}`}
        onClick={() => {
          setDrawerOpen(false);
          setOutlineDrawerOpen(false);
        }}
      />
      <div className="app">
        <Sidebar
          drawerOpen={drawerOpen}
          live={live}
          settings={settings}
          setSettings={setSettings}
          sidebarTab={sidebarTab}
          setSidebarTab={setSidebarTab}
          gitChanges={gitChanges}
          searchRef={searchRef}
          filter={filter}
          setFilter={setFilter}
          tree={tree}
          activePath={activePath}
          collapsed={collapsed}
          hiddenSet={hiddenSet}
          toggleDir={toggleDir}
          setViewMode={setViewMode}
          openFile={openFile}
          openRowMenu={openRowMenu}
          changesSort={changesSort}
          setChangesSort={setChangesSort}
          openCommitDialog={openCommitDialog}
          sortedChanges={sortedChanges}
          loadDiff={loadDiff}
        />

        <main className="main">
          <DesktopTabs
            tabs={tabs}
            activeTabId={activeTabId}
            switchTab={switchTab}
            closeTab={closeTab}
            createNewTab={createNewTab}
          />

          <div className={`workspace-body outline-${outlinePosition}`}>
            <div className="note-pane">
              <TopbarAndTabs
                setDrawerOpen={setDrawerOpen}
                activePath={activePath}
                moreMenuOpen={moreMenuOpen}
                setMoreMenuOpen={setMoreMenuOpen}
                viewMode={viewMode}
                setViewMode={setViewMode}
                loadDiff={loadDiff}
                setDeleteError={setDeleteError}
                setDeleteTarget={setDeleteTarget}
                outlinePosition={outlinePosition}
                outlineDrawerOpen={outlineDrawerOpen}
                onToggleOutline={handleToggleOutline}
                onOpenOutline={handleOpenOutline}
              />

              <NoteViewer
                scrollRef={scrollRef}
                activePath={activePath}
                openNewNoteDialog={openNewNoteDialog}
                openFile={openFile}
                openSwitcher={openSwitcher}
                setDrawerOpen={setDrawerOpen}
                setSettingsOpen={setSettingsOpen}
                isImg={isImg}
                reloadTick={reloadTick}
                isBinaryDownload={isBinaryDownload}
                viewMode={viewMode}
                settings={settings}
                diffData={diffData}
                requestDiscard={requestDiscard}
                content={content}
                saving={saving}
                dirty={dirty}
                setDraftContent={setDraftContent}
                setDirty={setDirty}
                saveActiveNote={saveActiveNote}
                highlightedRawHtml={highlightedRawHtml}
                handleDocClick={handleDocClick}
                renderedHtml={renderedHtml}
              />
            </div>

            <OutlineSidebar
              headings={headings}
              isImg={isImg}
              isBinaryDownload={isBinaryDownload}
              viewMode={viewMode}
              currentBacklinks={currentBacklinks}
              openFile={openFile}
              position={outlinePosition}
              onChangePosition={setOutlinePosition}
              mobileOpen={outlineDrawerOpen}
              onCloseMobile={() => setOutlineDrawerOpen(false)}
            />
          </div>
        </main>
      </div>

      <MobileOverlays
        fabOpen={fabOpen}
        setFabOpen={setFabOpen}
        openSwitcher={openSwitcher}
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        onToggleOutline={handleToggleOutline}
        openFile={openFile}
        viewMode={viewMode}
        setViewMode={setViewMode}
        settings={settings}
        setSettings={setSettings}
        setSettingsOpen={setSettingsOpen}
        scrollRef={scrollRef}
        loadDiff={loadDiff}
        activePath={activePath}
        createNewTab={createNewTab}
        tabsOpen={tabsOpen}
        setTabsOpen={setTabsOpen}
        tabs={tabs}
        activeTabId={activeTabId}
        switchTab={switchTab}
        closeTab={closeTab}
      />

      <QuickSwitcherModal
        switcherOpen={switcherOpen}
        setSwitcherOpen={setSwitcherOpen}
        switcherTab={switcherTab}
        setSwitcherTab={setSwitcherTab}
        switcherIdx={switcherIdx}
        setSwitcherIdx={setSwitcherIdx}
        switcherInputRef={switcherInputRef}
        totalFiles={totalFiles}
        fileStats={fileStats}
        switcherItems={switcherItems}
        switcherData={switcherData}
        openFile={openFile}
        isLargeVault={isLargeVault}
        pagedFiles={pagedFiles}
        loadMorePagedFiles={loadMorePagedFiles}
        switcherQuery={switcherQuery}
        setSwitcherQuery={setSwitcherQuery}
      />

      <input
        ref={uploadInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          handleUploadToDir(e.target.files);
          e.target.value = '';
        }}
      />

      <FileContextMenu
        fileMenu={fileMenu}
        setFileMenu={setFileMenu}
        openNewNoteDialog={openNewNoteDialog}
        uploadDirRef={uploadDirRef}
        uploadInputRef={uploadInputRef}
        setRenameError={setRenameError}
        setRenameTarget={setRenameTarget}
        setTabs={setTabs}
        setActiveTabId={setActiveTabId}
        setViewMode={setViewMode}
        openFile={openFile}
        gitChanges={gitChanges}
        loadDiff={loadDiff}
        requestDiscard={requestDiscard}
        setDeleteError={setDeleteError}
        setDeleteTarget={setDeleteTarget}
      />

      <NewNoteModal
        newNoteOpen={newNoteOpen}
        setNewNoteOpen={setNewNoteOpen}
        newNoteTitle={newNoteTitle}
        setNewNoteTitle={setNewNoteTitle}
        newNoteFolder={newNoteFolder}
        setNewNoteFolder={setNewNoteFolder}
        allFolders={allFolders}
        newNoteError={newNoteError}
        confirmNewNote={confirmNewNote}
      />

      <RenameModal
        renameTarget={renameTarget}
        setRenameTarget={setRenameTarget}
        renameError={renameError}
        confirmRenameFile={confirmRenameFile}
      />

      <DeleteConfirmModal
        deleteTarget={deleteTarget}
        setDeleteTarget={setDeleteTarget}
        deleteError={deleteError}
        confirmDeleteFile={confirmDeleteFile}
      />

      <DiscardConfirmModal
        discardTarget={discardTarget}
        setDiscardTarget={setDiscardTarget}
        discardError={discardError}
        confirmDiscard={confirmDiscard}
      />

      <GitCommitModal
        commitOpen={commitOpen}
        setCommitOpen={setCommitOpen}
        commitSelected={commitSelected}
        setCommitSelected={setCommitSelected}
        gitChanges={gitChanges}
        commitMessage={commitMessage}
        setCommitMessage={setCommitMessage}
        commitPush={commitPush}
        setCommitPush={setCommitPush}
        commitStatus={commitStatus}
        commitBusy={commitBusy}
        handleCommitSubmit={handleCommitSubmit}
      />

      <SettingsModal
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        settingsTab={settingsTab}
        setSettingsTab={setSettingsTab}
        settings={settings}
        setSettings={setSettings}
        setCollapsed={setCollapsed}
      />
    </>
  );
}
