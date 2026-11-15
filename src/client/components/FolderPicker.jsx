import React, { useMemo, useState } from 'react';

export default function FolderPicker({
  value,
  onChange,
  allFolders,
  excludePrefix = '',
  allowCreate = false,
  defaultExpanded = false,
  onEnter
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [filterText, setFilterText] = useState('');

  const availableFolders = useMemo(() => {
    const cleanExclude = excludePrefix.trim().replace(/^\/+|\/+$/g, '');
    return allFolders.filter((f) => {
      if (!cleanExclude) return true;
      return f !== cleanExclude && !f.startsWith(`${cleanExclude}/`);
    });
  }, [allFolders, excludePrefix]);

  const cleanFilter = filterText.trim().replace(/^\/+|\/+$/g, '');
  const query = cleanFilter.toLowerCase();
  const visibleFolders = useMemo(() => {
    if (!query) return availableFolders;
    return availableFolders.filter((f) => (f || '/ (vault root)').toLowerCase().includes(query));
  }, [availableFolders, query]);

  const normalizedValue = (value || '').trim().replace(/^\/+|\/+$/g, '');
  const canCreateCustom =
    allowCreate && cleanFilter && !availableFolders.some((f) => f.toLowerCase() === query);

  function selectFolder(folder) {
    onChange(folder);
    setFilterText('');
    setExpanded(false);
  }

  return (
    <div className="folder-picker-wrap">
      <button
        type="button"
        className="folder-picker-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="folder-picker-value">{normalizedValue || '/ (vault root)'}</span>
        <span className="folder-picker-caret">{expanded ? '▴' : '▾'}</span>
      </button>

      {expanded && (
        <div className="folder-picker-panel">
          <input
            type="text"
            placeholder={allowCreate ? 'Filter or type new folder...' : 'Filter folders...'}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
          />
          <div className="folder-picker">
            {visibleFolders.map((f) => {
              const active = normalizedValue === f;
              return (
                <button
                  key={f || '__root__'}
                  type="button"
                  className={`folder-pick-item${active ? ' active' : ''}`}
                  onClick={() => selectFolder(f)}
                >
                  {f ? f : '/ (vault root)'}
                </button>
              );
            })}
            {canCreateCustom && (
              <button
                type="button"
                className="folder-pick-item"
                onClick={() => selectFolder(cleanFilter)}
              >
                + Use "{cleanFilter}"
              </button>
            )}
            {visibleFolders.length === 0 && !canCreateCustom && (
              <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--muted)' }}>
                No matching folders
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
