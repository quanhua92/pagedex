import React from 'react';
import {
  ArrowUp,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  Home,
  Menu,
  Moon,
  PanelLeft,
  PanelRight,
  Pencil,
  Plus,
  Search,
  Settings,
  Sun
} from 'lucide-react';

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
  readOnly = false,
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
                <Search size={18} strokeWidth={1.9} />
                <span>Open quick switcher</span>
              </button>
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  setDrawerOpen((o) => !o);
                }}
              >
                <PanelLeft size={18} strokeWidth={1.9} />
                <span>Toggle files sidebar</span>
              </button>
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  onToggleOutline?.();
                }}
              >
                <PanelRight size={18} strokeWidth={1.9} />
                <span>Toggle outline sidebar</span>
              </button>
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  openFile('README.md');
                }}
              >
                <Home size={18} strokeWidth={1.9} />
                <span>Go to Home (README)</span>
              </button>
              {!readOnly && (
                <button
                  className="sheet-item"
                  onClick={() => {
                    setFabOpen(false);
                    setViewMode((m) => (m === 'edit' ? 'preview' : 'edit'));
                  }}
                >
                  <Pencil size={18} strokeWidth={1.9} />
                  <span>{viewMode === 'edit' ? 'Switch to Preview mode' : 'Switch to Edit mode'}</span>
                </button>
              )}
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  setViewMode('diff');
                  loadDiff(activePath);
                }}
              >
                <GitCompare size={18} strokeWidth={1.9} />
                <span>View Git Diff</span>
              </button>
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  setViewMode((m) => (m === 'raw' ? 'preview' : 'raw'));
                }}
              >
                <BookOpen size={18} strokeWidth={1.9} />
                <span>{viewMode === 'raw' ? 'Switch to Preview mode' : 'Switch to Raw view'}</span>
              </button>
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <ArrowUp size={18} strokeWidth={1.9} />
                <span>Scroll to top</span>
              </button>
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  setSettings((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }));
                }}
              >
                {settings.theme === 'dark' ? <Sun size={18} strokeWidth={1.9} /> : <Moon size={18} strokeWidth={1.9} />}
                <span>{settings.theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}</span>
              </button>
              <button
                className="sheet-item"
                onClick={() => {
                  setFabOpen(false);
                  setSettingsOpen(true);
                }}
              >
                <Settings size={18} strokeWidth={1.9} />
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
          <PanelLeft size={19} strokeWidth={1.9} />
        </button>
        <button className="mobile-bar-btn" aria-label="Back" onClick={() => window.history.back()}>
          <ChevronLeft size={19} strokeWidth={1.9} />
        </button>
        <button className="mobile-bar-btn" aria-label="Forward" onClick={() => window.history.forward()}>
          <ChevronRight size={19} strokeWidth={1.9} />
        </button>
        <button
          className="mobile-bar-btn"
          aria-label="Search"
          onClick={() => {
            setFabOpen(false);
            openSwitcher();
          }}
        >
          <Search size={19} strokeWidth={1.9} />
        </button>
        <button
          className="mobile-bar-btn"
          aria-label="New tab"
          onClick={createNewTab}
        >
          <Plus size={19} strokeWidth={1.9} />
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
          <Menu size={19} strokeWidth={1.9} />
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
