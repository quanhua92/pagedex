import React from 'react';
import { buildNewFolderPath, buildNewNotePath } from '../../lib/paths.js';
import FolderPicker from '../FolderPicker.jsx';

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
            <FolderPicker
              value={newNoteFolder}
              onChange={setNewNoteFolder}
              allFolders={allFolders}
              allowCreate
              defaultExpanded={false}
              onEnter={confirmNewNote}
            />
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

export function NewFolderModal({
  newFolderOpen,
  setNewFolderOpen,
  newFolderName,
  setNewFolderName,
  newFolderParent,
  setNewFolderParent,
  allFolders,
  newFolderError,
  confirmNewFolder
}) {
  if (!newFolderOpen) return null;

  return (
    <div className="modal-backdrop" onClick={() => setNewFolderOpen(false)}>
      <div className="modal" style={{ height: 'auto', maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>New folder</h2>
          <button className="btn" onClick={() => setNewFolderOpen(false)}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Folder name</label>
            <input
              type="text"
              autoFocus
              placeholder="my-folder"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmNewFolder()}
            />
          </div>
          <div className="field">
            <label>Parent folder</label>
            <FolderPicker
              value={newFolderParent}
              onChange={setNewFolderParent}
              allFolders={allFolders}
              allowCreate={false}
              defaultExpanded={false}
              onEnter={confirmNewFolder}
            />
          </div>
          {buildNewFolderPath(newFolderName, newFolderParent) && (
            <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
              Path: {buildNewFolderPath(newFolderName, newFolderParent)}
            </div>
          )}
          {newFolderError && (
            <div className="git-output" style={{ color: '#f87171' }}>
              {newFolderError}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => setNewFolderOpen(false)}>
            Cancel
          </button>
          <button className="btn primary" onClick={confirmNewFolder}>
            Create folder
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
          <h2>{renameTarget.type === 'dir' ? 'Rename folder' : 'Rename file'}</h2>
          <button className="btn" onClick={() => setRenameTarget(null)}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            Folder: {renameTarget.parentDir ? `${renameTarget.parentDir}/` : '/'}
          </div>
          <div className="field">
            <label>New name</label>
            <input
              type="text"
              autoFocus
              value={renameTarget.newName}
              onChange={(e) => setRenameTarget((r) => ({ ...r, newName: e.target.value }))}
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

export function MoveModal({
  moveTarget,
  setMoveTarget,
  allFolders,
  moveError,
  confirmMoveItem
}) {
  if (!moveTarget) return null;

  const cleanDest = (moveTarget.destFolder || '').trim().replace(/^\/+|\/+$/g, '');
  const destPath = cleanDest ? `${cleanDest}/${moveTarget.name}` : moveTarget.name;

  return (
    <div className="modal-backdrop" onClick={() => setMoveTarget(null)}>
      <div className="modal" style={{ height: 'auto', maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{moveTarget.type === 'dir' ? 'Move folder' : 'Move file'}</h2>
          <button className="btn" onClick={() => setMoveTarget(null)}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            From: {moveTarget.oldPath}
          </div>
          <div className="field">
            <label>Destination folder</label>
            <FolderPicker
              value={moveTarget.destFolder}
              onChange={(destFolder) => setMoveTarget((m) => ({ ...m, destFolder }))}
              allFolders={allFolders}
              excludePrefix={moveTarget.type === 'dir' ? moveTarget.oldPath : ''}
              defaultExpanded
              onEnter={confirmMoveItem}
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            To: {destPath}
          </div>
          {moveError && (
            <div className="git-output" style={{ color: '#f87171' }}>
              {moveError}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => setMoveTarget(null)}>
            Cancel
          </button>
          <button className="btn primary" onClick={confirmMoveItem}>
            Move
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
