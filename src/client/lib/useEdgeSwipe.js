import { useEffect, useRef } from 'react';

const MAX_EDGE_PX = 120;
const EDGE_RATIO = 0.28;
const LOCK_THRESHOLD_PX = 6;
const COMMIT_RATIO = 0.25;
const FLICK_VELOCITY = 0.28; // px/ms
const FLICK_MIN_PX = 18;

function isInsideHorizontalScroll(el) {
  let node = el;
  while (node && node !== document.body) {
    const tag = node.tagName;
    if (tag === 'PRE' || tag === 'TABLE' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return true;
    }
    if (node.isContentEditable) return true;
    if (node.scrollWidth > node.clientWidth + 2) {
      const ox = getComputedStyle(node).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    node = node.parentElement;
  }
  return false;
}

function clearInlineStyles(el, props) {
  if (!el) return;
  for (const prop of props) {
    el.style[prop] = '';
  }
}

/**
 * Live finger-tracking edge-swipe hook for left (.sidebar) and right (.rightbar) drawers.
 */
export function useEdgeSwipe({
  drawerOpen,
  outlineDrawerOpen,
  outlinePosition = 'right',
  setDrawerOpen,
  onOpenOutline,
  setOutlineDrawerOpen,
  disabled = false
}) {
  const stateRef = useRef({
    drawerOpen,
    outlineDrawerOpen,
    outlinePosition,
    setDrawerOpen,
    onOpenOutline,
    setOutlineDrawerOpen,
    disabled
  });
  stateRef.current = {
    drawerOpen,
    outlineDrawerOpen,
    outlinePosition,
    setDrawerOpen,
    onOpenOutline,
    setOutlineDrawerOpen,
    disabled
  };

  useEffect(() => {
    let gesture = null;

    const resetStyles = (g) => {
      if (!g) return;
      clearInlineStyles(g.panelEl, ['transform', 'transition']);
      clearInlineStyles(g.backdropEl, [
        'display',
        'position',
        'inset',
        'zIndex',
        'background',
        'opacity',
        'transition'
      ]);
    };

    const onTouchStart = (e) => {
      const s = stateRef.current;
      if (s.disabled || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const edgePx = Math.min(MAX_EDGE_PX, Math.round(vw * EDGE_RATIO));

      let side = null;
      let action = null;

      if (s.drawerOpen && vw <= 768) {
        side = 'left';
        action = 'close';
      } else if (s.outlineDrawerOpen && vw <= 960 && s.outlinePosition !== 'bottom') {
        side = 'right';
        action = 'close';
      } else if (!s.drawerOpen && !s.outlineDrawerOpen && !isInsideHorizontalScroll(e.target)) {
        if (startX <= edgePx && vw <= 768) {
          side = 'left';
          action = 'open';
        } else if (startX >= vw - edgePx && vw <= 960 && s.outlinePosition !== 'bottom') {
          side = 'right';
          action = 'open';
        }
      }

      if (!side) return;

      const panelEl = document.querySelector(side === 'left' ? '.sidebar' : '.rightbar');
      const backdropEl = document.querySelector('.backdrop');
      const width = panelEl?.offsetWidth || (side === 'left' ? 310 : 300);

      gesture = {
        side,
        action,
        startX,
        startY,
        lastX: startX,
        startTime: performance.now(),
        lastTime: performance.now(),
        locked: null, // 'horizontal' | 'vertical'
        panelEl,
        backdropEl,
        width
      };
    };

    const onTouchMove = (e) => {
      if (!gesture || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;
      gesture.lastX = touch.clientX;
      gesture.lastTime = performance.now();

      if (!gesture.locked) {
        if (Math.abs(dy) >= LOCK_THRESHOLD_PX && Math.abs(dy) >= Math.abs(dx)) {
          gesture.locked = 'vertical';
          gesture = null;
          return;
        }
        if (Math.abs(dx) >= LOCK_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
          const validDirection =
            (gesture.side === 'left' && gesture.action === 'open' && dx > 0) ||
            (gesture.side === 'left' && gesture.action === 'close' && dx < 0) ||
            (gesture.side === 'right' && gesture.action === 'open' && dx < 0) ||
            (gesture.side === 'right' && gesture.action === 'close' && dx > 0);

          if (!validDirection) {
            gesture = null;
            return;
          }

          gesture.locked = 'horizontal';
          if (gesture.panelEl) {
            gesture.panelEl.style.transition = 'none';
          }
          if (gesture.backdropEl) {
            gesture.backdropEl.style.display = 'block';
            gesture.backdropEl.style.position = 'fixed';
            gesture.backdropEl.style.inset = '0';
            gesture.backdropEl.style.zIndex = '20';
            gesture.backdropEl.style.background = 'rgba(0, 0, 0, 0.5)';
            gesture.backdropEl.style.transition = 'none';
          }
        } else {
          return;
        }
      }

      if (gesture.locked === 'horizontal' && e.cancelable) {
        e.preventDefault();
      }

      const w = gesture.width;
      let progress;
      if (gesture.side === 'left') {
        progress = gesture.action === 'open' ? dx / w : 1 + dx / w;
      } else {
        progress = gesture.action === 'open' ? -dx / w : 1 - dx / w;
      }
      progress = Math.max(0, Math.min(1, progress));

      if (gesture.panelEl) {
        const offsetPct =
          gesture.side === 'left' ? (progress - 1) * 100 : (1 - progress) * 100;
        gesture.panelEl.style.transform = `translateX(${offsetPct}%)`;
      }
      if (gesture.backdropEl) {
        gesture.backdropEl.style.opacity = String(progress);
      }
    };

    const finishGesture = (cancelled) => {
      if (!gesture) return;
      const g = gesture;
      gesture = null;

      if (g.locked !== 'horizontal') {
        resetStyles(g);
        return;
      }

      const dx = g.lastX - g.startX;
      const dt = Math.max(1, g.lastTime - g.startTime);
      const velocity = dx / dt; // px/ms

      let shouldCommit = false;
      if (!cancelled) {
        if (g.side === 'left' && g.action === 'open') {
          shouldCommit =
            dx >= g.width * COMMIT_RATIO || (dx >= FLICK_MIN_PX && velocity >= FLICK_VELOCITY);
        } else if (g.side === 'left' && g.action === 'close') {
          shouldCommit =
            -dx >= g.width * COMMIT_RATIO || (-dx >= FLICK_MIN_PX && -velocity >= FLICK_VELOCITY);
        } else if (g.side === 'right' && g.action === 'open') {
          shouldCommit =
            -dx >= g.width * COMMIT_RATIO || (-dx >= FLICK_MIN_PX && -velocity >= FLICK_VELOCITY);
        } else if (g.side === 'right' && g.action === 'close') {
          shouldCommit =
            dx >= g.width * COMMIT_RATIO || (dx >= FLICK_MIN_PX && velocity >= FLICK_VELOCITY);
        }
      }

      resetStyles(g);

      if (!shouldCommit) return;

      const s = stateRef.current;
      if (g.side === 'left') {
        if (g.action === 'open') {
          s.setOutlineDrawerOpen(false);
          s.setDrawerOpen(true);
        } else {
          s.setDrawerOpen(false);
        }
      } else {
        if (g.action === 'open') {
          s.onOpenOutline();
        } else {
          s.setOutlineDrawerOpen(false);
        }
      }
    };

    const onTouchEnd = () => finishGesture(false);
    const onTouchCancel = () => finishGesture(true);

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
    };
  }, []);
}
