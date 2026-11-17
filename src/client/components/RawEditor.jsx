import React, { useEffect, useRef } from 'react';

export default function RawEditor({
  value,
  fontSize,
  lineHeight,
  maxWidth,
  saving,
  dirty,
  onChange,
  onSave
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 420)}px`;
  }, [value]);

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      onSave(value);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = `${value.slice(0, start)}  ${value.slice(end)}`;
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = start + 2;
        el.selectionEnd = start + 2;
      });
    }
  }

  return (
    <div className="raw-editor-wrap" style={{ maxWidth: `${maxWidth + 80}px` }}>
      <div className="tiptap-toolbar">
        <span className="raw-editor-label">Raw Markdown</span>
        <button
          type="button"
          className={`btn${dirty ? ' primary' : ''}`}
          style={{ marginLeft: 'auto' }}
          disabled={saving}
          onClick={() => onSave(value)}
        >
          {saving ? 'Saving...' : dirty ? 'Save *' : 'Saved'}
        </button>
      </div>
      <textarea
        ref={textareaRef}
        className="raw-textarea"
        aria-label="Raw Markdown editor"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          fontSize: `${Math.max(12, fontSize - 2)}px`,
          lineHeight
        }}
      />
    </div>
  );
}
