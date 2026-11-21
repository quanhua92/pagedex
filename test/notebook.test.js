import test from 'node:test';
import assert from 'node:assert/strict';
import { isNotebookPath, isTextEditablePath } from '../src/client/lib/paths.js';
import { Notebook } from '@jupyter-kit/react';
import { python } from '@jupyter-kit/core/langs/python';
import { createKatexPlugin } from '@jupyter-kit/katex';

test('isNotebookPath marks .ipynb as non-editable view-only', () => {
  assert.equal(isNotebookPath('analysis.ipynb'), true);
  assert.equal(isNotebookPath('dir/Demo.IPYNB'), true);
  assert.equal(isNotebookPath('notes.md'), false);
  assert.equal(isTextEditablePath('analysis.ipynb'), false);
});

test('@jupyter-kit/react and plugins resolve cleanly', () => {
  assert.ok(Notebook);
  assert.ok(python);
  assert.equal(typeof createKatexPlugin(), 'object');
});
