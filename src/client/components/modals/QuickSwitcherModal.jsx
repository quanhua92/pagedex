import React, { useMemo } from 'react';

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
  openInNewTab,
  switchTab,
  tabCount = 0,
  isLargeVault,
  pagedFiles,
  loadMorePagedFiles,
  switcherQuery,
  setSwitcherQuery,
  commands = []
}) {
  const isCommandMode = switcherTab === 'commands' || switcherQuery.trimStart().startsWith('>');

  const filteredCommands = useMemo(() => {
    if (!isCommandMode) return [];
    const q = switcherQuery.trimStart().replace(/^>\s*/, '').trim().toLowerCase();
    return commands.filter(
      (cmd) =>
        !q ||
        cmd.label.toLowerCase().includes(q) ||
        (cmd.hint && cmd.hint.toLowerCase().includes(q))
    );
  }, [isCommandMode, switcherQuery, commands]);

  if (!switcherOpen) return null;

  const activeItemsCount = isCommandMode ? filteredCommands.length : switcherItems.length;

  const runCommand = (cmd) => {
    setSwitcherOpen(false);
    cmd.run();
  };

  return (
    <div className="switcher-backdrop" onClick={() => setSwitcherOpen(false)}>
      <div className="switcher" onClick={(e) => e.stopPropagation()}>
        <div className="switcher-head">
          <div className="switcher-tabs">
            {[
              ['recent', 'Recent'],
              ['alpha', 'A–Z'],
              ['tabs', `Open Tabs (${tabCount})`],
              ['commands', 'Commands']
            ].map(([id, label]) => {
              const active = id === 'commands' ? isCommandMode : !isCommandMode && switcherTab === id;
              return (
                <button
                  key={id}
                  className={`switcher-tab${active ? ' active' : ''}`}
                  onClick={() => {
                    if (id !== 'commands' && switcherQuery.trimStart().startsWith('>')) {
                      setSwitcherQuery('');
                    }
                    setSwitcherTab(id);
                    setSwitcherIdx(0);
                    switcherInputRef.current?.focus();
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {!isCommandMode && totalFiles > fileStats.length && (
            <span className="switcher-cap">
              {fileStats.length.toLocaleString()} / {totalFiles.toLocaleString()} indexed
            </span>
          )}
        </div>
        <div className="switcher-list">
          {isCommandMode ? (
            filteredCommands.length === 0 ? (
              <div className="empty-note" style={{ padding: '12px' }}>No matching commands</div>
            ) : (
              filteredCommands.map((cmd, idx) => (
                <button
                  key={cmd.id}
                  className={`switcher-item${idx === switcherIdx ? ' selected' : ''}`}
                  onClick={() => runCommand(cmd)}
                >
                  <div className="switcher-row-top">
                    <span className="switcher-path">{cmd.label}</span>
                    {cmd.hint && <span className="switcher-time">{cmd.hint}</span>}
                  </div>
                </button>
              ))
            )
          ) : switcherItems.length === 0 ? (
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
                      key={item.tabId || item.path}
                      className={`switcher-item${idx === switcherIdx ? ' selected' : ''}`}
                      onClick={() => {
                        setSwitcherOpen(false);
                        if (item.tab && switchTab) switchTab(item.tab);
                        else (openInNewTab || openFile)(item.path);
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
          {!isCommandMode && switcherTab !== 'tabs' && isLargeVault && pagedFiles.hasMore && (
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
            placeholder="Find a note or type > for commands..."
            value={switcherQuery}
            onChange={(e) => {
              setSwitcherQuery(e.target.value);
              setSwitcherIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSwitcherIdx((i) => Math.min(i + 1, Math.max(0, activeItemsCount - 1)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSwitcherIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                if (isCommandMode && filteredCommands[switcherIdx]) {
                  e.preventDefault();
                  runCommand(filteredCommands[switcherIdx]);
                } else if (!isCommandMode && switcherItems[switcherIdx]) {
                  e.preventDefault();
                  setSwitcherOpen(false);
                  const selected = switcherItems[switcherIdx];
                  if (selected.tab && switchTab) switchTab(selected.tab);
                  else (openInNewTab || openFile)(selected.path);
                }
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
