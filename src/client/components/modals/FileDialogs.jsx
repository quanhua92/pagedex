import React from 'react';
import { buildNewNotePath } from '../../lib/paths.js';

export function NewNoteModal({
  newNoteOpen,
  setNewNoteOpen,
  newNoteTitle,
  setNewNoteTitle,
  newNoteFolder,
  setNewNoteFolder,
  allFolders,
  newNoteError,
  confirmNewNote
}) {
  if (!newNoteOpen) return null;

  return (
    <div className="modal-backdrop" onClick={() => setNewNoteOpen(false)}>
      <div className="modal" style={{ height: 'auto', maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>New note</h2>
          <button className="btn" onClick={() => setNewNoteOpen(false)}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Title</label>
            <input
              type="text"
              autoFocus
              placeholder="My note title"
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmNewNote()}
            />
          </div>
          <div className="field">
            <label>Folder</label>
            <input
              type="text"
              placeholder="(vault root) or type/select folder"
              value={newNoteFolder}
              onChange={(e) => setNewNoteFolder(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmNewNote()}
            />
            <div className="folder-picker">
              {allFolders.map((f) => {
                const active = newNoteFolder.trim().replace(/^\/+|\/+$/g, '') === f;
                return (
                  <button
                    key={f || '__root__'}
                    type="button"
                    className={`folder-pick-item${active ? ' active' : ''}`}
                    onClick={() => setNewNoteFolder(f)}
                  >
                    {f ? f : '/ (vault root)'}
                  </button>
                );
              })}
            </div>
          </div>
          {buildNewNotePath(newNoteTitle, newNoteFolder) && (
            <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
              Path: {buildNewNotePath(newNoteTitle, newNoteFolder)}
            </div>
          )}
          {newNoteError && (
            <div className="git-output" style={{ color: '#f87171' }}>
              {newNoteError}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => setNewNoteOpen(false)}>
            Cancel
          </button>
          <button className="btn primary" onClick={confirmNewNote}>
            Create note
          </button>
        </div>
      </div>
    </div>
  );
}

export function RenameModal({
  renameTarget,
  setRenameTarget,
  renameError,
  confirmRenameFile
}) {
  if (!renameTarget) return null;

  return (
    <div className="modal-backdrop" onClick={() => setRenameTarget(null)}>
      <div className="modal" style={{ height: 'auto', maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Rename / Move</h2>
          <button className="btn" onClick={() => setRenameTarget(null)}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>New path</label>
            <input
              type="text"
              value={renameTarget.newPath}
              onChange={(e) => setRenameTarget((r) => ({ ...r, newPath: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && confirmRenameFile()}
            />
          </div>
          {renameError && (
            <div className="git-output" style={{ color: '#f87171' }}>
              {renameError}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => setRenameTarget(null)}>
            Cancel
          </button>
          <button className="btn primary" onClick={confirmRenameFile}>
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteConfirmModal({
  deleteTarget,
  setDeleteTarget,
  deleteError,
  confirmDeleteFile
}) {
  if (!deleteTarget) return null;

  return (
    <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
      <div className="modal" style={{ height: 'auto', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Delete file?</h2>
          <button className="btn" onClick={() => setDeleteTarget(null)}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            This will permanently remove <strong style={{ color: 'var(--text)' }}>{deleteTarget}</strong> from disk.
          </div>
          {deleteError && (
            <div className="git-output" style={{ color: '#f87171' }}>
              {deleteError}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => setDeleteTarget(null)}>
            Cancel
          </button>
          <button
            className="btn"
            style={{ background: '#ef4444', borderColor: '#ef4444', color: '#ffffff', fontWeight: 600 }}
            onClick={confirmDeleteFile}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function DiscardConfirmModal({
  discardTarget,
  setDiscardTarget,
  discardError,
  confirmDiscard
}) {
  if (!discardTarget) return null;

  return (
    <div className="modal-backdrop" onClick={() => setDiscardTarget(null)}>
      <div className="modal" style={{ height: 'auto', maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>
            {discardTarget.hunkIndex === undefined
              ? 'Discard file changes?'
              : discardTarget.lineIndex === undefined
                ? 'Discard hunk?'
                : 'Discard line?'}
          </h2>
          <button className="btn" onClick={() => setDiscardTarget(null)}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
            {discardTarget.path}
          </div>
          {discardTarget.previewText && (
            <div className="git-output" style={{ marginTop: 0 }}>
              {discardTarget.previewText}
            </div>
          )}
          {discardError && (
            <div className="git-output" style={{ color: '#f87171' }}>
              {discardError}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => setDiscardTarget(null)}>
            Cancel
          </button>
          <button
            className="btn"
            style={{ background: '#ef4444', borderColor: '#ef4444', color: '#ffffff', fontWeight: 600 }}
            onClick={confirmDiscard}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
