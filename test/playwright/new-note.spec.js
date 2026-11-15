import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createPlaywrightVault } from './helpers/harness.js';

test('New note dialog opens in editor from empty state and from blank New tab', async () => {
  const env = await createPlaywrightVault({
    'notes/existing.md': '# Existing\n\nBody\n'
  });

  try {
    const { context, page, pageErrors } = await env.openAppPage();

    // 1. No README.md -> starts on New tab actions; create first note
    await page.getByRole('button', { name: 'Create new note' }).click();
    await page.getByPlaceholder('My note title').fill('first-note');
    await page.getByRole('button', { name: 'Create note', exact: true }).click();

    await page.locator('.doc h1').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => location.hash), '#first-note.md');
    assert.match(await page.locator('.doc').textContent(), /first-note/);
    assert.ok(fs.existsSync(path.join(env.vaultDir, 'first-note.md')));

    // 2. Open a blank New tab (+), then create another note in a folder
    await page.locator('button[title="New tab"]').first().click();
    await page.getByRole('button', { name: 'Create new note' }).click();
    await page.getByPlaceholder('My note title').fill('second-note');
    await page.locator('.folder-picker-toggle').click();
    await page.getByRole('button', { name: 'notes', exact: true }).click();
    await page.getByRole('button', { name: 'Create note', exact: true }).click();

    await page.waitForFunction(() => location.hash === '#notes%2Fsecond-note.md');
    assert.match(await page.locator('.doc').textContent(), /second-note/);
    assert.ok(fs.existsSync(path.join(env.vaultDir, 'notes/second-note.md')));

    // 3. Switch to Edit mode from top-right menu and verify Tiptap renders
    await page.getByRole('button', { name: 'Note options' }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.locator('.ProseMirror').waitFor({ state: 'visible' });
    assert.match(await page.locator('.ProseMirror').textContent(), /second-note/);
    assert.equal(pageErrors.length, 0);

    await context.close();
  } finally {
    await env.cleanup();
  }
});
