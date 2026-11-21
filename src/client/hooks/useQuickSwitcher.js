import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Manage Quick Switcher / Command Palette state, FTS5 content search, and grouped file results.
 */
export function useQuickSwitcher({
  totalFiles,
  fileStats,
  flatFiles,
  hiddenFolders,
  tabs,
  activeTabId
}) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherTab, setSwitcherTab] = useState('recent'); // 'recent' | 'alpha' | 'tabs' | 'commands'
  const [switcherQuery, setSwitcherQuery] = useState('');
  const [switcherIdx, setSwitcherIdx] = useState(0);
  const [contentHits, setContentHits] = useState([]);
  const [pagedFiles, setPagedFiles] = useState({ items: [], hasMore: false });
  const switcherInputRef = useRef(null);

  const isLargeVault = totalFiles > fileStats.length;

  function openSwitcher() {
    setSwitcherQuery('');
    setSwitcherIdx(0);
    setContentHits([]);
    setSwitcherOpen(true);
    setTimeout(() => switcherInputRef.current?.focus(), 40);
  }

  useEffect(() => {
    if (!switcherOpen) return;
    const q = switcherQuery.trim();
    if (!q || q.startsWith('>')) {
      setContentHits([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setContentHits(data.results || []);
      } catch {
        setContentHits([]);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [switcherQuery, switcherOpen]);

  useEffect(() => {
    if (!switcherOpen || !isLargeVault || switcherTab === 'tabs' || switcherTab === 'commands') {
      setPagedFiles({ items: [], hasMore: false });
      return;
    }
    const sort = switcherTab === 'alpha' ? 'name' : 'mtime';
    const q = switcherQuery.trim();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/files?sort=${sort}&offset=0&limit=100&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setPagedFiles({ items: data.items || [], hasMore: Boolean(data.hasMore) });
      } catch {
        setPagedFiles({ items: [], hasMore: false });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [switcherOpen, isLargeVault, switcherTab, switcherQuery]);

  async function loadMorePagedFiles() {
    const sort = switcherTab === 'alpha' ? 'name' : 'mtime';
    const q = switcherQuery.trim();
    const offset = pagedFiles.items.length;
    const res = await fetch(`/api/v1/files?sort=${sort}&offset=${offset}&limit=100&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setPagedFiles((prev) => ({
      items: [...prev.items, ...(data.items || [])],
      hasMore: Boolean(data.hasMore)
    }));
  }

  const switcherData = useMemo(() => {
    const q = switcherQuery.trim().toLowerCase();
    if (switcherTab === 'tabs') {
      const tabItems = tabs
        .filter((t) => {
          if (!q) return true;
          const haystack = `${t.path || ''} ${t.title || ''}`.toLowerCase();
          return haystack.includes(q);
        })
        .map((t) => ({
          tabId: t.id,
          tab: t,
          path: t.path || 'New tab',
          mtimeMs: 0,
          snippet: t.id === activeTabId ? 'Active tab' : ''
        }));
      return { groups: [{ label: null, items: tabItems }], items: tabItems };
    }
    const isExcluded = (p) => {
      const lower = p.toLowerCase();
      return hiddenFolders.some((dir) => lower.startsWith(dir.toLowerCase() + '/'));
    };

    const baseList = isLargeVault
      ? pagedFiles.items
      : fileStats.length > 0
        ? fileStats
        : flatFiles.map((p) => ({ path: p, mtimeMs: 0 }));
    const mtimeMap = new Map(baseList.map((f) => [f.path, f.mtimeMs || 0]));

    let candidates;
    if (!q) {
      candidates = baseList
        .filter((f) => !isExcluded(f.path))
        .map((f) => ({ path: f.path, mtimeMs: f.mtimeMs || 0, snippet: '' }));
    } else {
      const pathMatches = baseList
        .filter((f) => !isExcluded(f.path) && f.path.toLowerCase().includes(q))
        .map((f) => ({ path: f.path, mtimeMs: f.mtimeMs || 0, snippet: '' }));
      const seen = new Set(pathMatches.map((x) => x.path));
      for (const hit of contentHits) {
        if (!isExcluded(hit.path) && !seen.has(hit.path)) {
          seen.add(hit.path);
          pathMatches.push({
            path: hit.path,
            mtimeMs: hit.mtimeMs ?? mtimeMap.get(hit.path) ?? 0,
            snippet: hit.snippet || ''
          });
        }
      }
      candidates = pathMatches;
    }

    const maxVisible = isLargeVault ? candidates.length : 100;
    if (switcherTab === 'alpha') {
      const sorted = [...candidates]
        .sort((a, b) => {
          const nameA = a.path.split('/').pop().toLowerCase();
          const nameB = b.path.split('/').pop().toLowerCase();
          return nameA.localeCompare(nameB) || a.path.localeCompare(b.path);
        })
        .slice(0, maxVisible);
      return { groups: [{ label: null, items: sorted }], items: sorted };
    }

    const sorted = [...candidates].sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0)).slice(0, maxVisible);
    const now = Date.now();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();
    const dayMs = 86400000;

    const buckets = new Map([
      ['Today', []],
      ['Yesterday', []],
      ['Last 7 days', []],
      ['Last 30 days', []],
      ['Older', []]
    ]);
    for (const item of sorted) {
      const m = item.mtimeMs || 0;
      if (m >= todayMs) buckets.get('Today').push(item);
      else if (m >= todayMs - dayMs) buckets.get('Yesterday').push(item);
      else if (m >= todayMs - 7 * dayMs) buckets.get('Last 7 days').push(item);
      else if (m >= todayMs - 30 * dayMs) buckets.get('Last 30 days').push(item);
      else buckets.get('Older').push(item);
    }
    const groups = [];
    const flat = [];
    for (const [label, list] of buckets) {
      if (list.length > 0) {
        groups.push({ label, items: list });
        flat.push(...list);
      }
    }
    return { groups, items: flat };
  }, [
    switcherQuery,
    switcherTab,
    isLargeVault,
    pagedFiles.items,
    fileStats,
    flatFiles,
    contentHits,
    hiddenFolders,
    tabs,
    activeTabId
  ]);

  return {
    switcherOpen,
    setSwitcherOpen,
    switcherTab,
    setSwitcherTab,
    switcherQuery,
    setSwitcherQuery,
    switcherIdx,
    setSwitcherIdx,
    switcherInputRef,
    isLargeVault,
    pagedFiles,
    loadMorePagedFiles,
    switcherData,
    switcherItems: switcherData.items,
    openSwitcher
  };
}
