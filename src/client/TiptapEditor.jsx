import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';

const CODE_LANGUAGES = [
  'mermaid',
  'bash',
  'python',
  'javascript',
  'typescript',
  'json',
  'yaml',
  'sql',
  'html',
  'css',
  'go',
  'rust',
  'markdown'
];

function getCleanMarkdown(editor) {
  const raw = editor?.storage?.markdown?.getMarkdown?.() ?? '';
  return raw.replace(/\\\[\\\[([^\]\n]+)\\\]\\\]/g, '[[$1]]');
}

function CodeBlockNodeView({ node, updateAttributes }) {
  const currentLang = node.attrs.language || '';
  const isKnown = currentLang === '' || CODE_LANGUAGES.includes(currentLang);
  const [customOpen, setCustomOpen] = useState(!isKnown);

  useEffect(() => {
    if (!isKnown) setCustomOpen(true);
  }, [isKnown]);

  const selectValue = customOpen || !isKnown ? '__other__' : currentLang;

  return (
    <NodeViewWrapper className="tiptap-codeblock">
      <div className="tiptap-codeblock-lang" contentEditable={false}>
        {(customOpen || !isKnown) && (
          <input
            type="text"
            className="tiptap-lang-input"
            aria-label="Custom code block language"
            placeholder="e.g. rust"
            autoFocus
            value={currentLang}
            onChange={(e) => updateAttributes({ language: e.target.value })}
          />
        )}
        <select
          className="tiptap-lang-select"
          aria-label="Code block language"
          value={selectValue}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '__other__') {
              setCustomOpen(true);
            } else {
              setCustomOpen(false);
              updateAttributes({ language: val });
            }
          }}
        >
          <option value="">plain</option>
          {CODE_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
          <option value="__other__">Other...</option>
        </select>
      </div>
      <pre>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

const CodeBlockStarterKit = StarterKit.extend({
  addExtensions() {
    return (this.parent?.() ?? []).map((ext) =>
      ext.name === 'codeBlock'
        ? ext.extend({
            addNodeView() {
              return ReactNodeViewRenderer(CodeBlockNodeView);
            }
          })
        : ext
    );
  }
});

export default function TiptapEditor({
  content,
  fileKey,
  flatFiles = [],
  fontSize,
  lineHeight,
  maxWidth,
  saving,
  dirty,
  onChange,
  onSave,
  onSwitchToRaw
}) {
  const [wikiSuggest, setWikiSuggest] = useState(null); // { query, from, to, left, top }
  const [wikiIdx, setWikiIdx] = useState(0);
  const wikiStateRef = useRef({ suggest: null, matches: [], idx: 0 });

  const wikiMatches = useMemo(() => {
    if (!wikiSuggest) return [];
    const q = wikiSuggest.query.trim().toLowerCase();
    const scored = flatFiles
      .filter((f) => !q || f.toLowerCase().includes(q))
      .sort((a, b) => {
        const aBase = a.split('/').pop().toLowerCase();
        const bBase = b.split('/').pop().toLowerCase();
        const aStarts = q && aBase.startsWith(q) ? 0 : 1;
        const bStarts = q && bBase.startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        const aMd = /\.md$/i.test(a) ? 0 : 1;
        const bMd = /\.md$/i.test(b) ? 0 : 1;
        return aMd - bMd || a.localeCompare(b);
      });
    return scored.slice(0, 12);
  }, [wikiSuggest, flatFiles]);

  const editor = useEditor({
    extensions: [CodeBlockStarterKit, Markdown],
    content,
    editorProps: {
      handleKeyDown: (_view, event) => {
        const { suggest, matches, idx } = wikiStateRef.current;
        if (!suggest || matches.length === 0) return false;
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setWikiIdx((i) => (i + 1) % matches.length);
          return true;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setWikiIdx((i) => (i - 1 + matches.length) % matches.length);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          const chosen = matches[idx] || matches[0];
          if (chosen) insertWikiLink(chosen);
          return true;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setWikiSuggest(null);
          return true;
        }
        return false;
      }
    }
  });

  wikiStateRef.current = { suggest: wikiSuggest, matches: wikiMatches, idx: wikiIdx };

  function insertWikiLink(targetPath) {
    const suggest = wikiStateRef.current.suggest;
    if (!editor || !suggest) return;
    const after = editor.state.doc.textBetween(suggest.to, Math.min(editor.state.doc.content.size, suggest.to + 2), '');
    const replaceTo = after === ']]' ? suggest.to + 2 : suggest.to;
    editor
      .chain()
      .focus()
      .insertContentAt({ from: suggest.from, to: replaceTo }, `[[${targetPath}]]`)
      .run();
    setWikiSuggest(null);
    setWikiIdx(0);
  }

  useEffect(() => {
    if (!editor) return;
    const current = getCleanMarkdown(editor);
    if (current !== content && !dirty) {
      editor.commands.setContent(content);
      setWikiSuggest(null);
    }
  }, [fileKey, content, editor, dirty]);

  useEffect(() => {
    if (!editor) return;
    const updateSuggest = () => {
      const { selection } = editor.state;
      if (!selection.empty || selection.$from.parent.type.name === 'codeBlock') {
        setWikiSuggest(null);
        return;
      }
      const { $from } = selection;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '\ufffc');
      const match = textBefore.match(/\[\[([^\]\n]*)$/);
      if (!match) {
        setWikiSuggest(null);
        return;
      }
      const coords = editor.view.coordsAtPos($from.pos);
      const left = Math.max(8, Math.min(coords.left, window.innerWidth - 290));
      const top = Math.min(coords.bottom + 6, window.innerHeight - 240);
      setWikiSuggest({
        query: match[1],
        from: $from.pos - match[0].length,
        to: $from.pos,
        left,
        top
      });
      setWikiIdx(0);
    };

    const onUpdate = () => {
      onChange(getCleanMarkdown(editor));
      updateSuggest();
    };
    editor.on('update', onUpdate);
    editor.on('selectionUpdate', updateSuggest);
    return () => {
      editor.off('update', onUpdate);
      editor.off('selectionUpdate', updateSuggest);
    };
  }, [editor, onChange]);

  useEffect(() => {
    if (!editor) return;
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!saving) {
          onSave(getCleanMarkdown(editor));
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editor, onSave, saving]);

  if (!editor) return null;

  return (
    <div className="tiptap-wrap" style={{ maxWidth: `${maxWidth}px` }}>
      <div className="tiptap-toolbar">
        <button
          className={`btn${editor.isActive('bold') ? ' active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </button>
        <button
          className={`btn${editor.isActive('italic') ? ' active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </button>
        <button
          className={`btn${editor.isActive('heading', { level: 1 }) ? ' active' : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </button>
        <button
          className={`btn${editor.isActive('heading', { level: 2 }) ? ' active' : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
        <button
          className={`btn${editor.isActive('bulletList') ? ' active' : ''}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          List
        </button>
        <button
          className={`btn${editor.isActive('codeBlock') ? ' active' : ''}`}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          Code
        </button>
        {onSwitchToRaw && (
          <button
            type="button"
            className="btn"
            style={{ marginLeft: 'auto' }}
            title="Switch to Raw Markdown"
            onClick={onSwitchToRaw}
          >
            Raw
          </button>
        )}
        <button
          className={`btn${dirty ? ' primary' : ''}`}
          style={onSwitchToRaw ? undefined : { marginLeft: 'auto' }}
          disabled={saving}
          onClick={() => onSave(getCleanMarkdown(editor))}
        >
          {saving ? 'Saving...' : dirty ? 'Save *' : 'Saved'}
        </button>
      </div>
      <div className="doc tiptap-body" style={{ fontSize: `${fontSize}px`, lineHeight }}>
        <EditorContent editor={editor} />
      </div>
      {wikiSuggest && wikiMatches.length > 0 && (
        <div
          className="tiptap-wiki-menu"
          style={{ left: wikiSuggest.left, top: wikiSuggest.top }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {wikiMatches.map((filePath, idx) => {
            const name = filePath.split('/').pop();
            const dir = filePath.includes('/') ? filePath.split('/').slice(0, -1).join('/') : '';
            return (
              <button
                key={filePath}
                type="button"
                className={`tiptap-wiki-item${idx === wikiIdx ? ' active' : ''}`}
                onClick={() => insertWikiLink(filePath)}
              >
                <span className="tiptap-wiki-name">{name}</span>
                {dir && <span className="tiptap-wiki-path">{dir}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
