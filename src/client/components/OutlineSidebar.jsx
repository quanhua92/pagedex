import React, { useEffect, useState } from 'react';
import { MoreVertical } from 'lucide-react';

export default function OutlineSidebar({
  headings,
  isImg,
  isBinaryDownload,
  viewMode,
  currentBacklinks,
  currentLinks = [],
  openFile,
  scrollRef,
  activePath,
  position = 'right',
  onChangePosition,
  mobileOpen = false,
  onCloseMobile,
  onStartResizeOutline
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState('');

  useEffect(() => {
    const el = scrollRef?.current;
    if (!el || viewMode !== 'preview' || headings.length === 0) {
      setActiveHeadingId('');
      return;
    }

    let rafId = 0;
    const updateActive = () => {
      rafId = 0;
      const topOffset = el.getBoundingClientRect().top + 80;
      let current = headings[0]?.id || '';
      for (const h of headings) {
        const node = document.getElementById(h.id);
        if (!node) continue;
        if (node.getBoundingClientRect().top <= topOffset) {
          current = h.id;
        } else {
          break;
        }
      }
      setActiveHeadingId(current);
    };

    const onScroll = () => {
      if (!rafId) rafId = requestAnimationFrame(updateActive);
    };

    updateActive();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [scrollRef, viewMode, headings, activePath]);

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
            <MoreVertical size={16} strokeWidth={1.9} />
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
                {position === 'right' && <span className="more-item-check">✓</span>}
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
                {position === 'bottom' && <span className="more-item-check">✓</span>}
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
                className={`toc-item toc-h${h.level}${activeHeadingId === h.id ? ' active' : ''}`}
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
          <div className="panel-title backlinks-title">Links</div>
          {currentLinks.length === 0 ? (
            <div className="empty-note">No outgoing links</div>
          ) : (
            currentLinks.map((target) => (
              <a
                key={target}
                className="backlink-item"
                onClick={() => {
                  openFile(target);
                  onCloseMobile?.();
                }}
              >
                {target}
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
      {position !== 'bottom' && onStartResizeOutline && (
        <div
          className="resize-handle resize-handle-left"
          onPointerDown={onStartResizeOutline}
          aria-hidden="true"
        />
      )}
    </aside>
  );
}
