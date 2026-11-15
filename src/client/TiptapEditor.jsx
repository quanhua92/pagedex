import React, { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';

export default function TiptapEditor({ content, fileKey, fontSize, lineHeight, maxWidth, saving, dirty, onChange, onSave }) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
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
        <button
          className={`btn${dirty ? ' primary' : ''}`}
          style={{ marginLeft: 'auto' }}
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
