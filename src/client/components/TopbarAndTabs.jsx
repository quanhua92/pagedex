import React, { useEffect } from 'react';
import {
  Columns2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  FolderInput,
  GitCompare,
  Link2,
  ListTree,
  MoreVertical,
  PanelLeft,
  PanelRight,
  Pencil,
  Pin,
  PinOff,
  Printer,
  RotateCcw,
  Rows2,
  Trash2,
  X
} from 'lucide-react';
import { buildMoveTarget, buildRenameTarget, isMarkdownPath, isTextEditablePath } from '../lib/paths.js';

function MenuIcon({ icon: Icon }) {
  return <Icon className="menu-item-icon" size={14} strokeWidth={1.9} aria-hidden="true" />;
}

export function DesktopTabs({
  tabs,
  activeTabId,
  switchTab,
  closeTab,
  createNewTab
}) {
  return (
    <div className="desktop-tabs">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`desktop-tab${tab.id === activeTabId ? ' active' : ''}`}
          onClick={() => switchTab(tab)}
        >
          <span className="desktop-tab-title">{tab.title}</span>
          <button className="desktop-tab-close" onClick={(e) => closeTab(tab.id, e)}>
            ×
          </button>
        </div>
      ))}
      <button className="desktop-tab-add" title="New tab" onClick={createNewTab}>
        +
      </button>
    </div>
  );
}

export default function TopbarAndTabs({
  setDrawerOpen,
  activePath,
  moreMenuOpen,
  setMoreMenuOpen,
  viewMode,
  setViewMode,
  loadDiff,
  setDeleteError,
  setDeleteTarget,
  setRenameError,
  setRenameTarget,
  setMoveError,
  setMoveTarget,
  openInNewTab,
  isPinned,
  togglePin,
  gitChanges = [],
  requestDiscard,
  showToast,
  outlinePosition,
  outlineDrawerOpen,
  sidebarCollapsed = false,
  onToggleSidebar,
  onToggleOutline,
  onOpenOutline,
  readOnly = false,
  isSplit = false,
  splitMode = 'single',
  onSplitPane,
  onClosePane
}) {
  const isOutlineActive = outlineDrawerOpen || outlinePosition !== 'hidden';
  const hasGitChanges = Boolean(activePath && gitChanges.some((c) => c.path === activePath));

  useEffect(() => {
    if (!moreMenuOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMoreMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moreMenuOpen, setMoreMenuOpen]);

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button
          className={`icon-btn menu-btn${!sidebarCollapsed ? ' active' : ''}`}
          aria-label="Toggle files"
          title="Toggle files sidebar"
          onClick={() => (onToggleSidebar ? onToggleSidebar() : setDrawerOpen((o) => !o))}
        >
          <PanelLeft size={17} strokeWidth={1.8} />
        </button>
        <div className="crumbs">{activePath || 'New tab'}</div>
      </div>
      <div className="actions">
        {activePath && !readOnly && isTextEditablePath(activePath) && (() => {
          const isMd = isMarkdownPath(activePath);
          const isEditing = viewMode === 'edit' || (!isMd && viewMode === 'raw');
          return (
            <button
              className={`icon-btn${isEditing ? ' active' : ''}`}
              aria-label={isEditing ? 'Switch to preview' : isMd ? 'Edit note' : 'Edit file'}
              title={isEditing ? 'Preview (Cmd/Ctrl+E)' : 'Edit (Cmd/Ctrl+E)'}
              onClick={() => setViewMode(isEditing ? 'preview' : isMd ? 'edit' : 'raw')}
            >
              {isEditing ? <Eye size={16} strokeWidth={1.8} /> : <Pencil size={16} strokeWidth={1.8} />}
            </button>
          );
        })()}
        <button
          className={`icon-btn outline-toggle-btn${isOutlineActive ? ' active' : ''}`}
          aria-label="Toggle outline"
          title="Toggle outline & backlinks"
          onClick={onToggleOutline}
        >
          <PanelRight size={17} strokeWidth={1.8} />
        </button>
        <button
          className="icon-btn"
          aria-label="Note options"
          title="Note options"
          onClick={() => setMoreMenuOpen((o) => !o)}
        >
          <MoreVertical size={16} strokeWidth={1.9} />
        </button>
        {moreMenuOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 34 }}
              onClick={() => setMoreMenuOpen(false)}
            />
            <div className="more-menu" onClick={(e) => e.stopPropagation()}>
              <button
                className={`more-item${viewMode === 'preview' ? ' active' : ''}`}
                onClick={() => {
                  setViewMode('preview');
                  setMoreMenuOpen(false);
                }}
              >
                <MenuIcon icon={Eye} />
                <span>Preview</span>
                {viewMode === 'preview' && <span className="more-item-check">✓</span>}
              </button>
              {!readOnly && isTextEditablePath(activePath) && (
                <button
                  className={`more-item${viewMode === 'edit' ? ' active' : ''}`}
                  onClick={() => {
                    setViewMode('edit');
                    setMoreMenuOpen(false);
                  }}
                >
                  <MenuIcon icon={Pencil} />
                  <span>Edit</span>
                  {viewMode === 'edit' && <span className="more-item-check">✓</span>}
                </button>
              )}
              <button
                className={`more-item${viewMode === 'diff' ? ' active' : ''}`}
                onClick={() => {
                  setViewMode('diff');
                  setMoreMenuOpen(false);
                  loadDiff(activePath);
                }}
              >
                <MenuIcon icon={GitCompare} />
                <span>Diff</span>
                {viewMode === 'diff' && <span className="more-item-check">✓</span>}
              </button>
              <button
                className={`more-item${viewMode === 'raw' ? ' active' : ''}`}
                onClick={() => {
                  setViewMode('raw');
                  setMoreMenuOpen(false);
                }}
              >
                <MenuIcon icon={FileCode2} />
                <span>Raw</span>
                {viewMode === 'raw' && <span className="more-item-check">✓</span>}
              </button>
              <button
                className={`more-item more-item-divider outline-menu-trigger${outlinePosition === 'hidden' ? ' show-desktop' : ''}`}
                onClick={() => {
                  setMoreMenuOpen(false);
                  onOpenOutline();
                }}
              >
                <MenuIcon icon={ListTree} />
                <span>Outline</span>
              </button>
              {onSplitPane && (
                <>
                  <button
                    className={`more-item more-item-divider more-item-split-right ${splitMode === 'right' ? 'active' : ''}`}
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onSplitPane('right');
                    }}
                  >
                    <MenuIcon icon={Columns2} />
                    <span>Split right</span>
                  </button>
                  <button
                    className={`more-item ${splitMode === 'down' ? 'active' : ''}`}
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onSplitPane('down');
                    }}
                  >
                    <MenuIcon icon={Rows2} />
                    <span>Split down</span>
                  </button>
                  {isSplit && onClosePane && (
                    <button
                      className="more-item"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        onClosePane();
                      }}
                    >
                      <MenuIcon icon={X} />
                      <span>Close pane</span>
                    </button>
                  )}
                </>
              )}
              {activePath && (
                <>
                  {openInNewTab && (
                    <button
                      className="more-item more-item-divider"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        openInNewTab(activePath, 'preview');
                      }}
                    >
                      <MenuIcon icon={ExternalLink} />
                      <span>Open in new tab</span>
                    </button>
                  )}
                  {isPinned && togglePin && (
                    <button
                      className={`more-item${!openInNewTab ? ' more-item-divider' : ''}`}
                      onClick={() => {
                        setMoreMenuOpen(false);
                        togglePin(activePath, 'file');
                      }}
                    >
                      <MenuIcon icon={isPinned(activePath) ? PinOff : Pin} />
                      <span>{isPinned(activePath) ? 'Unpin' : 'Pin'}</span>
                    </button>
                  )}
                  {!readOnly && setRenameTarget && (
                    <button
                      className="more-item"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setRenameError?.('');
                        setRenameTarget(buildRenameTarget(activePath, 'file'));
                      }}
                    >
                      <MenuIcon icon={Pencil} />
                      <span>Rename</span>
                    </button>
                  )}
                  {!readOnly && setMoveTarget && (
                    <button
                      className="more-item"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setMoveError?.('');
                        setMoveTarget(buildMoveTarget(activePath, 'file'));
                      }}
                    >
                      <MenuIcon icon={FolderInput} />
                      <span>Move</span>
                    </button>
                  )}
                  <button
                    className="more-item"
                    onClick={() => {
                      navigator.clipboard?.writeText(activePath);
                      setMoreMenuOpen(false);
                      showToast?.('Copied path');
                    }}
                  >
                    <MenuIcon icon={Copy} />
                    <span>Copy path</span>
                  </button>
                  {activePath.endsWith('.md') && (
                    <button
                      className="more-item"
                      onClick={() => {
                        navigator.clipboard?.writeText(`[[${activePath.replace(/\.md$/i, '')}]]`);
                        setMoreMenuOpen(false);
                        showToast?.('Copied wikilink');
                      }}
                    >
                      <MenuIcon icon={Link2} />
                      <span>Copy [[wikilink]]</span>
                    </button>
                  )}
                  <a
                    className="more-item"
                    href={`/api/v1/file?path=${encodeURIComponent(activePath)}&download=1`}
                    download={activePath.split('/').pop()}
                    onClick={() => setMoreMenuOpen(false)}
                  >
                    <MenuIcon icon={Download} />
                    <span>Download</span>
                  </a>
                  <button
                    className="more-item"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      requestAnimationFrame(() => window.print());
                    }}
                  >
                    <MenuIcon icon={Printer} />
                    <span>Print</span>
                  </button>
                  {!readOnly && hasGitChanges && requestDiscard && (
                    <button
                      className="more-item"
                      style={{ color: 'var(--amber)' }}
                      onClick={() => {
                        setMoreMenuOpen(false);
                        requestDiscard({ path: activePath });
                      }}
                    >
                      <MenuIcon icon={RotateCcw} />
                      <span>Discard changes</span>
                    </button>
                  )}
                  {!readOnly && (
                    <button
                      className="more-item more-item-divider"
                      style={{ color: '#f87171' }}
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setDeleteError('');
                        setDeleteTarget(activePath);
                      }}
                    >
                      <MenuIcon icon={Trash2} />
                      <span>Delete</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
