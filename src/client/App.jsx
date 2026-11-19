import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadSettings, resolveStartupPath } from './lib/settings.js';
import {
  baseTitle,
  isAudioPath,
  isCsvPath,
  isDownloadOnlyPath,
  isHtmlPath,
  isImagePath,
  isMarkdownPath,
  isPdfPath,
  isSvgPath,
  isVideoPath,
  resolveRelative,
  buildNewFolderPath,
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
  NewFolderModal,
  NewNoteModal,
  RenameModal,
  MoveModal,
  DeleteConfirmModal,
  DiscardConfirmModal
} from './components/modals/FileDialogs.jsx';
import GitCommitModal from './components/modals/GitCommitModal.jsx';
import SettingsModal from './components/modals/SettingsModal.jsx';
import LoginScreen from './components/modals/LoginScreen.jsx';

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
  const [authState, setAuthState] = useState({ checked: false, required: false, authenticated: false });
  const [switcherTab, setSwitcherTab] = useState('recent'); // 'recent' | 'alpha'
  const [switcherQuery, setSwitcherQuery] = useState('');
  const [switcherIdx, setSwitcherIdx] = useState(0);
  const [contentHits, setContentHits] = useState([]);
  const [pagedFiles, setPagedFiles] = useState({ items: [], hasMore: false });
  const [reloadTick, setReloadTick] = useState(0);
  const [readOnly, setReadOnly] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const v = Number(localStorage.getItem('pagedex-sidebar-width'));
      return Number.isFinite(v) && v >= 200 && v <= 480 ? v : 270;
    } catch {
      return 270;
    }
  });
  const [outlineWidth, setOutlineWidth] = useState(() => {
    try {
      const v = Number(localStorage.getItem('pagedex-outline-width'));
      return Number.isFinite(v) && v >= 200 && v <= 440 ? v : 240;
    } catch {
      return 240;
    }
  });
  const [pinned, setPinned] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pagedex-pinned') || '[]');
      return Array.isArray(saved)
        ? saved.filter((item) => item && typeof item.path === 'string' && (item.type === 'file' || item.type === 'dir'))
        : [];
    } catch {
      return [];
    }
  });

  const searchRef = useRef(null);
  const switcherInputRef = useRef(null);
  const scrollRef = useRef(null);
  const activePathRef = useRef(activePath);
  const activeTabIdRef = useRef(activeTab?.id || activeTabId);
  const tabsRef = useRef(tabs);
  const switchTabRef = useRef(null);
  activePathRef.current = activePath;
  activeTabIdRef.current = activeTab?.id || activeTabId;
  tabsRef.current = tabs;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    localStorage.setItem('vault-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem('pagedex-pinned', JSON.stringify(pinned));
    } catch {
      // Ignore storage quota / restricted context errors
    }
  }, [pinned]);

  function showToast(msg) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1800);
  }

  function isPinned(itemPath) {
    return pinned.some((item) => item.path === itemPath);
  }

  function togglePin(itemPath, type) {
    const already = pinned.some((item) => item.path === itemPath);
    const label = itemPath.split('/').pop() || itemPath;
    setPinned((prev) => {
      if (prev.some((item) => item.path === itemPath)) {
        return prev.filter((item) => item.path !== itemPath);
      }
      return [...prev, { path: itemPath, type }];
    });
    showToast(already ? `Unpinned ${label}` : `Pinned ${label}`);
  }

  function reorderPinned(fromPath, toPath) {
    setPinned((prev) => {
      const fromIdx = prev.findIndex((item) => item.path === fromPath);
      const toIdx = prev.findIndex((item) => item.path === toPath);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }

  function startResizeSidebar(e) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    let latestW = startW;
    const onMove = (ev) => {
      latestW = Math.min(480, Math.max(200, Math.round(startW + (ev.clientX - startX))));
      setSidebarWidth(latestW);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      try {
        localStorage.setItem('pagedex-sidebar-width', String(latestW));
      } catch {}
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function startResizeOutline(e) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = outlineWidth;
    let latestW = startW;
    const onMove = (ev) => {
      latestW = Math.min(440, Math.max(200, Math.round(startW - (ev.clientX - startX))));
      setOutlineWidth(latestW);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      try {
        localStorage.setItem('pagedex-outline-width', String(latestW));
      } catch {}
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  useEffect(() => {
    const cycleTab = (delta) => {
      const list = tabsRef.current;
      if (list.length <= 1) return;
      const idx = list.findIndex((t) => t.id === activeTabIdRef.current);
      const nextIdx = idx === -1 ? 0 : (idx + delta + list.length) % list.length;
      switchTabRef.current?.(list[nextIdx]);
    };
    const onKey = (e) => {
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && (key === 'k' || key === 'o')) {
        e.preventDefault();
        openSwitcher();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setSidebarCollapsed((v) => !v);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && key === 'e') {
        if (!readOnly && activePathRef.current && isMarkdownPath(activePathRef.current)) {
          e.preventDefault();
          setViewMode((m) => (m === 'edit' ? 'preview' : 'edit'));
        }
        return;
      }
      if (e.altKey && !e.metaKey && !e.ctrlKey && (e.code === 'BracketLeft' || e.code === 'BracketRight')) {
        e.preventDefault();
        cycleTab(e.code === 'BracketRight' ? 1 : -1);
        return;
      }
      const el = document.activeElement;
      const inEditable =
        el?.tagName === 'INPUT' ||
        el?.tagName === 'TEXTAREA' ||
        el?.tagName === 'SELECT' ||
        el?.isContentEditable;
      if (!inEditable && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === '[' || e.key === ']')) {
        e.preventDefault();
        cycleTab(e.key === ']' ? 1 : -1);
        return;
      }
      if (e.key === '/' && !inEditable) {
        e.preventDefault();
        openSwitcher();
      }
      if (e.key === 'Escape' && switcherOpen) {
        setSwitcherOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [switcherOpen, readOnly]);

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
      return settings.hiddenFolders.some((dir) => lower.startsWith(dir.toLowerCase() + '/'));
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
    settings.hiddenFolders
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

  async function openInNewTab(relPath, mode = 'preview') {
    const existing = tabsRef.current.find((t) => t.path === relPath);
    if (existing) {
      switchTab(existing);
      setViewMode(mode);
      return;
    }
    const id = `tab-${Date.now()}`;
    activePathRef.current = relPath;
    activeTabIdRef.current = id;
    setTabs((prev) => {
      if (prev.length === 1 && !prev[0].path) {
        return [{ id, path: relPath, title: baseTitle(relPath), preview: '' }];
      }
      return [...prev, { id, path: relPath, title: baseTitle(relPath), preview: '' }];
    });
    setActiveTabId(id);
    await openFile(relPath, false, id);
    setViewMode(mode);
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
    const next = tabs.filter((t) => t.id !== id);
    if (next.length === 0) {
      const fresh = { id: `tab-${Date.now()}`, path: null, title: 'New tab', preview: '' };
      setTabs([fresh]);
      setActiveTabId(fresh.id);
      setContent('');
      location.hash = '';
      return;
    }
    setTabs(next);
    if (id === (activeTab?.id || activeTabId)) {
      const target = next[next.length - 1];
      setActiveTabId(target.id);
      if (target.path) openFile(target.path, false, target.id);
      else {
        setContent('');
        location.hash = '';
      }
    }
  }

  function switchTab(tab) {
    activeTabIdRef.current = tab.id;
    activePathRef.current = tab.path || '';
    setActiveTabId(tab.id);
    setTabsOpen(false);
    if (tab.path) {
      openFile(tab.path, false, tab.id);
    } else {
      setContent('');
      location.hash = '';
    }
  }
  switchTabRef.current = switchTab;

  async function openFile(relPath, preserveScroll = false, targetTabId = activeTab?.id || activeTabId) {
    if (!relPath) {
      setContent('');
      return;
    }
    const prevScroll = scrollRef.current?.scrollTop ?? 0;

    let nextPreview = '';
    const isBinaryMedia =
      (isImagePath(relPath) && !isSvgPath(relPath)) ||
      isPdfPath(relPath) ||
      isAudioPath(relPath) ||
      isVideoPath(relPath) ||
      isDownloadOnlyPath(relPath);
    if (isBinaryMedia) {
      const checkRes = await fetch(`/api/v1/file?path=${encodeURIComponent(relPath)}`, {
        method: 'HEAD'
      });
      if (!checkRes.ok) {
        setContent('');
        setDraftContent('');
        setDirty(false);
        setTabs((prev) =>
          prev.map((t) => (t.id === targetTabId ? { ...t, path: null, title: 'New tab', preview: '' } : t))
        );
        return;
      }
      setContent('');
      setDraftContent('');
      setDirty(false);
      if (isImagePath(relPath)) nextPreview = '[Image preview]';
      else if (isPdfPath(relPath)) nextPreview = '[PDF document]';
      else if (isAudioPath(relPath)) nextPreview = '[Audio]';
      else if (isVideoPath(relPath)) nextPreview = '[Video]';
      else nextPreview = '[Binary file — download]';
    } else {
      const res = await fetch(`/api/v1/file?path=${encodeURIComponent(relPath)}`);
      if (!res.ok) {
        setContent('');
        setDraftContent('');
        setDirty(false);
        setTabs((prev) =>
          prev.map((t) => (t.id === targetTabId ? { ...t, path: null, title: 'New tab', preview: '' } : t))
        );
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
      setPinned((prev) => prev.filter((p) => p.path !== deleted && !p.path.startsWith(`${deleted}/`)));

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
          const fresh = { id: `tab-${Date.now()}`, path: null, title: 'New tab', preview: '' };
          setTabs([fresh]);
          setActiveTabId(fresh.id);
          setContent('');
          setDirty(false);
          location.hash = '';
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

  useEffect(() => {
    fetch('/api/v1/auth/status')
      .then((r) => (r.ok ? r.json() : { required: false, authenticated: true }))
      .then((d) => {
        setAuthState({
          checked: true,
          required: Boolean(d?.required),
          authenticated: Boolean(d?.authenticated)
        });
      })
      .catch(() => {
        setAuthState({ checked: true, required: false, authenticated: true });
      });
  }, []);

  const canAccessVault = authState.checked && (!authState.required || authState.authenticated);

  useEffect(() => {
    if (!canAccessVault) return;
    fetch('/api/v1/health')
      .then((r) => {
        if (r.status === 401) {
          setAuthState({ checked: true, required: true, authenticated: false });
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (d && typeof d.readOnly === 'boolean') setReadOnly(d.readOnly);
      })
      .catch(() => {});
    fetchTree();
    openFile(activePath);
  }, [canAccessVault]);

  async function handleLogout() {
    await fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
    setAuthState({ checked: true, required: true, authenticated: false });
  }

  useEffect(() => {
    const onHash = () => {
      const target = decodeURIComponent(location.hash.slice(1) || '');
      if (target && target !== activePathRef.current) {
        openFile(target, false, activeTabIdRef.current);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!canAccessVault) return;
    const es = new EventSource('/api/v1/events');
    es.onopen = () => setLive(true);
    es.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'reload') {
        await fetchTree();
        setReloadTick((t) => t + 1);
        const currentPath = activePathRef.current;
        if (currentPath) {
          await openFile(currentPath, true, activeTabIdRef.current);
        }
      }
    };
    es.onerror = () => setLive(false);
    return () => es.close();
  }, [canAccessVault]);

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
        showToast('Saved');
      }
    } finally {
      setSaving(false);
    }
  }

  const { renderedHtml, headings } = useMemo(() => {
    if (!isMarkdownPath(activePath) || viewMode !== 'preview' || isImagePath(activePath) || isDownloadOnlyPath(activePath)) {
      return { renderedHtml: '', headings: [] };
    }
    return renderMarkdownWithLinks(content, activePath, flatFiles);
  }, [content, activePath, viewMode, flatFiles]);

  const highlightedRawHtml = useMemo(() => {
    if (!content) return '';
    if (viewMode !== 'raw' && isMarkdownPath(activePath)) return '';
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
  const isSvg = isSvgPath(activePath);
  const isMarkdown = isMarkdownPath(activePath);
  const isPdf = isPdfPath(activePath);
  const isAudio = isAudioPath(activePath);
  const isVideo = isVideoPath(activePath);
  const isHtml = isHtmlPath(activePath);
  const isCsv = isCsvPath(activePath);
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
  const handleToggleSidebar = () => {
    if (window.innerWidth <= 768) {
      setOutlineDrawerOpen(false);
      setDrawerOpen((o) => !o);
    } else {
      setSidebarCollapsed((c) => !c);
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
        moveTarget ||
        deleteTarget ||
        discardTarget
    )
  });

  if (!authState.checked) {
    return <div className="login-screen" />;
  }

  if (authState.required && !authState.authenticated) {
    return (
      <LoginScreen
        onAuthenticated={() => setAuthState({ checked: true, required: true, authenticated: true })}
      />
    );
  }

  return (
    <>
      <div
        className={`backdrop${drawerOpen || outlineDrawerOpen ? ' open' : ''}`}
        onClick={() => {
          setDrawerOpen(false);
          setOutlineDrawerOpen(false);
        }}
      />
      <div
        className={`app${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}
        style={{ '--sidebar-w': `${sidebarWidth}px`, '--outline-w': `${outlineWidth}px` }}
      >
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
          pinned={pinned}
          activePath={activePath}
          collapsed={collapsed}
          hiddenSet={hiddenSet}
          toggleDir={toggleDir}
          setViewMode={setViewMode}
          openFile={openFile}
          openInNewTab={openInNewTab}
          openRowMenu={openRowMenu}
          changesSort={changesSort}
          setChangesSort={setChangesSort}
          openCommitDialog={openCommitDialog}
          sortedChanges={sortedChanges}
          loadDiff={loadDiff}
          readOnly={readOnly}
          openNewNoteDialog={openNewNoteDialog}
          onReorderPinned={reorderPinned}
          onStartResizeSidebar={startResizeSidebar}
          authRequired={authState.required}
          onLogout={handleLogout}
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
                setRenameError={setRenameError}
                setRenameTarget={setRenameTarget}
                setMoveError={setMoveError}
                setMoveTarget={setMoveTarget}
                openInNewTab={openInNewTab}
                isPinned={isPinned}
                togglePin={togglePin}
                gitChanges={gitChanges}
                requestDiscard={requestDiscard}
                showToast={showToast}
                outlinePosition={outlinePosition}
                outlineDrawerOpen={outlineDrawerOpen}
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={handleToggleSidebar}
                onToggleOutline={handleToggleOutline}
                onOpenOutline={handleOpenOutline}
                readOnly={readOnly}
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
                isSvg={isSvg}
                isMarkdown={isMarkdown}
                isPdf={isPdf}
                isAudio={isAudio}
                isVideo={isVideo}
                isHtml={isHtml}
                isCsv={isCsv}
                reloadTick={reloadTick}
                isBinaryDownload={isBinaryDownload}
                viewMode={viewMode}
                setViewMode={setViewMode}
                settings={settings}
                diffData={diffData}
                requestDiscard={requestDiscard}
                content={content}
                draftContent={draftContent}
                saving={saving}
                dirty={dirty}
                setDraftContent={setDraftContent}
                setDirty={setDirty}
                saveActiveNote={saveActiveNote}
                highlightedRawHtml={highlightedRawHtml}
                handleDocClick={handleDocClick}
                renderedHtml={renderedHtml}
                readOnly={readOnly}
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
              onStartResizeOutline={startResizeOutline}
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
        onToggleSidebar={handleToggleSidebar}
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
        readOnly={readOnly}
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
        openInNewTab={openInNewTab}
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
        openNewFolderDialog={openNewFolderDialog}
        uploadDirRef={uploadDirRef}
        uploadInputRef={uploadInputRef}
        setRenameError={setRenameError}
        setRenameTarget={setRenameTarget}
        setMoveError={setMoveError}
        setMoveTarget={setMoveTarget}
        openInNewTab={openInNewTab}
        openFile={openFile}
        setViewMode={setViewMode}
        gitChanges={gitChanges}
        loadDiff={loadDiff}
        requestDiscard={requestDiscard}
        setDeleteError={setDeleteError}
        setDeleteTarget={setDeleteTarget}
        isPinned={isPinned}
        togglePin={togglePin}
        readOnly={readOnly}
        showToast={showToast}
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

      <NewFolderModal
        newFolderOpen={newFolderOpen}
        setNewFolderOpen={setNewFolderOpen}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        newFolderParent={newFolderParent}
        setNewFolderParent={setNewFolderParent}
        allFolders={allFolders}
        newFolderError={newFolderError}
        confirmNewFolder={confirmNewFolder}
      />

      <RenameModal
        renameTarget={renameTarget}
        setRenameTarget={setRenameTarget}
        renameError={renameError}
        confirmRenameFile={confirmRenameFile}
      />

      <MoveModal
        moveTarget={moveTarget}
        setMoveTarget={setMoveTarget}
        allFolders={allFolders}
        moveError={moveError}
        confirmMoveItem={confirmMoveItem}
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

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </>
  );
}
