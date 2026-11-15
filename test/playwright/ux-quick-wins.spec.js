import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlaywrightVault } from './helpers/harness.js';

test('UX quick wins: sidebar + button, right-click menu + toast, keyboard shortcuts', async () => {
  const env = await createPlaywrightVault({
    'notes/alpha.md': '# Alpha\n\nBody text\n'
  });

  try {
    const { context, page, pageErrors } = await env.openAppPage();

    // 1. Sidebar '+' New note button opens modal
    await page.locator('.sidebar-new-btn').click();
    await page.locator('.modal').waitFor();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForFunction(() => !document.querySelector('.modal'));

    // 2. Right-click on tree row opens context menu & Pin shows toast
    await page.getByRole('button', { name: 'alpha.md', exact: true }).click({ button: 'right' });
    await page.locator('.file-ctx-menu').waitFor();
    await page.locator('.file-ctx-menu').getByRole('button', { name: 'Pin', exact: true }).click();
    assert.equal(await page.locator('.toast').textContent(), 'Pinned alpha.md');

    // 3. Open note and toggle Edit/Preview with Ctrl+E, toggle sidebar with Ctrl+\
    await page.getByRole('button', { name: 'alpha.md', exact: true }).first().click();
    await page.locator('.doc').getByRole('heading', { name: 'Alpha' }).waitFor();

    await page.keyboard.press('Control+e');
    await page.locator('.tiptap-body .ProseMirror').waitFor();

    await page.keyboard.press('Control+e');
    await page.locator('.doc').getByRole('heading', { name: 'Alpha' }).waitFor();

    await page.keyboard.press('Control+\\');
    assert.equal(await page.locator('.app.sidebar-collapsed').count(), 1);
    await page.keyboard.press('Control+\\');
    assert.equal(await page.locator('.app.sidebar-collapsed').count(), 0);

    assert.equal(pageErrors.length, 0);
    await context.close();
  } finally {
    await env.cleanup();
  }
});
