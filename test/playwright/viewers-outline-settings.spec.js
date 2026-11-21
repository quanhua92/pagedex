import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlaywrightVault } from './helpers/harness.js';

test('CSV table, sandboxed HTML iframe, Outline & Backlinks, and Settings API & MCP tab', async () => {
  const env = await createPlaywrightVault({
    'data/scores.csv': 'Name,Score\nAlice,95\nBob,88\n',
    'demos/widget.html': '<!doctype html><html><body><h1>Widget</h1></body></html>\n',
    'notes/target.md': '# Target\n\n## Section One\nContent here.\n',
    'notes/source.md': '# Source\n\nReferences [[notes/target]].\n'
  });

  try {
    const { context, page, pageErrors } = await env.openAppPage();

    // 1. Settings modal: check API & MCP tab + theme switch from New tab
    await page.locator('.new-tab-view').getByRole('button', { name: 'Settings' }).click();
    await page.locator('.modal').waitFor();
    await page.locator('.modal').getByRole('button', { name: 'API & MCP' }).click();
    await page.locator('.modal').getByText('get_vault_info').waitFor();
    await page.locator('.modal').getByText('--mcp-token-file').waitFor();
    await page.locator('.modal').getByRole('button', { name: 'Done' }).click();
    await page.waitForFunction(() => !document.querySelector('.modal'));

    // Toggle theme via sidebar options menu
    await page.getByRole('button', { name: 'Sidebar options' }).click();
    await page.getByRole('button', { name: /Light theme/i }).click();
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');

    // 2. CSV viewer renders HTML table
    await page.getByRole('button', { name: 'scores.csv', exact: true }).click();
    await page.locator('.doc table').waitFor();
    assert.equal(await page.locator('.doc table td', { hasText: 'Alice' }).count(), 1);

    // 3. Sandboxed HTML viewer renders iframe pointing to /raw/
    await page.getByRole('button', { name: 'widget.html', exact: true }).click();
    const iframe = page.locator('iframe[sandbox="allow-scripts"]');
    await iframe.waitFor();
    const src = await iframe.getAttribute('src');
    assert.match(src || '', /^\/raw\/demos\/widget\.html/);

    // 4. Outline & Backlinks: open notes/target.md, verify heading + backlink, click backlink
    await page.getByRole('button', { name: 'target.md', exact: true }).click();
    await page.locator('.rightbar').getByText('Section One').waitFor();
    const backlink = page.locator('.rightbar .backlink-item', { hasText: 'notes/source.md' });
    await backlink.waitFor();
    await backlink.click();
    await page.locator('.doc').getByRole('heading', { name: 'Source' }).waitFor();

    assert.equal(pageErrors.length, 0);
    await context.close();
  } finally {
    await env.cleanup();
  }
});
