import React, { useEffect, useState } from 'react';
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
  fontSize,
  lineHeight,
  maxWidth,
  saving,
  dirty,
  onChange,
  onSave,
  onSwitchToRaw
}) {
  const editor = useEditor({
    extensions: [CodeBlockStarterKit, Markdown],
    content
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.storage.markdown?.getMarkdown?.() ?? '';
    if (current !== content && !dirty) {
      editor.commands.setContent(content);
    }
  }, [fileKey, content, editor, dirty]);

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const md = editor.storage.markdown?.getMarkdown?.() ?? '';
      onChange(md);
    };
    editor.on('update', handler);
    return () => editor.off('update', handler);
  }, [editor, onChange]);

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
          onClick={() => onSave(editor.storage.markdown?.getMarkdown?.() ?? '')}
        >
          {saving ? 'Saving...' : dirty ? 'Save *' : 'Saved'}
        </button>
      </div>
      <div className="doc tiptap-body" style={{ fontSize: `${fontSize}px`, lineHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
