import React, { Suspense, lazy } from 'react';

const TiptapEditor = lazy(() => import('../TiptapEditor.jsx'));

export default function NoteViewer({
  scrollRef,
  activePath,
  openNewNoteDialog,
  openFile,
  openSwitcher,
  setDrawerOpen,
  setSettingsOpen,
  isImg,
  reloadTick,
  isBinaryDownload,
  viewMode,
  settings,
  diffData,
  requestDiscard,
  content,
  saving,
  dirty,
  setDraftContent,
  setDirty,
  saveActiveNote,
  highlightedRawHtml,
  handleDocClick,
  renderedHtml
}) {
  return (
    <div ref={scrollRef} className="content-scroll">
      {!activePath ? (
        <div className="new-tab-view">
          <button className="new-tab-btn" onClick={() => openNewNoteDialog('')}>
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            <span>Create new note</span>
          </button>
          <button className="new-tab-btn" onClick={() => openFile('README.md')}>
            <svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
            <span>Go to README</span>
          </button>
          <button className="new-tab-btn" onClick={openSwitcher}>
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <span>Go to file</span>
          </button>
          <button className="new-tab-btn" onClick={() => setDrawerOpen(true)}>
            <svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
            <span>Browse files</span>
          </button>
          <button className="new-tab-btn" onClick={() => setSettingsOpen(true)}>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            <span>Settings</span>
          </button>
        </div>
      ) : isImg ? (
        <div className="doc img-wrap">
          <img
            src={`/api/v1/file?path=${encodeURIComponent(activePath)}&t=${reloadTick}`}
            alt={activePath}
          />
        </div>
      ) : isBinaryDownload ? (
        <div className="doc binary-card">
          <div className="binary-card-name">{activePath.split('/').pop()}</div>
          <div className="binary-card-path">{activePath}</div>
          <a
            className="btn primary"
            href={`/api/v1/file?path=${encodeURIComponent(activePath)}&download=1`}
            download={activePath.split('/').pop()}
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Download file
          </a>
        </div>
      ) : viewMode === 'diff' ? (
        <div className="diff-wrap" style={{ maxWidth: `${settings.maxWidth + 80}px` }}>
          <div className="diff-head">
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              {diffData?.untracked ? 'Untracked file' : `${diffData?.hunks?.length || 0} hunk(s)`}
            </span>
            {diffData?.hunks?.length > 0 && (
              <button className="btn" style={{ color: '#f87171' }} onClick={() => requestDiscard()}>
                Discard file
              </button>
            )}
          </div>
          {!diffData || diffData.hunks.length === 0 ? (
            <div className="empty-note">No uncommitted changes for this file.</div>
          ) : (
            diffData.hunks.map((hunk, hIdx) => (
              <div key={hIdx} className="diff-hunk">
                <div className="diff-hunk-bar">
                  <span>{hunk.header}</span>
                  {!diffData.untracked && (
                    <button className="btn" onClick={() => requestDiscard({ hunkIndex: hIdx })}>
                      Discard hunk
                    </button>
                  )}
                </div>
                {hunk.lines.map((line, lIdx) => (
                  <div key={lIdx} className={`diff-line ${line.type}`}>
                    <span className="diff-ln">{line.newLine ?? line.oldLine ?? ''}</span>
                    <span className="diff-sig">
                      {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                    </span>
                    <span className="diff-txt">{line.text || ' '}</span>
                    {!diffData.untracked && line.type !== 'context' ? (
                      <button
                        className="diff-discard-btn"
                        title="Discard line"
                        onClick={() =>
                          requestDiscard({
                            hunkIndex: hIdx,
                            lineIndex: lIdx,
                            previewText: `${line.type === 'add' ? '+' : '-'} ${line.text}`
                          })
                        }
                      >
                        ↺
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      ) : viewMode === 'edit' && activePath.endsWith('.md') ? (
        <Suspense fallback={<div className="empty-note" style={{ padding: '24px' }}>Loading editor...</div>}>
          <TiptapEditor
            fileKey={activePath}
            content={content}
            fontSize={settings.fontSize}
            lineHeight={settings.lineHeight}
            maxWidth={settings.maxWidth}
            saving={saving}
            dirty={dirty}
            onChange={(md) => {
              setDraftContent(md);
              setDirty(md !== content);
            }}
            onSave={saveActiveNote}
          />
        </Suspense>
      ) : viewMode === 'raw' || !activePath.endsWith('.md') ? (
        <pre
          className="raw-view"
          style={{
            fontSize: `${Math.max(12, settings.fontSize - 2)}px`,
            maxWidth: `${settings.maxWidth + 80}px`
          }}
        >
          <code className="hljs" dangerouslySetInnerHTML={{ __html: highlightedRawHtml }} />
        </pre>
      ) : (
        <div
          className="doc"
          style={{
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            maxWidth: `${settings.maxWidth}px`
          }}
          onClick={handleDocClick}
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      )}
    </div>
  );
}
