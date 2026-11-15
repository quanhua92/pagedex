import React, { useMemo } from 'react';
import { Folder, Home, Plus, Search, Settings } from 'lucide-react';
import { parseDelimitedText } from '../lib/csv.js';
import TiptapEditor from '../TiptapEditor.jsx';

export default function NoteViewer({
  scrollRef,
  activePath,
  openNewNoteDialog,
  openFile,
  openSwitcher,
  setDrawerOpen,
  setSettingsOpen,
  isImg,
  isSvg,
  isMarkdown,
  isPdf,
  isAudio,
  isVideo,
  isHtml,
  isCsv,
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
  const csvRows = useMemo(() => {
    if (!isCsv || viewMode !== 'preview' || !content) return [];
    const delimiter = activePath.toLowerCase().endsWith('.tsv') ? '\t' : ',';
    return parseDelimitedText(content, delimiter);
  }, [isCsv, viewMode, content, activePath]);

  const fileUrl = activePath
    ? `/api/v1/file?path=${encodeURIComponent(activePath)}&t=${reloadTick}`
    : '';
  const downloadUrl = activePath
    ? `/api/v1/file?path=${encodeURIComponent(activePath)}&download=1`
    : '';
  const rawHtmlUrl = activePath
    ? `/raw/${activePath.split('/').map(encodeURIComponent).join('/')}?t=${reloadTick}`
    : '';
  return (
    <div ref={scrollRef} className="content-scroll">
      {!activePath ? (
        <div className="new-tab-view">
          <button className="new-tab-btn" onClick={() => openNewNoteDialog('')}>
            <Plus size={16} strokeWidth={1.9} />
            <span>Create new note</span>
          </button>
          <button className="new-tab-btn" onClick={() => openFile('README.md')}>
            <Home size={16} strokeWidth={1.9} />
            <span>Go to README</span>
          </button>
          <button className="new-tab-btn" onClick={openSwitcher}>
            <Search size={16} strokeWidth={1.9} />
            <span>Go to file</span>
          </button>
          <button className="new-tab-btn" onClick={() => setDrawerOpen(true)}>
            <Folder size={16} strokeWidth={1.9} />
            <span>Browse files</span>
          </button>
          <button className="new-tab-btn" onClick={() => setSettingsOpen(true)}>
            <Settings size={16} strokeWidth={1.9} />
            <span>Settings</span>
          </button>
        </div>
      ) : isImg && !(isSvg && viewMode === 'raw') ? (
        <div className="doc img-wrap">
          <img src={fileUrl} alt={activePath} />
        </div>
      ) : isPdf ? (
        <div className="media-viewer pdf-viewer">
          <div className="media-bar">
            <span>{activePath.split('/').pop()}</span>
            <a className="btn" href={downloadUrl} download={activePath.split('/').pop()}>
              Download PDF
            </a>
          </div>
          <iframe className="pdf-frame" src={fileUrl} title={activePath} />
        </div>
      ) : isAudio ? (
        <div className="doc binary-card audio-viewer">
          <div className="binary-card-name">{activePath.split('/').pop()}</div>
          <div className="binary-card-path">{activePath}</div>
          <audio controls src={fileUrl} style={{ width: '100%', maxWidth: 460 }} />
          <a
            className="btn"
            href={downloadUrl}
            download={activePath.split('/').pop()}
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12 }}
          >
            Download audio
          </a>
        </div>
      ) : isVideo ? (
        <div className="media-viewer video-viewer">
          <div className="media-bar">
            <span>{activePath.split('/').pop()}</span>
            <a className="btn" href={downloadUrl} download={activePath.split('/').pop()}>
              Download video
            </a>
          </div>
          <video controls src={fileUrl} className="video-player" />
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
      ) : viewMode === 'edit' && isMarkdown ? (
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
      ) : isHtml && viewMode === 'preview' ? (
        <div className="media-viewer html-viewer">
          <iframe
            className="html-frame"
            src={rawHtmlUrl}
            sandbox="allow-scripts"
            title={activePath}
          />
        </div>
      ) : isCsv && viewMode === 'preview' ? (
        <div
          className="doc csv-wrap"
          style={{
            fontSize: `${Math.max(12, settings.fontSize - 1)}px`,
            maxWidth: `${settings.maxWidth + 160}px`
          }}
        >
          {csvRows.length === 0 ? (
            <div className="empty-note">Empty table.</div>
          ) : (
            <div className="csv-scroll">
              <table>
                <thead>
                  <tr>
                    {csvRows[0].map((cell, idx) => (
                      <th key={idx}>{cell}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(1).map((row, rIdx) => (
                    <tr key={rIdx}>
                      {csvRows[0].map((_, cIdx) => (
                        <td key={cIdx}>{row[cIdx] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : viewMode === 'raw' || !isMarkdown ? (
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
