import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createPlaywrightVault } from './helpers/harness.js';

test('Rename edits only filename and Move uses FolderPicker', async () => {
  const env = await createPlaywrightVault({
    'README.md': '# Home\n',
    'inbox/draft.md': '# Draft\n\nHello\n',
    'archive/keep.md': '# Keep\n'
  });

  try {
    const { context, page, pageErrors } = await env.openAppPage();

    // Open context menu on draft.md -> Rename
    await page.getByRole('button', { name: 'Actions for draft.md' }).click();
    await page.getByRole('button', { name: 'Rename', exact: true }).click();

    await page.locator('.modal input[type="text"]').fill('renamed.md');
    await page.locator('.modal').getByRole('button', { name: 'Rename', exact: true }).click();

    await page.waitForFunction(() => !document.querySelector('.modal'));
    assert.equal(fs.existsSync(path.join(env.vaultDir, 'inbox/draft.md')), false);
    assert.equal(fs.existsSync(path.join(env.vaultDir, 'inbox/renamed.md')), true);

    // Open context menu on renamed.md -> Move -> pick archive folder
    await page.getByRole('button', { name: 'Actions for renamed.md' }).click();
    await page.getByRole('button', { name: 'Move', exact: true }).click();
    await page.locator('.folder-picker').getByRole('button', { name: 'archive', exact: true }).click();
    await page.locator('.modal').getByRole('button', { name: 'Move', exact: true }).click();

    await page.waitForFunction(() => !document.querySelector('.modal'));
    assert.equal(fs.existsSync(path.join(env.vaultDir, 'inbox/renamed.md')), false);
    assert.equal(fs.existsSync(path.join(env.vaultDir, 'archive/renamed.md')), true);
    assert.equal(pageErrors.length, 0);

    await context.close();
  } finally {
    await env.cleanup();
  }
});
