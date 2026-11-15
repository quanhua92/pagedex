import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createPlaywrightVault } from './helpers/harness.js';

test('Edit mode renders existing content, saves edits to disk, and round-trips to Preview', async () => {
  const env = await createPlaywrightVault({
    'notes/hello.md': '# Hello Note\n\nInitial body\n'
  });

  try {
    const { context, page, pageErrors } = await env.openAppPage();

    await page.getByRole('button', { name: 'hello.md', exact: true }).click();
    await page.locator('.doc').getByRole('heading', { name: 'Hello Note' }).waitFor();

    // Switch to Edit mode via Note options
    await page.getByRole('button', { name: 'Note options' }).click();
    await page.locator('.more-menu').getByRole('button', { name: 'Edit' }).click();

    const editor = page.locator('.tiptap-body .ProseMirror');
    await editor.waitFor();
    await page.waitForFunction(
      () => document.querySelector('.tiptap-body .ProseMirror')?.textContent?.includes('Initial body')
    );

    // Append text and save
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Appended line');

    const saveBtn = page.locator('.tiptap-toolbar').getByRole('button', { name: 'Save *' });
    await saveBtn.waitFor();
    await saveBtn.click();
    await page.locator('.tiptap-toolbar').getByRole('button', { name: 'Saved' }).waitFor();

    // Switch back to Preview and verify content + disk persistence
    await page.getByRole('button', { name: 'Note options' }).click();
    await page.locator('.more-menu').getByRole('button', { name: 'Preview' }).click();
    await page.locator('.doc').getByText('Appended line').waitFor();

    const diskContent = fs.readFileSync(path.join(env.vaultDir, 'notes/hello.md'), 'utf8');
    assert.match(diskContent, /Appended line/);
    assert.equal(pageErrors.length, 0);

    await context.close();
  } finally {
    await env.cleanup();
  }
});
