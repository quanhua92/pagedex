import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createPlaywrightVault } from './helpers/harness.js';

test('Deleting active note resets to New tab and Quick Switcher opens nested files', async () => {
  const env = await createPlaywrightVault({
    'README.md': '# Home\n',
    'inbox/temp.md': '# Temp Note\n\nDelete me\n',
    'archive/keep.md': '# Keep\n\nNested target\n'
  });

  try {
    const { context, page, pageErrors } = await env.openAppPage();

    // Open inbox/temp.md then delete it via 3-dot menu
    await page.getByRole('button', { name: 'temp.md', exact: true }).click();
    await page.locator('.doc').getByRole('heading', { name: 'Temp Note' }).waitFor();

    await page.getByRole('button', { name: 'Actions for temp.md' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.locator('.modal').getByRole('button', { name: 'Delete', exact: true }).click();

    await page.waitForFunction(() => !document.querySelector('.modal'));
    assert.equal(fs.existsSync(path.join(env.vaultDir, 'inbox/temp.md')), false);

    // Should reset to New tab rather than auto-opening README.md
    await page.locator('.new-tab-view').waitFor();
    assert.equal(await page.locator('.doc').count(), 0);

    // Use Quick Switcher from New tab to open archive/keep.md
    await page.locator('.new-tab-view').getByRole('button', { name: 'Go to file' }).click();
    const switcherInput = page.locator('.switcher-input');
    await switcherInput.waitFor();
    await switcherInput.fill('keep');
    await page.locator('.switcher-item', { hasText: 'keep.md' }).first().click();

    await page.locator('.doc').getByRole('heading', { name: 'Keep' }).waitFor();
    assert.equal(pageErrors.length, 0);

    await context.close();
  } finally {
    await env.cleanup();
  }
});
