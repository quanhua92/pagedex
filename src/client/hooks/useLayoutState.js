import { useEffect, useRef, useState } from 'react';

function readStoredWidth(key, min, max, fallback) {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v >= min && v <= max ? v : fallback;
  } catch {
    return fallback;
  }
}

function startPanelResize(e, startWidth, min, max, direction, storageKey, setWidth) {
  e.preventDefault();
  const startX = e.clientX;
  let latestW = startWidth;
  const onMove = (ev) => {
    const delta = (ev.clientX - startX) * direction;
    latestW = Math.min(max, Math.max(min, Math.round(startWidth + delta)));
    setWidth(latestW);
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    try {
      localStorage.setItem(storageKey, String(latestW));
    } catch {}
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

/**
 * Manage toast notifications, pinned sidebar items, and resizable sidebar/outline widths.
 */
export function useLayoutState() {
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    readStoredWidth('pagedex-sidebar-width', 200, 480, 270)
  );
  const [outlineWidth, setOutlineWidth] = useState(() =>
    readStoredWidth('pagedex-outline-width', 200, 440, 240)
  );
  const [pinned, setPinned] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pagedex-pinned') || '[]');
      return Array.isArray(saved)
        ? saved.filter((item) => item && typeof item.path === 'string' && (item.type === 'file' || item.type === 'dir'))
        : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('pagedex-pinned', JSON.stringify(pinned));
    } catch {
      // Ignore storage quota / restricted context errors
    }
  }, [pinned]);

  function showToast(msg) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1800);
  }

  function isPinned(itemPath) {
    return pinned.some((item) => item.path === itemPath);
  }

  function togglePin(itemPath, type) {
    const already = pinned.some((item) => item.path === itemPath);
    const label = itemPath.split('/').pop() || itemPath;
    setPinned((prev) => {
      if (prev.some((item) => item.path === itemPath)) {
        return prev.filter((item) => item.path !== itemPath);
      }
      return [...prev, { path: itemPath, type }];
    });
    showToast(already ? `Unpinned ${label}` : `Pinned ${label}`);
  }

  function reorderPinned(fromPath, toPath) {
    setPinned((prev) => {
      const fromIdx = prev.findIndex((item) => item.path === fromPath);
      const toIdx = prev.findIndex((item) => item.path === toPath);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }

  function startResizeSidebar(e) {
    startPanelResize(e, sidebarWidth, 200, 480, 1, 'pagedex-sidebar-width', setSidebarWidth);
  }

  function startResizeOutline(e) {
    startPanelResize(e, outlineWidth, 200, 440, -1, 'pagedex-outline-width', setOutlineWidth);
  }

  return {
    toast,
    showToast,
    sidebarWidth,
    outlineWidth,
    pinned,
    setPinned,
    isPinned,
    togglePin,
    reorderPinned,
    startResizeSidebar,
    startResizeOutline
  };
}
