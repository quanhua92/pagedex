import React, { useState } from 'react';

export default function OutlineSidebar({
  headings,
  isImg,
  isBinaryDownload,
  viewMode,
  currentBacklinks,
  openFile,
  position = 'right',
  onChangePosition,
  mobileOpen = false,
  onCloseMobile
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (position === 'hidden' && !mobileOpen && window.innerWidth > 960) return null;

  const emptyLabel = isImg
    ? 'Image preview'
    : isBinaryDownload
      ? 'Binary file'
      : viewMode === 'raw'
        ? 'Raw view'
        : viewMode === 'edit'
          ? 'Edit mode'
          : viewMode === 'diff'
            ? 'Diff mode'
            : 'No headings';

  return (
    <aside className={`rightbar${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="rightbar-head">
        <div className="panel-title" style={{ margin: 0 }}>
          {position === 'bottom' ? 'Outline & Backlinks' : 'Outline'}
        </div>
        <div className="actions">
          <button
            className="icon-btn"
            aria-label="Outline panel options"
            title="Outline panel options"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="12" cy="19" r="1.8" />
            </svg>
          </button>
          {menuOpen && (
            <div className="more-menu" onMouseLeave={() => setMenuOpen(false)}>
              <button
                className={`more-item${position === 'right' ? ' active' : ''}`}
                onClick={() => {
                  onChangePosition('right');
                  setMenuOpen(false);
                }}
              >
                <span>Position: Right</span>
                {position === 'right' && <span>✓</span>}
              </button>
              <button
                className={`more-item${position === 'bottom' ? ' active' : ''}`}
                onClick={() => {
                  onChangePosition('bottom');
                  onCloseMobile?.();
                  setMenuOpen(false);
                }}
              >
                <span>Position: Bottom</span>
                {position === 'bottom' && <span>✓</span>}
              </button>
              <button
                className="more-item"
                style={{ borderTop: '1px solid var(--border)', marginTop: 2, paddingTop: 8 }}
                onClick={() => {
                  if (window.innerWidth <= 960 && mobileOpen) {
                    onCloseMobile?.();
                  } else {
                    onChangePosition('hidden');
                  }
                  setMenuOpen(false);
                }}
              >
                <span>Hide panel</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="rightbar-body">
        <div className="rightbar-sec">
          <div className="panel-subtitle">Outline</div>
          {headings.length === 0 ? (
            <div className="empty-note">{emptyLabel}</div>
          ) : (
            headings.map((h, i) => (
              <a
                key={`${h.id}-${i}`}
                className={`toc-item toc-h${h.level}`}
                onClick={() => {
                  document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' });
                  onCloseMobile?.();
                }}
              >
                {h.text}
              </a>
            ))
          )}
        </div>

        <div className="rightbar-sec">
          <div className="panel-title backlinks-title">Backlinks</div>
          {currentBacklinks.length === 0 ? (
            <div className="empty-note">No backlinks yet</div>
          ) : (
            currentBacklinks.map((src) => (
              <a
                key={src}
                className="backlink-item"
                onClick={() => {
                  openFile(src);
                  onCloseMobile?.();
                }}
              >
                {src}
              </a>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
