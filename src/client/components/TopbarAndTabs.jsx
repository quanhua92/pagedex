import React from 'react';
import { MoreVertical, PanelLeft, PanelRight } from 'lucide-react';

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
  outlinePosition,
  outlineDrawerOpen,
  onToggleOutline,
  onOpenOutline,
  readOnly = false
}) {
  const isOutlineActive = outlineDrawerOpen || outlinePosition !== 'hidden';
  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="icon-btn menu-btn" aria-label="Toggle files" onClick={() => setDrawerOpen((o) => !o)}>
          <PanelLeft size={17} strokeWidth={1.8} />
        </button>
        <div className="crumbs">{activePath || 'New tab'}</div>
      </div>
      <div className="actions">
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
          <div className="more-menu" onMouseLeave={() => setMoreMenuOpen(false)}>
            {activePath && (
              <a
                className="more-item"
                href={`/api/v1/file?path=${encodeURIComponent(activePath)}&download=1`}
                download={activePath.split('/').pop()}
                style={{ textDecoration: 'none', borderBottom: '1px solid var(--border)', marginBottom: 3, paddingBottom: 9 }}
                onClick={() => setMoreMenuOpen(false)}
              >
                <span>Download</span>
              </a>
            )}
            <button
              className={`more-item${viewMode === 'preview' ? ' active' : ''}`}
              onClick={() => {
                setViewMode('preview');
                setMoreMenuOpen(false);
              }}
            >
              <span>Preview</span>
              {viewMode === 'preview' && <span>✓</span>}
            </button>
            {!readOnly && (
              <button
                className={`more-item${viewMode === 'edit' ? ' active' : ''}`}
                onClick={() => {
                  setViewMode('edit');
                  setMoreMenuOpen(false);
                }}
              >
                <span>Edit</span>
                {viewMode === 'edit' && <span>✓</span>}
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
              <span>Diff</span>
              {viewMode === 'diff' && <span>✓</span>}
            </button>
            <button
              className={`more-item${viewMode === 'raw' ? ' active' : ''}`}
              onClick={() => {
                setViewMode('raw');
                setMoreMenuOpen(false);
              }}
            >
              <span>Raw</span>
              {viewMode === 'raw' && <span>✓</span>}
            </button>
            <button
              className={`more-item outline-menu-trigger${outlinePosition === 'hidden' ? ' show-desktop' : ''}`}
              style={{ borderTop: '1px solid var(--border)', marginTop: 3, paddingTop: 9 }}
              onClick={() => {
                setMoreMenuOpen(false);
                onOpenOutline();
              }}
            >
              <span>Outline</span>
            </button>
            {activePath && !readOnly && (
              <button
                className="more-item"
                style={{ color: '#f87171', borderTop: '1px solid var(--border)', marginTop: 3, paddingTop: 9 }}
                onClick={() => {
                  setMoreMenuOpen(false);
                  setDeleteError('');
                  setDeleteTarget(activePath);
                }}
              >
                <span>Delete</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
