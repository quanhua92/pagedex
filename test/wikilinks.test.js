import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveImageUploadTarget, resolveWikiTarget } from '../src/client/lib/paths.js';
import { renderMarkdownWithLinks } from '../src/client/lib/markdown.js';

test('resolveWikiTarget resolves .md (with or without ext) and non-md files', () => {
  const flatFiles = [
    'README.md',
    'labs/barellm/AGENTS.md',
    'labs/barellm/src/main.py',
    'labs/barellm/notebooks/01.ipynb'
  ];

  assert.equal(resolveWikiTarget('labs/barellm/AGENTS.md', flatFiles), 'labs/barellm/AGENTS.md');
  assert.equal(resolveWikiTarget('labs/barellm/AGENTS', flatFiles), 'labs/barellm/AGENTS.md');
  assert.equal(resolveWikiTarget('AGENTS', flatFiles), 'labs/barellm/AGENTS.md');
  assert.equal(resolveWikiTarget('labs/barellm/src/main.py', flatFiles), 'labs/barellm/src/main.py');
  assert.equal(resolveWikiTarget('main.py', flatFiles), 'labs/barellm/src/main.py');
  assert.equal(resolveWikiTarget('01.ipynb', flatFiles), 'labs/barellm/notebooks/01.ipynb');
  assert.equal(resolveWikiTarget('missing.py', flatFiles), null);
});

test('buildLinkIndex populates backlinks on .md and non-.md targets only from .md sources', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pagedex-wiki-'));
  process.env.PAGEDEX_ROOT = tmpRoot;

  try {
    const { writeNote } = await import('../src/server/fs-ops.js');
    const { buildLinkIndex } = await import('../src/server/vault-cache.js');

    writeNote(
      'README.md',
      'See [[labs/barellm/AGENTS.md]], [[labs/barellm/src/main.py]], and [[01.ipynb]].'
    );
    writeNote('labs/barellm/AGENTS.md', '# Agents');
    writeNote('labs/barellm/src/main.py', '# [[README.md]] should not create backlinks from .py\n');
    writeNote('labs/barellm/notebooks/01.ipynb', '{"cells": []}');

    const flatFiles = [
      'README.md',
      'labs/barellm/AGENTS.md',
      'labs/barellm/src/main.py',
      'labs/barellm/notebooks/01.ipynb'
    ];
    const { backlinks } = buildLinkIndex(flatFiles);

    assert.deepEqual(backlinks['labs/barellm/AGENTS.md'], ['README.md']);
    assert.deepEqual(backlinks['labs/barellm/src/main.py'], ['README.md']);
    assert.deepEqual(backlinks['labs/barellm/notebooks/01.ipynb'], ['README.md']);
    assert.deepEqual(backlinks['README.md'], []);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('resolveImageUploadTarget computes uploadDir and relative markdownHref for each mode', () => {
  assert.deepEqual(resolveImageUploadTarget('labs/barellm/README.md', 'shot.png', 'same'), {
    uploadDir: 'labs/barellm',
    markdownHref: 'shot.png'
  });
  assert.deepEqual(resolveImageUploadTarget('labs/barellm/README.md', 'shot.png', 'assets'), {
    uploadDir: 'labs/barellm/assets',
    markdownHref: 'assets/shot.png'
  });
  assert.deepEqual(resolveImageUploadTarget('labs/barellm/README.md', 'shot.png', 'vault-assets'), {
    uploadDir: 'assets',
    markdownHref: '../../assets/shot.png'
  });
  assert.deepEqual(resolveImageUploadTarget('README.md', 'shot.png', 'vault-assets'), {
    uploadDir: 'assets',
    markdownHref: 'assets/shot.png'
  });
});

test('renderMarkdownWithLinks renders ![[image]] embeds as <img>', () => {
  const { renderedHtml } = renderMarkdownWithLinks(
    '![[labs/barellm/diagram.png]]',
    'README.md',
    ['README.md', 'labs/barellm/diagram.png']
  );
  assert.match(renderedHtml, /<img src="\/api\/v1\/file\?path=labs%2Fbarellm%2Fdiagram\.png"/);
});
