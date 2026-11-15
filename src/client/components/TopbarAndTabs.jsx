import React from 'react';

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
  onOpenOutline
}) {
  const isOutlineActive = outlineDrawerOpen || outlinePosition !== 'hidden';
  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="icon-btn menu-btn" aria-label="Toggle files" onClick={() => setDrawerOpen((o) => !o)}>
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 3v18" /></svg>
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
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M15 3v18" />
          </svg>
        </button>
        <button
          className="icon-btn"
          aria-label="Note options"
          title="Note options"
          onClick={() => setMoreMenuOpen((o) => !o)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
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
            {activePath && (
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
