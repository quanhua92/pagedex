import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlaywrightVault } from './helpers/harness.js';

test('Wikilinks navigate notes and desktop tabs switch and close cleanly to New tab', async () => {
  const env = await createPlaywrightVault({
    'README.md': '# Home\n\nSee [[guides/setup]] for details.\n',
    'guides/setup.md': '# Setup Guide\n\nStep 1: Ready\n',
    'notes/extra.md': '# Extra Note\n\nSecond tab content\n'
  });

  try {
    const { context, page, pageErrors } = await env.openAppPage();

    // Open README.md and follow [[guides/setup]] wikilink
    await page.getByRole('button', { name: 'README.md', exact: true }).click();
    await page.locator('.doc').getByRole('heading', { name: 'Home' }).waitFor();
    await page.locator('.doc a', { hasText: 'guides/setup' }).click();
    await page.locator('.doc').getByRole('heading', { name: 'Setup Guide' }).waitFor();

    // Open notes/extra.md in a new tab via row 3-dot menu
    await page.getByRole('button', { name: 'Actions for extra.md' }).click();
    await page.getByRole('button', { name: 'Open in new tab', exact: true }).click();
    await page.locator('.doc').getByRole('heading', { name: 'Extra Note' }).waitFor();

    const tabs = page.locator('.desktop-tab');
    assert.equal(await tabs.count(), 2);

    // Switch back to first tab (setup)
    await tabs.nth(0).click();
    await page.locator('.doc').getByRole('heading', { name: 'Setup Guide' }).waitFor();

    // Close second tab, then close last tab -> returns to New tab (does not auto-open README)
    await tabs.nth(1).locator('.desktop-tab-close').click();
    assert.equal(await tabs.count(), 1);

    await tabs.nth(0).locator('.desktop-tab-close').click();
    await page.locator('.new-tab-view').waitFor();
    assert.equal(await page.locator('.doc').count(), 0);
    assert.equal(pageErrors.length, 0);

    await context.close();
  } finally {
    await env.cleanup();
  }
});
