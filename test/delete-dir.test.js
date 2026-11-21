import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('deleteDir removes empty and non-empty directories while guarding root and protected paths', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pagedex-deldir-'));
  process.env.PAGEDEX_ROOT = tmpRoot;

  try {
    const { deleteDir, createDir, writeNote } = await import('../src/server/fs-ops.js');

    // Create empty folder and delete it
    createDir('empty-dir');
    assert.equal(fs.existsSync(path.join(tmpRoot, 'empty-dir')), true);
    const emptyRes = deleteDir('empty-dir');
    assert.deepEqual(emptyRes, { deleted: true, path: 'empty-dir' });
    assert.equal(fs.existsSync(path.join(tmpRoot, 'empty-dir')), false);

    // Create non-empty folder with nested file and delete it
    writeNote('nested/sub/note.md', '# Hello');
    assert.equal(fs.existsSync(path.join(tmpRoot, 'nested/sub/note.md')), true);
    const nonEmptyRes = deleteDir('nested');
    assert.deepEqual(nonEmptyRes, { deleted: true, path: 'nested' });
    assert.equal(fs.existsSync(path.join(tmpRoot, 'nested')), false);

    // Reject root, empty, missing, and protected paths
    assert.equal(deleteDir(''), null);
    assert.equal(deleteDir('/'), null);
    assert.equal(deleteDir('.git'), null);
    assert.equal(deleteDir('does-not-exist'), null);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
