import React from 'react';

export default function MobileOverlays({
  fabOpen,
  setFabOpen,
  openSwitcher,
  drawerOpen,
  setDrawerOpen,
  openFile,
  viewMode,
  setViewMode,
  settings,
  setSettings,
  setSettingsOpen,
  scrollRef,
  loadDiff,
  activePath,
  createNewTab,
  tabsOpen,
  setTabsOpen,
  tabs,
  activeTabId,
  switchTab,
  closeTab,
  onToggleOutline
}) {
  return (
    <>
      <div className="fab-wrap">
        {fabOpen && (
          <div className="fab-menu">
            <button
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                openSwitcher();
              }}
            >
              🔍 Quick switcher
            </button>
            <button
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setDrawerOpen((o) => !o);
              }}
            >
              📁 Toggle files
            </button>
            <button
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                onToggleOutline?.();
              }}
            >
              📑 Toggle outline
            </button>
            <button
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                openFile('README.md');
              }}
            >
              🏠 Home (README)
            </button>
            <button
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setViewMode((m) => (m === 'raw' ? 'preview' : 'raw'));
              }}
            >
              {viewMode === 'raw' ? '📄 Preview mode' : '🧾 Raw view'}
            </button>
            <button
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setSettings((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }));
              }}
            >
              {settings.theme === 'dark' ? '☀️ Light theme' : '🌙 Dark theme'}
            </button>
            <button
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                setSettingsOpen(true);
              }}
            >
              ⚙️ Settings
            </button>
            <button
              className="fab-item"
              onClick={() => {
                setFabOpen(false);
                scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              ⬆️ Scroll to top
            </button>
          </div>
        )}
        <button
          className="fab-btn"
          aria-label="Quick actions"
          onClick={() => setFabOpen((o) => !o)}
        >
          {fabOpen ? '×' : '+'}
        </button>
      </div>

      {fabOpen && (
        <>
          <div className="sheet-backdrop" onClick={() => setFabOpen(false)} />
          <div className="bottom-sheet" role="dialog" aria-label="Quick actions">
            <div className="sheet-handle" />
            <div className="sheet-list">
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  openSwitcher();
                }}
              >
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <span>Open quick switcher</span>
              </button>
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  setDrawerOpen((o) => !o);
                }}
              >
                <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 3v18" /></svg>
                <span>Toggle files sidebar</span>
              </button>
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  onToggleOutline?.();
                }}
              >
                <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M15 3v18" /></svg>
                <span>Toggle outline sidebar</span>
              </button>
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  openFile('README.md');
                }}
              >
                <svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
                <span>Go to Home (README)</span>
              </button>
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  setViewMode((m) => (m === 'edit' ? 'preview' : 'edit'));
                }}
              >
                <svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" /></svg>
                <span>{viewMode === 'edit' ? 'Switch to Preview mode' : 'Switch to Edit mode'}</span>
              </button>
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  setViewMode('diff');
                  loadDiff(activePath);
                }}
              >
                <svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18" /></svg>
                <span>View Git Diff</span>
              </button>
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  setViewMode((m) => (m === 'raw' ? 'preview' : 'raw'));
                }}
              >
                <svg viewBox="0 0 24 24"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
                <span>{viewMode === 'raw' ? 'Switch to Preview mode' : 'Switch to Raw view'}</span>
              </button>
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                <span>Scroll to top</span>
              </button>
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  setSettings((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }));
                }}
              >
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
                <span>{settings.theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}</span>
              </button>
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  setSettingsOpen(true);
                }}
              >
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                <span>Settings</span>
              </button>
            </div>
          </div>
        </>
      )}

      <nav className="mobile-bar" aria-label="Mobile quick actions">
        <button
          className={`mobile-bar-btn${drawerOpen ? ' active' : ''}`}
          aria-label="Files"
          onClick={() => {
            setFabOpen(false);
            setDrawerOpen((o) => !o);
          }}
        >
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 3v18" /></svg>
        </button>
        <button className="mobile-bar-btn" aria-label="Back" onClick={() => window.history.back()}>
          <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <button className="mobile-bar-btn" aria-label="Forward" onClick={() => window.history.forward()}>
          <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
        </button>
        <button
          className="mobile-bar-btn"
          aria-label="Search"
          onClick={() => {
            setFabOpen(false);
            openSwitcher();
          }}
        >
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </button>
        <button
          className="mobile-bar-btn"
          aria-label="New tab"
          onClick={createNewTab}
        >
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button
          className={`mobile-bar-btn${tabsOpen ? ' active' : ''}`}
          aria-label="Open tabs"
          onClick={() => {
            setFabOpen(false);
            setTabsOpen(true);
          }}
        >
          <span className="tabs-count-badge">{tabs.length}</span>
        </button>
        <button
          className={`mobile-bar-btn${fabOpen ? ' active' : ''}`}
          aria-label="Menu"
          onClick={() => setFabOpen((o) => !o)}
        >
          <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </nav>

      {tabsOpen && (
        <div className="tabs-overlay" onClick={() => setTabsOpen(false)}>
          <div className="tabs-grid" onClick={(e) => e.stopPropagation()}>
            {tabs.map((tab) => (
              <div key={tab.id} className="tab-card-wrap">
                <div
                  className={`tab-card${tab.id === activeTabId ? ' active' : ''}`}
                  onClick={() => switchTab(tab)}
                >
                  <button
                    className="tab-card-close"
                    aria-label="Close tab"
                    onClick={(e) => closeTab(tab.id, e)}
                  >
                    ×
                  </button>
                  <div className="tab-card-title">{tab.title}</div>
                  <div className="tab-card-preview">
                    {tab.preview || (tab.path ? tab.path : 'Empty tab')}
                  </div>
                </div>
                <div className="tab-card-label">{tab.title}</div>
              </div>
            ))}
          </div>
          <div className="tabs-footer" onClick={(e) => e.stopPropagation()}>
            <button className="tabs-footer-btn" aria-label="New tab" onClick={createNewTab}>
              +
            </button>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'}
            </span>
            <button className="tabs-footer-btn" onClick={() => setTabsOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
