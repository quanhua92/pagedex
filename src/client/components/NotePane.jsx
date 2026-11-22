import React from 'react';
import TopbarAndTabs, { DesktopTabs } from './TopbarAndTabs.jsx';
import NoteViewer from './NoteViewer.jsx';

/**
 * Single editor/viewer pane pairing TopbarAndTabs with NoteViewer.
 */
export default function NotePane({
  pane,
  paneId = 'primary',
  isSplit = false,
  isActive = true,
  splitMode = 'single',
  onSplitPane,
  onClosePane,
  vaultName,
  settings,
  flatFiles,
  reloadTick,
  readOnly,
  setDrawerOpen,
  openNewNoteDialog,
  openSwitcher,
  setSettingsOpen,
  loadDiff,
  diffData,
  requestDiscard,
  setDeleteError,
  setDeleteTarget,
  setRenameError,
  setRenameTarget,
  setMoveError,
  setMoveTarget,
  isPinned,
  togglePin,
  gitChanges,
  showToast,
  handleDocClick,
  pendingJumpQuery,
  onClearJumpQuery,
  outlinePosition,
  outlineDrawerOpen,
  sidebarCollapsed,
  onToggleSidebar,
  onToggleOutline,
  onOpenOutline
}) {
  const handleCloseTab = (tabId, e) => {
    if (isSplit && pane.tabs.length <= 1 && onClosePane) {
      e?.stopPropagation?.();
      onClosePane(paneId);
      return;
    }
    pane.closeTab(tabId, e);
  };

  return (
    <div className={`note-pane${isSplit ? ' is-split' : ''}${isSplit && isActive ? ' active' : ''}`}>
      {isSplit && (
        <DesktopTabs
          tabs={pane.tabs}
          activeTabId={pane.activeTabId}
          switchTab={pane.switchTab}
          closeTab={handleCloseTab}
          createNewTab={pane.createNewTab}
        />
      )}
      <TopbarAndTabs
        setDrawerOpen={setDrawerOpen}
        activePath={pane.activePath}
        moreMenuOpen={pane.moreMenuOpen}
        setMoreMenuOpen={pane.setMoreMenuOpen}
        viewMode={pane.viewMode}
        setViewMode={pane.setViewMode}
        loadDiff={loadDiff}
        setDeleteError={setDeleteError}
        setDeleteTarget={setDeleteTarget}
        setRenameError={setRenameError}
        setRenameTarget={setRenameTarget}
        setMoveError={setMoveError}
        setMoveTarget={setMoveTarget}
        openInNewTab={pane.openInNewTab}
        isPinned={isPinned}
        togglePin={togglePin}
        gitChanges={gitChanges}
        requestDiscard={requestDiscard}
        showToast={showToast}
        outlinePosition={outlinePosition}
        outlineDrawerOpen={outlineDrawerOpen}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={onToggleSidebar}
        onToggleOutline={onToggleOutline}
        onOpenOutline={onOpenOutline}
        readOnly={readOnly}
        isSplit={isSplit}
        splitMode={splitMode}
        onSplitPane={onSplitPane}
        onClosePane={onClosePane ? () => onClosePane(paneId) : null}
      />

      <NoteViewer
        scrollRef={pane.scrollRef}
        activePath={pane.activePath}
        vaultName={vaultName}
        openNewNoteDialog={openNewNoteDialog}
        openFile={pane.openFile}
        openSwitcher={openSwitcher}
        setDrawerOpen={setDrawerOpen}
        setSettingsOpen={setSettingsOpen}
        isImg={pane.isImg}
        isSvg={pane.isSvg}
        isMarkdown={pane.isMarkdown}
        isPdf={pane.isPdf}
        isAudio={pane.isAudio}
        isVideo={pane.isVideo}
        isHtml={pane.isHtml}
        isCsv={pane.isCsv}
        isNotebook={pane.isNotebook}
        flatFiles={flatFiles}
        reloadTick={reloadTick}
        isBinaryDownload={pane.isBinaryDownload}
        viewMode={pane.viewMode}
        setViewMode={pane.setViewMode}
        settings={settings}
        diffData={diffData}
        requestDiscard={requestDiscard}
        content={pane.content}
        draftContent={pane.draftContent}
        saving={pane.saving}
        dirty={pane.dirty}
        setDraftContent={pane.setDraftContent}
        setDirty={pane.setDirty}
        saveActiveNote={pane.saveActiveNote}
        highlightedRawHtml={pane.highlightedRawHtml}
        handleDocClick={handleDocClick}
        renderedHtml={pane.renderedHtml}
        pendingJumpQuery={pendingJumpQuery}
        onClearJumpQuery={onClearJumpQuery}
        readOnly={readOnly}
      />
    </div>
  );
}
