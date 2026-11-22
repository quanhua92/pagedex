import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlaywrightVault } from './helpers/harness.js';

test('Split-pane layout: single-pane default, split right/down, active pane focus, and close pane', async () => {
  const env = await createPlaywrightVault({
    'notes/alpha.md': '# Alpha Note\n\nAlpha body content.\n',
    'notes/beta.md': '# Beta Note\n\nBeta body content.\n',
    'notes/gamma.md': '# Gamma Note\n\nGamma body content.\n'
  });

  try {
    const { context, page, pageErrors } = await env.openAppPage();

    // 1. Single-pane default behavior: DesktopTabs at top of .main, no .multi-note-viewer wrapper
    await page.getByRole('button', { name: 'alpha.md', exact: true }).click();
    await page.locator('.doc').getByRole('heading', { name: 'Alpha Note' }).waitFor();

    assert.equal(await page.locator('.main > .desktop-tabs').count(), 1);
    assert.equal(await page.locator('.multi-note-viewer').count(), 0);
    assert.equal(await page.locator('.note-pane').count(), 1);
    assert.equal(await page.locator('.note-pane.is-split').count(), 0);

    // 2. Open ⋮ menu -> Split right -> .multi-note-viewer.split-right with two .note-pane.is-split and .split-resizer, secondary .active
    await page.getByRole('button', { name: 'Note options' }).click();
    await page.getByRole('button', { name: 'Split right', exact: true }).click();

    await page.locator('.multi-note-viewer.split-right').waitFor();
    const panes = page.locator('.note-pane.is-split');
    assert.equal(await panes.count(), 2);
    assert.equal(await page.locator('.multi-note-viewer.split-right > .split-resizer').count(), 1);

    const primaryPane = panes.nth(0);
    const secondaryPane = panes.nth(1);
    await page.waitForFunction(() => {
      const all = document.querySelectorAll('.note-pane.is-split');
      return all.length === 2 && !all[0].classList.contains('active') && all[1].classList.contains('active');
    });

    // Open beta.md from Sidebar while secondary pane is active -> loads in secondary, primary keeps Alpha Note
    await page.getByRole('button', { name: 'beta.md', exact: true }).click();
    await secondaryPane.locator('.doc').getByRole('heading', { name: 'Beta Note' }).waitFor();
    assert.equal(await primaryPane.locator('.doc').getByRole('heading', { name: 'Alpha Note' }).count(), 1);

    // 3. Click primary pane to activate it -> .active moves to primary; opening gamma.md from Sidebar updates primary without clobbering secondary
    await primaryPane.click();
    await page.waitForFunction(() => {
      const all = document.querySelectorAll('.note-pane.is-split');
      return all.length === 2 && all[0].classList.contains('active') && !all[1].classList.contains('active');
    });

    await page.getByRole('button', { name: 'gamma.md', exact: true }).click();
    await primaryPane.locator('.doc').getByRole('heading', { name: 'Gamma Note' }).waitFor();
    assert.equal(await secondaryPane.locator('.doc').getByRole('heading', { name: 'Beta Note' }).count(), 1);

    // 4. Switch to Split down -> .multi-note-viewer.split-down
    await primaryPane.getByRole('button', { name: 'Note options' }).click();
    await page.getByRole('button', { name: 'Split down', exact: true }).click();

    await page.locator('.multi-note-viewer.split-down').waitFor();
    assert.equal(await page.locator('.multi-note-viewer.split-down > .split-resizer').count(), 1);
    assert.equal(await panes.count(), 2);

    // 5. Click Close pane in ⋮ menu -> returns cleanly to single-pane mode
    await secondaryPane.getByRole('button', { name: 'Note options' }).click();
    await page.getByRole('button', { name: 'Close pane', exact: true }).click();

    await page.waitForFunction(() => !document.querySelector('.multi-note-viewer'));
    assert.equal(await page.locator('.main > .desktop-tabs').count(), 1);
    assert.equal(await page.locator('.note-pane').count(), 1);
    assert.equal(await page.locator('.note-pane.is-split').count(), 0);
    await page.locator('.doc').getByRole('heading', { name: 'Gamma Note' }).waitFor();

    assert.equal(pageErrors.length, 0);
    await context.close();
  } finally {
    await env.cleanup();
  }
});
