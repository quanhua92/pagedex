import { useMemo, useRef, useState } from 'react';
import {
  baseTitle,
  isAudioPath,
  isCsvPath,
  isDownloadOnlyPath,
  isHtmlPath,
  isImagePath,
  isMarkdownPath,
  isNotebookPath,
  isPdfPath,
  isSvgPath,
  isVideoPath
} from '../lib/paths.js';
import { highlightRawFile, renderMarkdownWithLinks } from '../lib/markdown.js';

let nextTabSeq = 1;
const makeTabId = () => `tab-${++nextTabSeq}`;

/**
 * Manage a single viewer/editor pane's tabs, document buffer, view mode, and rendered output.
 */
export function usePaneState({
  initialPath = null,
  flatFiles = [],
  onOpenCleanup,
  onDiffRequestedRef,
  onTabsOpenClose,
  showToast,
  persistNavigation = true
}) {
  const [tabs, setTabs] = useState(() => [
    { id: makeTabId(), path: initialPath, title: baseTitle(initialPath), preview: '' }
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const activePath = activeTab?.path || '';
  const [content, setContent] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'edit' | 'diff' | 'raw'
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const scrollRef = useRef(null);
  const activePathRef = useRef(activePath);
  const activeTabIdRef = useRef(activeTab?.id || activeTabId);
  const tabsRef = useRef(tabs);
  activePathRef.current = activePath;
  activeTabIdRef.current = activeTab?.id || activeTabId;
  tabsRef.current = tabs;

  async function openFile(relPath, preserveScroll = false, targetTabId = activeTab?.id || activeTabId) {
    if (!relPath) {
      setContent('');
      return;
    }
    const prevScroll = scrollRef.current?.scrollTop ?? 0;

    let nextPreview = '';
    const isBinaryMedia =
      (isImagePath(relPath) && !isSvgPath(relPath)) ||
      isPdfPath(relPath) ||
      isAudioPath(relPath) ||
      isVideoPath(relPath) ||
      isDownloadOnlyPath(relPath);
    if (isBinaryMedia) {
      const checkRes = await fetch(`/api/v1/file?path=${encodeURIComponent(relPath)}`, {
        method: 'HEAD'
      });
      if (!checkRes.ok) {
        setContent('');
        setDraftContent('');
        setDirty(false);
        setTabs((prev) =>
          prev.map((t) => (t.id === targetTabId ? { ...t, path: null, title: 'New tab', preview: '' } : t))
        );
        return;
      }
      setContent('');
      setDraftContent('');
      setDirty(false);
      if (isImagePath(relPath)) nextPreview = '[Image preview]';
      else if (isPdfPath(relPath)) nextPreview = '[PDF document]';
      else if (isAudioPath(relPath)) nextPreview = '[Audio]';
      else if (isVideoPath(relPath)) nextPreview = '[Video]';
      else nextPreview = '[Binary file — download]';
    } else {
      const res = await fetch(`/api/v1/file?path=${encodeURIComponent(relPath)}`);
      if (!res.ok) {
        setContent('');
        setDraftContent('');
        setDirty(false);
        setTabs((prev) =>
          prev.map((t) => (t.id === targetTabId ? { ...t, path: null, title: 'New tab', preview: '' } : t))
        );
        return;
      }
      const text = await res.text();
      setContent(text);
      setDraftContent(text);
      setDirty(false);
      nextPreview = text.replace(/^#+\s*/gm, '').slice(0, 260);
    }

    if (persistNavigation) {
      location.hash = encodeURIComponent(relPath);
      localStorage.setItem('vault-last-path', relPath);
    }

    setTabs((prev) =>
      prev.map((t) =>
        t.id === targetTabId ? { ...t, path: relPath, title: baseTitle(relPath), preview: nextPreview } : t
      )
    );

    if (!preserveScroll) {
      onOpenCleanup?.();
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      });
    } else {
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = prevScroll;
      });
    }
    if (viewMode === 'diff') onDiffRequestedRef?.current?.(relPath);
  }

  async function openInNewTab(relPath, mode = 'preview') {
    const existing = tabsRef.current.find((t) => t.path === relPath);
    if (existing) {
      switchTab(existing);
      setViewMode(mode);
      return;
    }
    const id = `tab-${Date.now()}`;
    activePathRef.current = relPath;
    activeTabIdRef.current = id;
    setTabs((prev) => {
      if (prev.length === 1 && !prev[0].path) {
        return [{ id, path: relPath, title: baseTitle(relPath), preview: '' }];
      }
      return [...prev, { id, path: relPath, title: baseTitle(relPath), preview: '' }];
    });
    setActiveTabId(id);
    await openFile(relPath, false, id);
    setViewMode(mode);
  }

  function createNewTab() {
    const id = makeTabId();
    setTabs((prev) => [...prev, { id, path: null, title: 'New tab', preview: '' }]);
    setActiveTabId(id);
    setContent('');
    setDraftContent('');
    setDirty(false);
    onTabsOpenClose?.();
  }

  function resetPane() {
    const fresh = { id: makeTabId(), path: null, title: 'New tab', preview: '' };
    setTabs([fresh]);
    setActiveTabId(fresh.id);
    activeTabIdRef.current = fresh.id;
    activePathRef.current = '';
    setContent('');
    setDraftContent('');
    setDirty(false);
    setViewMode('preview');
  }

  function closeTab(id, e) {
    e?.stopPropagation();
    const isClosingActive = id === (activeTab?.id || activeTabId);
    if (isClosingActive && dirty && !window.confirm('You have unsaved changes. Discard and close tab?')) {
      return;
    }
    const next = tabs.filter((t) => t.id !== id);
    if (next.length === 0) {
      const fresh = { id: makeTabId(), path: null, title: 'New tab', preview: '' };
      setTabs([fresh]);
      setActiveTabId(fresh.id);
      setContent('');
      setDraftContent('');
      setDirty(false);
      if (persistNavigation) location.hash = '';
      return;
    }
    setTabs(next);
    if (isClosingActive) {
      setDirty(false);
      const target = next[next.length - 1];
      setActiveTabId(target.id);
      if (target.path) openFile(target.path, false, target.id);
      else {
        setContent('');
        setDraftContent('');
        if (persistNavigation) location.hash = '';
      }
    }
  }

  function switchTab(tab) {
    activeTabIdRef.current = tab.id;
    activePathRef.current = tab.path || '';
    setActiveTabId(tab.id);
    onTabsOpenClose?.(true);
    if (tab.path) {
      openFile(tab.path, false, tab.id);
    } else {
      setContent('');
      setDraftContent('');
      setDirty(false);
      if (persistNavigation) location.hash = '';
    }
  }

  async function saveActiveNote(markdown) {
    if (!activePath) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activePath, content: markdown })
      });
      if (res.ok) {
        setContent(markdown);
        setDraftContent(markdown);
        setDirty(false);
        showToast('Saved');
      }
    } finally {
      setSaving(false);
    }
  }

  const { renderedHtml, headings } = useMemo(() => {
    if (!isMarkdownPath(activePath) || viewMode !== 'preview' || isImagePath(activePath) || isDownloadOnlyPath(activePath)) {
      return { renderedHtml: '', headings: [] };
    }
    return renderMarkdownWithLinks(content, activePath, flatFiles);
  }, [content, activePath, viewMode, flatFiles]);

  const highlightedRawHtml = useMemo(() => {
    if (!content) return '';
    if (viewMode !== 'raw' && isMarkdownPath(activePath)) return '';
    return highlightRawFile(content, activePath);
  }, [content, activePath, viewMode]);

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    activePath,
    content,
    setContent,
    draftContent,
    setDraftContent,
    dirty,
    setDirty,
    saving,
    viewMode,
    setViewMode,
    moreMenuOpen,
    setMoreMenuOpen,
    scrollRef,
    activePathRef,
    activeTabIdRef,
    tabsRef,
    openFile,
    openInNewTab,
    createNewTab,
    resetPane,
    closeTab,
    switchTab,
    saveActiveNote,
    renderedHtml,
    headings,
    highlightedRawHtml,
    isImg: isImagePath(activePath),
    isSvg: isSvgPath(activePath),
    isMarkdown: isMarkdownPath(activePath),
    isPdf: isPdfPath(activePath),
    isAudio: isAudioPath(activePath),
    isVideo: isVideoPath(activePath),
    isHtml: isHtmlPath(activePath),
    isCsv: isCsvPath(activePath),
    isNotebook: isNotebookPath(activePath),
    isBinaryDownload: isDownloadOnlyPath(activePath)
  };
}
