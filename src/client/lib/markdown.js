import { marked } from 'marked';
import hljs from 'highlight.js/lib/common';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import { resolveRelative, resolveWikiTarget } from './paths.js';

hljs.registerLanguage('dockerfile', dockerfile);

export const EXT_TO_LANG = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', pyw: 'python',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  json: 'json', jsonc: 'json',
  yml: 'yaml', yaml: 'yaml',
  css: 'css', scss: 'scss', less: 'less',
  html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml',
  md: 'markdown', markdown: 'markdown',
  sql: 'sql', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin',
  c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cc: 'cpp',
  toml: 'ini', ini: 'ini', conf: 'ini', env: 'ini',
  diff: 'diff', patch: 'diff',
  rb: 'ruby', php: 'php', swift: 'swift',
  makefile: 'makefile', dockerfile: 'dockerfile'
};

export function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlightCode(code, lang) {
  const text = String(code ?? '');
  try {
    const cleanLang = (lang || '').trim().toLowerCase();
    if (cleanLang && hljs.getLanguage(cleanLang)) {
      return hljs.highlight(text, { language: cleanLang, ignoreIllegals: true }).value;
    }
    if (text.length <= 150000) {
      return hljs.highlightAuto(text).value;
    }
  } catch {
    // Fallback to plain escaped text
  }
  return escapeHtml(text);
}

export function renderMarkdownWithLinks(content, activePath, flatFiles) {
  const foundHeadings = [];
  // Pre-process [[wikilinks]] outside fenced code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);
  const transformed = parts
    .map((part, idx) => {
      if (idx % 2 === 1) return part;
      return part.replace(/\[\[([^\]]+)\]\]/g, (_, inner) => {
        const [targetRaw, alias] = inner.split('|');
        const label = (alias || targetRaw).trim();
        const target = resolveWikiTarget(inner, flatFiles);
        if (target) {
          return `<a class="wikilink" data-path="${target.replace(/"/g, '&quot;')}">${label}</a>`;
        }
        return `<span class="wikilink broken" title="Note not created yet">${label}</span>`;
      });
    })
    .join('');

  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const text = renderer.parser.parseInline(tokens);
    const plain = text.replace(/<[^>]+>/g, '');
    const id = plain.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    foundHeadings.push({ level: depth, text: plain, id });
    return `<h${depth} id="${id}">${text}</h${depth}>`;
  };
  renderer.image = ({ href, title, text }) => {
    const src = /^https?:\/\//.test(href)
      ? href
      : `/api/v1/file?path=${encodeURIComponent(resolveRelative(activePath, href))}`;
    return `<img src="${src}" alt="${text || ''}"${title ? ` title="${title}"` : ''} />`;
  };
  renderer.link = ({ href, title, tokens }) => {
    const text = renderer.parser.parseInline(tokens);
    if (/^https?:\/\//.test(href)) {
      return `<a href="${href}" target="_blank" rel="noreferrer"${title ? ` title="${title}"` : ''}>${text}</a>`;
    }
    return `<a class="md-rel-link" data-href="${href.replace(/"/g, '&quot;')}">${text}</a>`;
  };
  renderer.code = ({ text, lang }) => {
    const highlighted = highlightCode(text, lang);
    const cls = lang ? `hljs language-${escapeHtml(lang.trim())}` : 'hljs';
    return `<pre><code class="${cls}">${highlighted}</code></pre>`;
  };

  const html = marked.parse(transformed, { renderer, gfm: true, breaks: false });
  return { renderedHtml: html, headings: foundHeadings };
}

export function highlightRawFile(content, activePath) {
  if (!content) return '';
  const base = activePath.split('/').pop().toLowerCase();
  const ext = base.includes('.') ? base.split('.').pop() : base;
  const lang = EXT_TO_LANG[ext] || EXT_TO_LANG[base] || '';
  return highlightCode(content, lang);
}
