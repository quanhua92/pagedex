import React from 'react';

export default function QuickSwitcherModal({
  switcherOpen,
  setSwitcherOpen,
  switcherTab,
  setSwitcherTab,
  switcherIdx,
  setSwitcherIdx,
  switcherInputRef,
  totalFiles,
  fileStats,
  switcherItems,
  switcherData,
  openFile,
  isLargeVault,
  pagedFiles,
  loadMorePagedFiles,
  switcherQuery,
  setSwitcherQuery
}) {
  if (!switcherOpen) return null;

  return (
    <div className="switcher-backdrop" onClick={() => setSwitcherOpen(false)}>
      <div className="switcher" onClick={(e) => e.stopPropagation()}>
        <div className="switcher-head">
          <div className="switcher-tabs">
            <button
              className={`switcher-tab${switcherTab === 'recent' ? ' active' : ''}`}
              onClick={() => {
                setSwitcherTab('recent');
                setSwitcherIdx(0);
                switcherInputRef.current?.focus();
              }}
            >
              Recent
            </button>
            <button
              className={`switcher-tab${switcherTab === 'alpha' ? ' active' : ''}`}
              onClick={() => {
                setSwitcherTab('alpha');
                setSwitcherIdx(0);
                switcherInputRef.current?.focus();
              }}
            >
              A–Z
            </button>
          </div>
          {totalFiles > fileStats.length && (
            <span className="switcher-cap">
              {fileStats.length.toLocaleString()} / {totalFiles.toLocaleString()} indexed
            </span>
          )}
        </div>
        <div className="switcher-list">
          {switcherItems.length === 0 ? (
            <div className="empty-note" style={{ padding: '12px' }}>No matching notes</div>
          ) : (() => {
            let flatIndex = 0;
            const now = Date.now();
            const fmtTime = (ms) => {
              if (!ms) return '';
              const diff = Math.max(0, now - ms);
              if (diff < 60000) return 'now';
              if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
              if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
              if (diff < 7 * 86400000) return `${Math.floor(diff / 86400000)}d`;
              return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            };
            return switcherData.groups.map((grp) => (
              <React.Fragment key={grp.label || 'all'}>
                {grp.label && <div className="switcher-group-title">{grp.label}</div>}
                {grp.items.map((item) => {
                  const idx = flatIndex++;
                  return (
                    <button
                      key={item.path}
                      className={`switcher-item${idx === switcherIdx ? ' selected' : ''}`}
                      onClick={() => {
                        setSwitcherOpen(false);
                        openFile(item.path);
                      }}
                    >
                      <div className="switcher-row-top">
                        <span className="switcher-path">{item.path}</span>
                        {item.mtimeMs > 0 && <span className="switcher-time">{fmtTime(item.mtimeMs)}</span>}
                      </div>
                      {item.snippet && <span className="switcher-snippet">{item.snippet}</span>}
                    </button>
                  );
                })}
              </React.Fragment>
            ));
          })()}
          {isLargeVault && pagedFiles.hasMore && (
            <button className="btn" style={{ margin: '8px auto', display: 'block' }} onClick={loadMorePagedFiles}>
              Load more
            </button>
          )}
        </div>
        <div className="switcher-input-wrap">
          <input
            ref={switcherInputRef}
            className="switcher-input"
            type="text"
            placeholder="Find a note..."
            value={switcherQuery}
            onChange={(e) => {
              setSwitcherQuery(e.target.value);
              setSwitcherIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSwitcherIdx((i) => Math.min(i + 1, Math.max(0, switcherItems.length - 1)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSwitcherIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && switcherItems[switcherIdx]) {
                e.preventDefault();
                setSwitcherOpen(false);
                openFile(switcherItems[switcherIdx].path);
              }
            }}
          />
          <button
            className="switcher-clear"
            aria-label="Clear or close"
            onClick={() => (switcherQuery ? setSwitcherQuery('') : setSwitcherOpen(false))}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
