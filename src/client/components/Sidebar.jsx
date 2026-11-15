import React, { useRef, useState } from 'react';
import { Moon, Pin, Plus, Sun } from 'lucide-react';

function findTreeNode(nodes, targetPath) {
  for (const node of nodes || []) {
    if (node.path === targetPath) return node;
    if (node.type === 'dir' && node.children?.length) {
      const found = findTreeNode(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 8;

function useLongPress(onLongPress) {
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const firedRef = useRef(false);

  const clear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return {
    onTouchStart: (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const rowEl = e.currentTarget.closest('.tree-file-row') || e.currentTarget;
      startRef.current = { x: t.clientX, y: t.clientY };
      firedRef.current = false;
      clear();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        firedRef.current = true;
        navigator.vibrate?.(10);
        onLongPress(rowEl.getBoundingClientRect());
      }, LONG_PRESS_MS);
    },
    onTouchMove: (e) => {
      if (!timerRef.current || !startRef.current || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (
        Math.abs(t.clientX - startRef.current.x) > MOVE_CANCEL_PX ||
        Math.abs(t.clientY - startRef.current.y) > MOVE_CANCEL_PX
      ) {
        clear();
      }
    },
    onTouchEnd: () => clear(),
    onTouchCancel: () => clear(),
    onContextMenu: (e) => {
      e.preventDefault();
      onLongPress({ right: e.clientX + 12, bottom: e.clientY });
    },
    consumeClick: (e) => {
      if (!firedRef.current) return false;
      firedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
  };
}

function TreeNode({ node, activePath, filter, collapsed, hiddenSet, onToggleDir, onSelectFile, onOpenMenu }) {
  const dirLongPress = useLongPress((rect) => onOpenMenu(node.path, rect, 'dir'));
  const fileLongPress = useLongPress((rect) => onOpenMenu(node.path, rect, 'file'));

  if (node.type === 'dir') {
    if (hiddenSet.has(node.path.toLowerCase()) || hiddenSet.has(node.name.toLowerCase())) return null;
    const hasMatch = (n) =>
      n.type === 'file' ? n.path.toLowerCase().includes(filter) : n.children.some(hasMatch);
    if (filter && !hasMatch(node)) return null;
    const isCollapsed = !filter && collapsed.has(node.path);

    return (
      <div>
        <div className="tree-file-row">
          <button
            className="tree-dir-btn"
            title={node.path}
            onTouchStart={dirLongPress.onTouchStart}
            onTouchMove={dirLongPress.onTouchMove}
            onTouchEnd={dirLongPress.onTouchEnd}
            onTouchCancel={dirLongPress.onTouchCancel}
            onContextMenu={dirLongPress.onContextMenu}
            onClick={(e) => {
              if (dirLongPress.consumeClick(e)) return;
              onToggleDir(node.path);
            }}
          >
            {isCollapsed ? '▸ ' : '▾ '}
            {node.name}
          </button>
          <button
            className="tree-row-more"
            aria-label={`Actions for folder ${node.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenMenu(node.path, e.currentTarget.getBoundingClientRect(), 'dir');
            }}
          >
            ⋯
          </button>
        </div>
        {!isCollapsed && (
          <div className="tree-children">
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                activePath={activePath}
                filter={filter}
                collapsed={collapsed}
                hiddenSet={hiddenSet}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
                onOpenMenu={onOpenMenu}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (filter && !node.path.toLowerCase().includes(filter)) return null;

  return (
    <div className={`tree-file-row${node.path === activePath ? ' active' : ''}`}>
      <button
        className={`tree-file${node.path === activePath ? ' active' : ''}`}
        title={node.path}
        onTouchStart={fileLongPress.onTouchStart}
        onTouchMove={fileLongPress.onTouchMove}
        onTouchEnd={fileLongPress.onTouchEnd}
        onTouchCancel={fileLongPress.onTouchCancel}
        onContextMenu={fileLongPress.onContextMenu}
        onClick={(e) => {
          if (fileLongPress.consumeClick(e)) return;
          onSelectFile(node.path);
        }}
      >
        {node.name}
      </button>
      <button
        className="tree-row-more"
        aria-label={`Actions for ${node.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onOpenMenu(node.path, e.currentTarget.getBoundingClientRect());
        }}
      >
        ⋯
      </button>
    </div>
  );
}

export default function Sidebar({
  drawerOpen,
  live,
  settings,
  setSettings,
  sidebarTab,
  setSidebarTab,
  gitChanges,
  searchRef,
  filter,
  setFilter,
  tree,
  pinned = [],
  activePath,
  collapsed,
  hiddenSet,
  toggleDir,
  setViewMode,
  openFile,
  openRowMenu,
  changesSort,
  setChangesSort,
  openCommitDialog,
  sortedChanges,
  loadDiff,
  readOnly = false,
  openNewNoteDialog,
  onReorderPinned,
  onStartResizeSidebar
}) {
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [pinnedCollapsed, setPinnedCollapsed] = useState(() => new Set());
  const [dragFromPath, setDragFromPath] = useState(null);
  const [dragOverPath, setDragOverPath] = useState(null);
  const togglePinnedDir = (dirPath) => {
    setPinnedCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  };
  const pinnedNodes = pinned.map((item) => findTreeNode(tree, item.path)).filter(Boolean);

  return (
    <aside className={`sidebar${drawerOpen ? ' open' : ''}`}>
      <div className="brand">
        <div className="brand-title">
          <img src="/pagedex-logo.svg" alt="" width="20" height="20" className="brand-logo" />
          <span>PageDex</span>
          <span className={`pill${live ? '' : ' off'}`}>{live ? 'Live' : 'Reconnecting'}</span>
        </div>
        <button
          className="icon-btn"
          aria-label={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() =>
            setSettings((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }))
          }
        >
          {settings.theme === 'dark' ? <Sun size={15} strokeWidth={1.9} /> : <Moon size={15} strokeWidth={1.9} />}
        </button>
      </div>
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab${sidebarTab === 'files' ? ' active' : ''}`}
          onClick={() => setSidebarTab('files')}
        >
          Files
        </button>
        <button
          className={`sidebar-tab${sidebarTab === 'changes' ? ' active' : ''}`}
          onClick={() => setSidebarTab('changes')}
        >
          <span>Changes</span>
          {gitChanges.length > 0 && <span className="pill">{gitChanges.length}</span>}
        </button>
      </div>
      <div className="search-wrap">
        <input
          ref={searchRef}
          className="search"
          type="search"
          placeholder={sidebarTab === 'files' ? 'Filter files... (/)' : 'Filter changes...'}
          value={filter}
          onChange={(e) => setFilter(e.target.value.trim().toLowerCase())}
        />
        {sidebarTab === 'files' && !readOnly && openNewNoteDialog && (
          <button
            type="button"
            className="sidebar-new-btn"
            aria-label="New note"
            title="New note"
            onClick={() => openNewNoteDialog()}
          >
            <Plus size={15} strokeWidth={2} />
          </button>
        )}
      </div>
      <div className="tree">
        {sidebarTab === 'files' ? (
          <>
            {pinnedNodes.length > 0 && (
              <>
                <div className="pinned-section">
                  <button
                    type="button"
                    className="pinned-toggle"
                    aria-expanded={pinnedOpen}
                    onClick={() => setPinnedOpen((v) => !v)}
                  >
                    <span className="chev">{pinnedOpen ? '▾' : '▸'}</span>
                    <Pin size={12} strokeWidth={2} className="pinned-icon" aria-hidden="true" />
                    <span>Pinned</span>
                    <span className="pinned-count">{pinnedNodes.length}</span>
                  </button>
                  {pinnedOpen && (
                    <div className="pinned-list">
                      {pinnedNodes.map((node) => (
                        <div
                          key={`pinned:${node.path}`}
                          className={`pinned-item-wrap${dragOverPath === node.path && dragFromPath !== node.path ? ' drag-over' : ''}`}
                          draggable={Boolean(onReorderPinned)}
                          onDragStart={(e) => {
                            setDragFromPath(node.path);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', node.path);
                          }}
                          onDragOver={(e) => {
                            if (!dragFromPath) return;
                            e.preventDefault();
                            if (dragOverPath !== node.path) setDragOverPath(node.path);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const from = dragFromPath || e.dataTransfer.getData('text/plain');
                            setDragFromPath(null);
                            setDragOverPath(null);
                            if (from && from !== node.path) {
                              onReorderPinned?.(from, node.path);
                            }
                          }}
                          onDragEnd={() => {
                            setDragFromPath(null);
                            setDragOverPath(null);
                          }}
                        >
                          <TreeNode
                            node={node}
                            activePath={activePath}
                            filter={filter}
                            collapsed={pinnedCollapsed}
                            hiddenSet={hiddenSet}
                            onToggleDir={togglePinnedDir}
                            onSelectFile={(p) => {
                              setViewMode('preview');
                              openFile(p);
                            }}
                            onOpenMenu={openRowMenu}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="tree-section-divider">
                  <span>All files</span>
                </div>
              </>
            )}
            {tree.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                activePath={activePath}
                filter={filter}
                collapsed={collapsed}
                hiddenSet={hiddenSet}
                onToggleDir={toggleDir}
                onSelectFile={(p) => {
                  setViewMode('preview');
                  openFile(p);
                }}
                onOpenMenu={openRowMenu}
              />
            ))}
          </>
        ) : (
          <>
            <div className="changes-bar">
              <select
                className="changes-select"
                aria-label="Sort changes"
                value={changesSort}
                onChange={(e) => setChangesSort(e.target.value)}
              >
                <option value="path">Sort: Path</option>
                <option value="recent">Sort: Recent</option>
                <option value="status">Sort: Status</option>
              </select>
              {gitChanges.length > 0 && !readOnly && (
                <button className="btn primary" onClick={openCommitDialog}>
                  Commit
                </button>
              )}
            </div>
            {sortedChanges.length === 0 ? (
              <div className="empty-note" style={{ padding: '10px 8px' }}>
                Working tree clean
              </div>
            ) : (
              sortedChanges.map((c) => (
                <div key={c.path} className={`tree-file-row${c.path === activePath ? ' active' : ''}`}>
                  <button
                    className={`tree-file${c.path === activePath ? ' active' : ''}`}
                    title={c.path}
                    onClick={() => {
                      if (c.status === 'D') return;
                      setViewMode('diff');
                      openFile(c.path);
                      loadDiff(c.path);
                    }}
                  >
                    <span className={`git-badge git-${c.status}`}>{c.status}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.path}</span>
                  </button>
                  <button
                    className="tree-row-more"
                    aria-label={`Actions for ${c.path}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openRowMenu(c.path, e.currentTarget.getBoundingClientRect());
                    }}
                  >
                    ⋯
                  </button>
                </div>
              ))
            )}
          </>
        )}
      </div>
      {onStartResizeSidebar && (
        <div
          className="resize-handle resize-handle-right"
          onPointerDown={onStartResizeSidebar}
          aria-hidden="true"
        />
      )}
    </aside>
  );
}
