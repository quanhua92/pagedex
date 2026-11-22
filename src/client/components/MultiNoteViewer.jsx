import React, { useEffect, useRef } from 'react';
import NotePane from './NotePane.jsx';

/**
 * Coordinates single-pane or split-pane (right / down) NotePane layout
 * with active-pane focus tracking and a draggable splitter.
 */
export default function MultiNoteViewer({
  splitMode,
  primaryPane,
  secondaryPane,
  activePaneId,
  onActivatePane,
  splitRatio,
  onSplitRatioChange,
  onSplitPane,
  onClosePane,
  ...paneProps
}) {
  const containerRef = useRef(null);
  const cleanupDragRef = useRef(null);

  useEffect(() => () => cleanupDragRef.current?.(), []);

  const handleResizeStart = (e) => {
    if (!containerRef.current || splitMode === 'single') return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const isRight = splitMode === 'right';
    const startPos = isRight ? e.clientX : e.clientY;
    const totalSize = isRight ? rect.width : rect.height;
    if (totalSize <= 0) return;
    const startRatio = splitRatio;

    const onMove = (moveEvt) => {
      const currentPos = isRight ? moveEvt.clientX : moveEvt.clientY;
      const delta = currentPos - startPos;
      const next = Math.min(0.8, Math.max(0.2, startRatio + delta / totalSize));
      onSplitRatioChange(next);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      cleanupDragRef.current = null;
    };

    cleanupDragRef.current?.();
    cleanupDragRef.current = cleanup;
    document.body.style.cursor = isRight ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
  };

  if (splitMode === 'single') {
    return (
      <NotePane
        pane={primaryPane}
        paneId="primary"
        isSplit={false}
        isActive={true}
        splitMode={splitMode}
        onSplitPane={onSplitPane}
        onClosePane={null}
        {...paneProps}
      />
    );
  }

  return (
    <div ref={containerRef} className={`multi-note-viewer split-${splitMode}`}>
      <div
        className={`pane-slot${activePaneId === 'primary' ? ' active' : ''}`}
        style={{ flex: `0 0 ${splitRatio * 100}%` }}
        onPointerDownCapture={() => onActivatePane('primary')}
        onFocusCapture={() => onActivatePane('primary')}
      >
        <NotePane
          pane={primaryPane}
          paneId="primary"
          isSplit={true}
          isActive={activePaneId === 'primary'}
          splitMode={splitMode}
          onSplitPane={onSplitPane}
          onClosePane={() => onClosePane('primary')}
          {...paneProps}
        />
      </div>

      <div
        className="split-resizer"
        onPointerDown={handleResizeStart}
        role="separator"
        aria-orientation={splitMode === 'right' ? 'vertical' : 'horizontal'}
        aria-label="Resize split panes"
      />

      <div
        className={`pane-slot${activePaneId === 'secondary' ? ' active' : ''}`}
        style={{ flex: '1 1 0%' }}
        onPointerDownCapture={() => onActivatePane('secondary')}
        onFocusCapture={() => onActivatePane('secondary')}
      >
        <NotePane
          pane={secondaryPane}
          paneId="secondary"
          isSplit={true}
          isActive={activePaneId === 'secondary'}
          splitMode={splitMode}
          onSplitPane={onSplitPane}
          onClosePane={() => onClosePane('secondary')}
          {...paneProps}
        />
      </div>
    </div>
  );
}
