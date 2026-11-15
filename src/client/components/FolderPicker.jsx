import React, { useMemo, useState } from 'react';

export default function FolderPicker({
  value,
  onChange,
  allFolders,
  excludePrefix = '',
  allowCustom = false,
  onEnter,
  placeholder = 'Filter folders...'
}) {
  const [filterText, setFilterText] = useState('');

  const availableFolders = useMemo(() => {
    const cleanExclude = excludePrefix.trim().replace(/^\/+|\/+$/g, '');
    return allFolders.filter((f) => {
      if (!cleanExclude) return true;
      return f !== cleanExclude && !f.startsWith(`${cleanExclude}/`);
    });
  }, [allFolders, excludePrefix]);

  const query = (allowCustom ? value : filterText).trim().toLowerCase();
  const visibleFolders = useMemo(() => {
    if (!query || (allowCustom && availableFolders.includes(value.trim().replace(/^\/+|\/+$/g, '')))) {
      return availableFolders;
    }
    return availableFolders.filter((f) => (f || '/ (vault root)').toLowerCase().includes(query));
  }, [availableFolders, query, allowCustom, value]);

  const normalizedValue = (value || '').trim().replace(/^\/+|\/+$/g, '');

  return (
    <>
      <input
        type="text"
        placeholder={placeholder}
        value={allowCustom ? value : filterText}
        onChange={(e) => (allowCustom ? onChange(e.target.value) : setFilterText(e.target.value))}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      />
      <div className="folder-picker">
        {visibleFolders.length === 0 ? (
          <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--muted)' }}>
            No matching folders
          </div>
        ) : (
          visibleFolders.map((f) => {
            const active = normalizedValue === f;
            return (
              <button
                key={f || '__root__'}
                type="button"
                className={`folder-pick-item${active ? ' active' : ''}`}
                onClick={() => onChange(f)}
              >
                {f ? f : '/ (vault root)'}
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
