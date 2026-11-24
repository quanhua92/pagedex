import React, { useEffect, useMemo, useRef, useState } from 'react';
import { computeCollapsedDirs, loadSettings, resolveStartupPath } from './lib/settings.js';
import { baseTitle, isMarkdownPath, isTextEditablePath, resolveRelative } from './lib/paths.js';
import { useEdgeSwipe } from './lib/useEdgeSwipe.js';
import { useGitOps } from './hooks/useGitOps.js';
import { useLayoutState } from './hooks/useLayoutState.js';
import { useQuickSwitcher } from './hooks/useQuickSwitcher.js';
import { useFileCrud } from './hooks/useFileCrud.js';
import { usePaneState } from './hooks/usePaneState.js';
import Sidebar from './components/Sidebar.jsx';
import { DesktopTabs } from './components/TopbarAndTabs.jsx';
import MultiNoteViewer from './components/MultiNoteViewer.jsx';
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
  const [tabsOpen, setTabsOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('files'); // 'files' | 'changes'
  const [filter, setFilter] = useState('');
  const {
    toast,
    showToast,
    sidebarWidth,
    outlineWidth,
    pinned,
    setPinned,
    isPinned,
    togglePin,
    reorderPinned,
    startResizeSidebar,
    startResizeOutline
  } = useLayoutState();
  const loadDiffRef = useRef(null);
  const [splitMode, setSplitMode] = useState('single'); // 'single' | 'right' | 'down'
  const [activePaneId, setActivePaneId] = useState('primary'); // 'primary' | 'secondary'
  const [splitRatio, setSplitRatio] = useState(0.5);
  const primaryPane = usePaneState({
    initialPath,
    flatFiles,
    onOpenCleanup: () => {
      setDrawerOpen(false);
      setOutlineDrawerOpen(false);
    },
    onDiffRequestedRef: loadDiffRef,
    onTabsOpenClose: () => setTabsOpen(false),
    showToast
  });
  const secondaryPane = usePaneState({
    initialPath: '',
    flatFiles,
    onOpenCleanup: () => {
      setDrawerOpen(false);
      setOutlineDrawerOpen(false);
    },
    onDiffRequestedRef: loadDiffRef,
    onTabsOpenClose: () => setTabsOpen(false),
    showToast,
    persistNavigation: false
  });
  const activePane = splitMode !== 'single' && activePaneId === 'secondary' ? secondaryPane : primaryPane;
  const activePaneRef = useRef(activePane);
  activePaneRef.current = activePane;
  const panesRef = useRef([primaryPane, secondaryPane]);
  panesRef.current = [primaryPane, secondaryPane];
  const {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    activePath,
    content,
    setContent,
    draftContent,
    setDraftContent,
    dirty,
    setDirty,
    saving,
    viewMode,
    setViewMode,
    moreMenuOpen,
    setMoreMenuOpen,
    scrollRef,
    activePathRef,
    activeTabIdRef,
    tabsRef,
    openFile,
    openInNewTab,
    createNewTab,
    closeTab,
    switchTab,
    saveActiveNote,
    renderedHtml,
    headings,
    highlightedRawHtml,
    isImg,
    isSvg,
    isMarkdown,
    isPdf,
    isAudio,
    isVideo,
    isHtml,
    isCsv,
    isNotebook,
    isBinaryDownload
  } = activePane;

  const handleSplitPane = (direction) => {
    if (splitMode === 'single') {
      if (activePath) secondaryPane.openFile(activePath);
      setSplitMode(direction);
      setActivePaneId('secondary');
    } else {
      setSplitMode(direction);
    }
  };

  const handleClosePane = (paneId = activePaneId) => {
    if (splitMode === 'single') return;
    const closingPane = paneId === 'primary' ? primaryPane : secondaryPane;
    if (closingPane.dirty && !window.confirm('Discard unsaved changes in this pane?')) return;
    if (paneId === 'primary') {
      if (secondaryPane.activePath) {
        primaryPane.openFile(secondaryPane.activePath);
      } else {
        primaryPane.resetPane();
      }
    }
    secondaryPane.resetPane();
    setSplitMode('single');
    setActivePaneId('primary');
  };
  const {
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
  } = useGitOps({ activePath, filter, fetchTree, openFile });
  loadDiffRef.current = loadDiff;
  const [collapsed, setCollapsed] = useState(() => new Set(settings.autoCollapsed));
  const seededAutoCollapseRef = useRef(false);
  const [live, setLive] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [outlineDrawerOpen, setOutlineDrawerOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authState, setAuthState] = useState({
    checked: false,
    required: false,
    authenticated: false,
    vaults: [],
    activeVault: ''
  });
  const [vaultsInfo, setVaultsInfo] = useState({ activeVault: 'default', vaults: [] });
  const [vaultRootName, setVaultRootName] = useState('');
  const [vaultTick, setVaultTick] = useState(0);
  const [pendingJumpQuery, setPendingJumpQuery] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [readOnly, setReadOnly] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const {
    switcherOpen,
    setSwitcherOpen,
    switcherTab,
    setSwitcherTab,
    switcherQuery,
    setSwitcherQuery,
    switcherIdx,
    setSwitcherIdx,
    switcherInputRef,
    isLargeVault,
    pagedFiles,
    loadMorePagedFiles,
    switcherData,
    switcherItems,
    openSwitcher
  } = useQuickSwitcher({
    totalFiles,
    fileStats,
    flatFiles,
    hiddenFolders: settings.hiddenFolders,
    tabs,
    activeTabId
  });

  const searchRef = useRef(null);
  const switchTabRef = useRef(null);
  const toggleOutlineRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    localStorage.setItem('vault-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const cycleTab = (delta) => {
      const pane = activePaneRef.current;
      const list = pane.tabsRef.current;
      if (list.length <= 1) return;
      const idx = list.findIndex((t) => t.id === pane.activeTabIdRef.current);
      const nextIdx = idx === -1 ? 0 : (idx + delta + list.length) % list.length;
      pane.switchTab(list[nextIdx]);
    };
    const onKey = (e) => {
      const pane = activePaneRef.current;
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
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        toggleOutlineRef.current?.();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && key === 'e') {
        const path = pane.activePathRef.current;
        if (!path) return;
        if (e.shiftKey) {
          if (isTextEditablePath(path)) {
            e.preventDefault();
            pane.setViewMode((m) => (m === 'raw' ? (isMarkdownPath(path) && !readOnly ? 'edit' : 'preview') : 'raw'));
          }
          return;
        }
        if (!readOnly && isTextEditablePath(path)) {
          e.preventDefault();
          const isMd = isMarkdownPath(path);
          pane.setViewMode((m) => (m === 'edit' || (!isMd && m === 'raw') ? 'preview' : isMd ? 'edit' : 'raw'));
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

  async function fetchTree({ force = false } = {}) {
    const treeUrl = force ? '/api/v1/tree?limit=10000&refresh=1' : '/api/v1/tree?limit=10000';
    const [treeRes, changesRes] = await Promise.all([
      fetch(treeUrl),
      fetch('/api/v1/changes')
    ]);
    const data = await treeRes.json();
    setTree(data.tree);
    if (!seededAutoCollapseRef.current && Array.isArray(data.tree)) {
      seededAutoCollapseRef.current = true;
      setCollapsed(computeCollapsedDirs(data.tree, settings.autoCollapsed, settings.autoExpandDepth));
    }
    setFlatFiles(data.flatFiles);
    setFileStats(data.fileStats || []);
    setTotalFiles(data.totalFiles ?? data.flatFiles?.length ?? 0);
    setBacklinks(data.backlinks);
    if (changesRes.ok) {
      const cData = await changesRes.json();
      setGitChanges(cData.changes || []);
    }
  }

  switchTabRef.current = switchTab;

  const {
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
  } = useFileCrud({
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
  });

  useEffect(() => {
    fetch('/api/v1/auth/status')
      .then((r) => (r.ok ? r.json() : { required: false, authenticated: true }))
      .then((d) => {
        setAuthState({
          checked: true,
          required: Boolean(d?.required),
          authenticated: Boolean(d?.authenticated),
          vaults: Array.isArray(d?.vaults) ? d.vaults : [],
          activeVault: d?.activeVault || ''
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
        if (d && typeof d.root === 'string') {
          setVaultRootName(d.root.split(/[/\\]/).filter(Boolean).pop() || '');
        }
      })
      .catch(() => {});
    fetch('/api/v1/vaults')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.vaults)) {
          setVaultsInfo({ activeVault: d.activeVault || 'default', vaults: d.vaults });
        }
      })
      .catch(() => {});
    fetchTree();
    openFile(activePath);
  }, [canAccessVault, vaultTick]);

  async function selectVault(vaultId) {
    const res = await fetch('/api/v1/vault/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vault: vaultId })
    });
    const nextPath = resolveStartupPath(settings);
    const freshId = `tab-${Date.now()}`;
    primaryPane.setTabs([{ id: freshId, path: nextPath, title: baseTitle(nextPath), preview: '' }]);
    primaryPane.setActiveTabId(freshId);
    primaryPane.activeTabIdRef.current = freshId;
    primaryPane.activePathRef.current = nextPath || '';
    primaryPane.setContent('');
    primaryPane.setDraftContent('');
    primaryPane.setDirty(false);
    secondaryPane.resetPane();
    setSplitMode('single');
    setActivePaneId('primary');
    setFilter('');
    setVaultsInfo((prev) => ({ ...prev, activeVault: vaultId }));
    if (res.status === 401) {
      setAuthState((prev) => ({
        ...prev,
        checked: true,
        required: true,
        authenticated: false,
        activeVault: vaultId
      }));
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.readOnly === 'boolean') setReadOnly(data.readOnly);
    setVaultTick((t) => t + 1);
  }

  async function handleLogout() {
    await fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
    setAuthState((prev) => ({ ...prev, checked: true, required: true, authenticated: false }));
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
    let openedOnce = false;
    let lastFocusRefresh = Date.now();
    const es = new EventSource('/api/v1/events');
    es.onopen = () => {
      setLive(true);
      if (openedOnce) {
        fetchTree({ force: true });
      } else {
        openedOnce = true;
      }
    };
    es.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'reload') {
        await fetchTree();
        setReloadTick((t) => t + 1);
        for (const pane of panesRef.current) {
          const currentPath = pane.activePathRef.current;
          if (currentPath) {
            await pane.openFile(currentPath, true, pane.activeTabIdRef.current);
          }
        }
      }
    };
    es.onerror = () => setLive(false);
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFocusRefresh > 5000) {
        lastFocusRefresh = Date.now();
        fetchTree();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      es.close();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [canAccessVault, vaultTick]);

  useEffect(() => {
    if (!activePath || !activePath.includes('/')) return;
    const parts = activePath.split('/');
    parts.pop();
    const ancestors = [];
    for (let i = 0; i < parts.length; i++) {
      ancestors.push(parts.slice(0, i + 1).join('/'));
    }
    setCollapsed((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const dir of ancestors) {
        if (next.delete(dir)) changed = true;
      }
      return changed ? next : prev;
    });
    const raf = requestAnimationFrame(() => {
      document.querySelector('.sidebar .tree-file-row.active')?.scrollIntoView({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(raf);
  }, [activePath]);

  const anyDirty = primaryPane.dirty || (splitMode !== 'single' && secondaryPane.dirty);
  useEffect(() => {
    if (!anyDirty) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [anyDirty]);

  function handleDocClick(e) {
    const copyBtn = e.target.closest('button.code-copy-btn');
    if (copyBtn) {
      e.preventDefault();
      const code = copyBtn.closest('.code-block-wrap')?.querySelector('pre code')?.textContent ?? '';
      navigator.clipboard?.writeText(code);
      copyBtn.textContent = 'Copied';
      copyBtn.classList.add('copied');
      clearTimeout(copyBtn._copyTimer);
      copyBtn._copyTimer = setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.classList.remove('copied');
      }, 1500);
      return;
    }
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

  const currentBacklinks = backlinks[activePath] || [];
  const currentLinks = useMemo(
    () =>
      activePath
        ? Object.keys(backlinks)
            .filter((target) => backlinks[target]?.includes(activePath))
            .sort((a, b) => a.localeCompare(b))
        : [],
    [backlinks, activePath]
  );

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
  toggleOutlineRef.current = handleToggleOutline;

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
        vaults={authState.vaults}
        defaultVault={authState.activeVault}
        onAuthenticated={() =>
          setAuthState((prev) => ({ ...prev, checked: true, required: true, authenticated: true }))
        }
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
          vaults={vaultsInfo.vaults}
          activeVault={vaultsInfo.activeVault}
          onSelectVault={selectVault}
          onRefreshTree={() => fetchTree({ force: true })}
        />

        <main className="main">
          {splitMode === 'single' && (
            <DesktopTabs
              tabs={tabs}
              activeTabId={activeTabId}
              switchTab={switchTab}
              closeTab={closeTab}
              createNewTab={createNewTab}
            />
          )}

          <div className={`workspace-body outline-${outlinePosition}`}>
            <MultiNoteViewer
              splitMode={splitMode}
              primaryPane={primaryPane}
              secondaryPane={secondaryPane}
              activePaneId={activePaneId}
              onActivatePane={setActivePaneId}
              splitRatio={splitRatio}
              onSplitRatioChange={setSplitRatio}
              onSplitPane={handleSplitPane}
              onClosePane={handleClosePane}
              vaultName={vaultsInfo.vaults.length > 1 ? vaultsInfo.activeVault : vaultRootName || 'PageDex'}
              settings={settings}
              flatFiles={flatFiles}
              reloadTick={reloadTick}
              readOnly={readOnly}
              setDrawerOpen={setDrawerOpen}
              openNewNoteDialog={openNewNoteDialog}
              openSwitcher={openSwitcher}
              setSettingsOpen={setSettingsOpen}
              loadDiff={loadDiff}
              diffData={diffData}
              requestDiscard={requestDiscard}
              setDeleteError={setDeleteError}
              setDeleteTarget={setDeleteTarget}
              setRenameError={setRenameError}
              setRenameTarget={setRenameTarget}
              setMoveError={setMoveError}
              setMoveTarget={setMoveTarget}
              isPinned={isPinned}
              togglePin={togglePin}
              gitChanges={gitChanges}
              showToast={showToast}
              handleDocClick={handleDocClick}
              pendingJumpQuery={pendingJumpQuery}
              onClearJumpQuery={() => setPendingJumpQuery('')}
              outlinePosition={outlinePosition}
              outlineDrawerOpen={outlineDrawerOpen}
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={handleToggleSidebar}
              onToggleOutline={handleToggleOutline}
              onOpenOutline={handleOpenOutline}
            />

            <OutlineSidebar
              headings={headings}
              isImg={isImg}
              isBinaryDownload={isBinaryDownload}
              viewMode={viewMode}
              currentBacklinks={currentBacklinks}
              currentLinks={currentLinks}
              openFile={openFile}
              scrollRef={scrollRef}
              activePath={activePath}
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
        switchTab={switchTab}
        tabCount={tabs.length}
        isLargeVault={isLargeVault}
        pagedFiles={pagedFiles}
        loadMorePagedFiles={loadMorePagedFiles}
        switcherQuery={switcherQuery}
        setSwitcherQuery={setSwitcherQuery}
        onJumpToMatch={(q) => setPendingJumpQuery(q)}
        commands={[
          ...(!readOnly
            ? [
                { id: 'new-note', label: 'New note', hint: 'Create a note', run: () => openNewNoteDialog('') },
                { id: 'new-folder', label: 'New folder', hint: 'Create a folder', run: () => openNewFolderDialog('') }
              ]
            : []),
          {
            id: 'toggle-theme',
            label: `Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} theme`,
            hint: 'Appearance',
            run: () => setSettings((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }))
          },
          ...(activePath && !readOnly && isTextEditablePath(activePath)
            ? [
                {
                  id: 'toggle-edit',
                  label: viewMode === 'edit' ? 'Switch to Preview' : 'Switch to Edit',
                  hint: 'Cmd/Ctrl+E',
                  run: () => setViewMode(viewMode === 'edit' ? 'preview' : isMarkdown ? 'edit' : 'raw')
                }
              ]
            : []),
          ...(activePath
            ? [
                {
                  id: 'toggle-raw',
                  label: viewMode === 'raw' ? 'Switch to Preview' : 'Switch to Raw',
                  hint: 'Cmd/Ctrl+Shift+E',
                  run: () => setViewMode(viewMode === 'raw' ? 'preview' : 'raw')
                },
                {
                  id: 'copy-wikilink',
                  label: 'Copy [[wikilink]]',
                  hint: activePath,
                  run: () => {
                    navigator.clipboard?.writeText(`[[${activePath}]]`);
                    showToast('Copied wikilink');
                  }
                },
                {
                  id: 'print',
                  label: 'Print / Export PDF',
                  hint: 'Cmd/Ctrl+P',
                  run: () => window.print()
                }
              ]
            : []),
          {
            id: 'split-right',
            label: 'Split right',
            hint: 'Side by side',
            run: () => handleSplitPane('right')
          },
          {
            id: 'split-down',
            label: 'Split down',
            hint: 'Stacked',
            run: () => handleSplitPane('down')
          },
          ...(splitMode !== 'single'
            ? [
                {
                  id: 'close-pane',
                  label: 'Close active pane',
                  hint: 'Return to single pane',
                  run: () => handleClosePane(activePaneId)
                }
              ]
            : []),
          {
            id: 'refresh-tree',
            label: 'Refresh files',
            hint: 'Rescan disk',
            run: () => fetchTree({ force: true })
          },
          ...(!readOnly && gitChanges.length > 0
            ? [
                {
                  id: 'git-commit',
                  label: `Commit changes (${gitChanges.length})`,
                  hint: 'Git',
                  run: () => openCommitDialog()
                }
              ]
            : []),
          {
            id: 'open-settings',
            label: 'Open Settings',
            hint: 'Preferences',
            run: () => setSettingsOpen(true)
          },
          ...(vaultsInfo.vaults.length > 1
            ? vaultsInfo.vaults
                .filter((v) => v.id !== vaultsInfo.activeVault)
                .map((v) => ({
                  id: `vault-${v.id}`,
                  label: `Switch vault: ${v.id}`,
                  hint: v.readOnly ? 'Read-only' : 'Vault',
                  run: () => selectVault(v.id)
                }))
            : [])
        ]}
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
        flatFiles={flatFiles}
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
        tree={tree}
      />

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </>
  );
}
