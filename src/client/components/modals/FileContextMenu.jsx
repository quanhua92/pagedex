import React from 'react';
import {
  Copy,
  ExternalLink,
  FolderInput,
  GitCompare,
  Link2,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Trash2,
  Upload
} from 'lucide-react';
import { baseTitle } from '../../lib/paths.js';

function MenuIcon({ icon: Icon }) {
  return <Icon className="file-ctx-menu-icon" size={14} strokeWidth={1.9} aria-hidden="true" />;
}

export default function FileContextMenu({
  fileMenu,
  setFileMenu,
  openNewNoteDialog,
  uploadDirRef,
  uploadInputRef,
  setRenameError,
  setRenameTarget,
  setMoveError,
  setMoveTarget,
  openInNewTab,
  gitChanges,
  loadDiff,
  requestDiscard,
  setDeleteError,
  setDeleteTarget,
  isPinned,
  togglePin
}) {
  if (!fileMenu) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 59 }}
      onClick={() => setFileMenu(null)}
    >
      <div
        className="file-ctx-menu"
        style={{ left: fileMenu.x, top: fileMenu.y, maxHeight: `calc(100dvh - ${fileMenu.y + 8}px)` }}
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
              <MenuIcon icon={Plus} />
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
              <MenuIcon icon={Upload} />
              <span>Upload file...</span>
            </button>
            <button
              className="more-item"
              onClick={() => {
                const target = fileMenu.path;
                const parts = target.split('/');
                const newName = parts.pop() || '';
                const parentDir = parts.join('/');
                setFileMenu(null);
                setRenameError('');
                setRenameTarget({ type: 'dir', oldPath: target, parentDir, newName });
              }}
            >
              <MenuIcon icon={Pencil} />
              <span>Rename</span>
            </button>
            <button
              className="more-item"
              onClick={() => {
                const target = fileMenu.path;
                const parts = target.split('/');
                const name = parts.pop() || '';
                const destFolder = parts.join('/');
                setFileMenu(null);
                setMoveError('');
                setMoveTarget({ type: 'dir', oldPath: target, name, destFolder });
              }}
            >
              <MenuIcon icon={FolderInput} />
              <span>Move</span>
            </button>
            <button
              className="more-item"
              onClick={() => {
                const target = fileMenu.path;
                const type = fileMenu.type;
                setFileMenu(null);
                togglePin(target, type);
              }}
            >
              <MenuIcon icon={isPinned(fileMenu.path) ? PinOff : Pin} />
              <span>{isPinned(fileMenu.path) ? 'Unpin' : 'Pin'}</span>
            </button>
            <button
              className="more-item"
              onClick={() => {
                navigator.clipboard?.writeText(fileMenu.path);
                setFileMenu(null);
              }}
            >
              <MenuIcon icon={Copy} />
              <span>Copy path</span>
            </button>
          </>
        ) : (
          <>
            <button
              className="more-item"
              onClick={() => {
                const target = fileMenu.path;
                setFileMenu(null);
                openInNewTab(target, 'preview');
              }}
            >
              <MenuIcon icon={ExternalLink} />
              <span>Open in new tab</span>
            </button>
            <button
              className="more-item"
              onClick={() => {
                const target = fileMenu.path;
                const type = fileMenu.type;
                setFileMenu(null);
                togglePin(target, type);
              }}
            >
              <MenuIcon icon={isPinned(fileMenu.path) ? PinOff : Pin} />
              <span>{isPinned(fileMenu.path) ? 'Unpin' : 'Pin'}</span>
            </button>
            <button
              className="more-item"
              onClick={() => {
                const target = fileMenu.path;
                const parts = target.split('/');
                const newName = parts.pop() || '';
                const parentDir = parts.join('/');
                setFileMenu(null);
                setRenameError('');
                setRenameTarget({ type: 'file', oldPath: target, parentDir, newName });
              }}
            >
              <MenuIcon icon={Pencil} />
              <span>Rename</span>
            </button>
            <button
              className="more-item"
              onClick={() => {
                const target = fileMenu.path;
                const parts = target.split('/');
                const name = parts.pop() || '';
                const destFolder = parts.join('/');
                setFileMenu(null);
                setMoveError('');
                setMoveTarget({ type: 'file', oldPath: target, name, destFolder });
              }}
            >
              <MenuIcon icon={FolderInput} />
              <span>Move</span>
            </button>
            <button
              className="more-item"
              onClick={() => {
                navigator.clipboard?.writeText(fileMenu.path);
                setFileMenu(null);
              }}
            >
              <MenuIcon icon={Copy} />
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
                <MenuIcon icon={Link2} />
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
                  <MenuIcon icon={GitCompare} />
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
                  <MenuIcon icon={RotateCcw} />
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
              <MenuIcon icon={Trash2} />
              <span>Delete</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
