import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlaywrightVault } from './helpers/harness.js';

test('Pinned section supports pinning folders and files, collapsing, opening, and unpinning', async () => {
  const env = await createPlaywrightVault({
    'README.md': '# Home\n\nWelcome home\n',
    'inbox/draft.md': '# Draft\n\nInside inbox\n'
  });

  try {
    const { context, page, pageErrors } = await env.openAppPage();

    assert.equal(await page.locator('.pinned-section').count(), 0);

    // Pin folder `inbox` via its 3-dot menu
    await page.getByRole('button', { name: 'Actions for folder inbox' }).click();
    await page.getByRole('button', { name: 'Pin', exact: true }).click();

    // Pin file `README.md` via its 3-dot menu
    await page.getByRole('button', { name: 'Actions for README.md' }).click();
    await page.getByRole('button', { name: 'Pin', exact: true }).click();

    const pinnedSection = page.locator('.pinned-section');
    await pinnedSection.waitFor();
    assert.equal(await pinnedSection.locator('.pinned-count').textContent(), '2');

    // Collapse and re-expand Pinned section
    await pinnedSection.locator('.pinned-toggle').click();
    assert.equal(await pinnedSection.locator('.pinned-list').count(), 0);
    await pinnedSection.locator('.pinned-toggle').click();
    await pinnedSection.locator('.pinned-list').waitFor();

    // Collapse then expand pinned folder `inbox` inside Pinned list
    const pinnedList = pinnedSection.locator('.pinned-list');
    await pinnedList.getByRole('button', { name: 'draft.md', exact: true }).waitFor();
    await pinnedList.locator('.tree-dir-btn', { hasText: 'inbox' }).click();
    assert.equal(await pinnedList.getByRole('button', { name: 'draft.md', exact: true }).count(), 0);
    await pinnedList.locator('.tree-dir-btn', { hasText: 'inbox' }).click();
    await pinnedList.getByRole('button', { name: 'draft.md', exact: true }).waitFor();

    // Open pinned file `README.md`
    await pinnedList.getByRole('button', { name: 'README.md', exact: true }).click();
    await page.locator('.doc').getByRole('heading', { name: 'Home' }).waitFor();

    // Unpin `README.md` from its 3-dot menu inside Pinned
    await pinnedList.getByRole('button', { name: 'Actions for README.md' }).click();
    await page.getByRole('button', { name: 'Unpin', exact: true }).click();
    assert.equal(await pinnedSection.locator('.pinned-count').textContent(), '1');

    // Unpin `inbox` and verify Pinned section disappears
    await pinnedList.getByRole('button', { name: 'Actions for folder inbox' }).click();
    await page.getByRole('button', { name: 'Unpin', exact: true }).click();
    assert.equal(await page.locator('.pinned-section').count(), 0);

    assert.equal(pageErrors.length, 0);
    await context.close();
  } finally {
    await env.cleanup();
  }
});
