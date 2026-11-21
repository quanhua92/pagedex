import React, { useMemo } from 'react';
import { Notebook } from '@jupyter-kit/react';
import { python } from '@jupyter-kit/core/langs/python';
import { createKatexPlugin } from '@jupyter-kit/katex';
import '@jupyter-kit/theme-default/default.css';
import '@jupyter-kit/theme-default/syntax/one-dark.css';

const LANGUAGES = [python];
const PLUGINS = [createKatexPlugin()];

/**
 * Off-the-shelf read-only Jupyter/IPython (.ipynb) notebook viewer.
 */
export default function NotebookViewer({ content, settings }) {
  const parsed = useMemo(() => {
    if (!content) return { ok: false, error: 'Empty notebook file.' };
    try {
      const ipynb = JSON.parse(content);
      if (!ipynb || typeof ipynb !== 'object' || !Array.isArray(ipynb.cells)) {
        return { ok: false, error: 'Not a valid Jupyter notebook (missing cells array).' };
      }
      const language =
        ipynb.metadata?.kernelspec?.language ||
        ipynb.metadata?.language_info?.name ||
        'python';
      return { ok: true, ipynb, language };
    } catch (err) {
      return { ok: false, error: `Invalid notebook JSON: ${err?.message || 'parse error'}` };
    }
  }, [content]);

  if (!parsed.ok) {
    return (
      <div
        className="nb-wrap"
        style={{
          fontSize: `${settings.fontSize}px`,
          maxWidth: `${settings.maxWidth + 80}px`
        }}
      >
        <div className="nb-error-banner">{parsed.error}</div>
        <pre className="raw-view">{content}</pre>
      </div>
    );
  }

  return (
    <div
      className="nb-wrap"
      style={{
        fontSize: `${settings.fontSize}px`,
        maxWidth: `${settings.maxWidth + 80}px`
      }}
    >
      <Notebook
        ipynb={parsed.ipynb}
        language={parsed.language}
        languages={LANGUAGES}
        plugins={PLUGINS}
      />
    </div>
  );
}
