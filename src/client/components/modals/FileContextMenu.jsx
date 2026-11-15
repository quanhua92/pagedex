import React from 'react';
import { baseTitle } from '../../lib/paths.js';

export default function FileContextMenu({
  fileMenu,
  setFileMenu,
  openNewNoteDialog,
  uploadDirRef,
  uploadInputRef,
  setRenameError,
  setRenameTarget,
  setTabs,
  setActiveTabId,
  setViewMode,
  openFile,
  gitChanges,
  loadDiff,
  requestDiscard,
  setDeleteError,
  setDeleteTarget
}) {
  if (!fileMenu) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 59 }}
      onClick={() => setFileMenu(null)}
    >
      <div
        className="file-ctx-menu"
        style={{ left: fileMenu.x, top: fileMenu.y }}
        onClick={(e) => e.stopPropagation()}
      >
        {fileMenu.type === 'dir' ? (
          <>
            <button
              className="more-item"
              onClick={() => {
                const target = fileMenu.path;
                setFileMenu(null);
                openNewNoteDialog(target);
              }}
            >
              <span>New note here</span>
            </button>
            <button
              className="more-item"
              onClick={() => {
                uploadDirRef.current = fileMenu.path;
                setFileMenu(null);
                uploadInputRef.current?.click();
              }}
            >
              <span>Upload file...</span>
            </button>
            <button
              className="more-item"
              onClick={() => {
                const target = fileMenu.path;
                setFileMenu(null);
                setRenameError('');
                setRenameTarget({ type: 'dir', oldPath: target, newPath: target });
              }}
            >
              <span>Rename / Move</span>
            </button>
            <button
              className="more-item"
              onClick={() => {
                navigator.clipboard?.writeText(fileMenu.path);
                setFileMenu(null);
              }}
            >
              <span>Copy path</span>
            </button>
          </>
        ) : (
          <>
            <button
              className="more-item"
              onClick={() => {
                const target = fileMenu.path;
                const id = `tab-${Date.now()}`;
                setFileMenu(null);
                setTabs((prev) => [...prev, { id, path: target, title: baseTitle(target), preview: '' }]);
                setActiveTabId(id);
                setViewMode('preview');
                openFile(target, false, id);
              }}
            >
              <span>Open in new tab</span>
            </button>
            <button
              className="more-item"
              onClick={() => {
                const target = fileMenu.path;
                setFileMenu(null);
                setRenameError('');
                setRenameTarget({ type: 'file', oldPath: target, newPath: target });
              }}
            >
              <span>Rename / Move</span>
            </button>
            <button
              className="more-item"
              onClick={() => {
                navigator.clipboard?.writeText(fileMenu.path);
                setFileMenu(null);
              }}
            >
              <span>Copy path</span>
            </button>
            {fileMenu.path.endsWith('.md') && (
              <button
                className="more-item"
                onClick={() => {
                  navigator.clipboard?.writeText(`[[${fileMenu.path.replace(/\.md$/i, '')}]]`);
                  setFileMenu(null);
                }}
              >
                <span>Copy [[wikilink]]</span>
              </button>
            )}
            {gitChanges.some((c) => c.path === fileMenu.path) && (
              <>
                <button
                  className="more-item"
                  onClick={() => {
                    const target = fileMenu.path;
                    setFileMenu(null);
                    setViewMode('diff');
                    openFile(target);
                    loadDiff(target);
                  }}
                >
                  <span>View Diff</span>
                </button>
                <button
                  className="more-item"
                  style={{ color: 'var(--amber)' }}
                  onClick={() => {
                    const target = fileMenu.path;
                    setFileMenu(null);
                    requestDiscard({ path: target });
                  }}
                >
                  <span>Discard changes</span>
                </button>
              </>
            )}
            <button
              className="more-item"
              style={{ color: '#f87171', borderTop: '1px solid var(--border)', marginTop: 2, paddingTop: 8 }}
              onClick={() => {
                const target = fileMenu.path;
                setFileMenu(null);
                setDeleteError('');
                setDeleteTarget(target);
              }}
            >
              <span>Delete</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
