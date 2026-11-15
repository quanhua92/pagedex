import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createPlaywrightVault } from './helpers/harness.js';

test('Git Changes tab opens Diff view and commits changes', async () => {
  const env = await createPlaywrightVault({
    'README.md': '# Repo\n\nLine 1\n'
  });

  try {
    execFileSync('git', ['init'], { cwd: env.vaultDir });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: env.vaultDir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: env.vaultDir });
    execFileSync('git', ['add', '-A'], { cwd: env.vaultDir });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: env.vaultDir });

    fs.writeFileSync(path.join(env.vaultDir, 'README.md'), '# Repo\n\nLine 1\nLine 2\n', 'utf8');

    const { context, page, pageErrors } = await env.openAppPage();

    // Switch to Changes tab, open diff for README.md
    await page.locator('.sidebar-tab', { hasText: 'Changes' }).click();
    await page.locator('.tree .tree-file', { hasText: 'README.md' }).click();
    await page.locator('.diff-wrap').waitFor();
    await page.locator('.diff-wrap').getByText('Line 2').waitFor();

    // Commit via GitCommitModal
    await page.locator('.changes-bar').getByRole('button', { name: 'Commit', exact: true }).click();
    await page.locator('.modal input[type="text"]').fill('add line 2');
    await page.locator('.modal').getByRole('button', { name: 'Commit', exact: true }).click();
    await page.locator('.modal').getByText(/Committed|1 file changed/i).waitFor();

    assert.equal(pageErrors.length, 0);
    await context.close();
  } finally {
    await env.cleanup();
  }
});

test('Read-only mode hides write, edit, rename, move, and delete controls', async () => {
  const env = await createPlaywrightVault(
    { 'README.md': '# Read Only\n\nHello\n' },
    { PAGEDEX_READ_ONLY: '1' }
  );

  try {
    const { context, page, pageErrors } = await env.openAppPage();

    // No '+' New note in sidebar or Create new note on New tab
    assert.equal(await page.locator('.sidebar-new-btn').count(), 0);
    assert.equal(await page.locator('.new-tab-view').getByRole('button', { name: 'Create new note' }).count(), 0);

    // Row 3-dot menu has no Rename / Move / Delete
    await page.getByRole('button', { name: 'Actions for README.md' }).click();
    const ctxMenu = page.locator('.file-ctx-menu');
    await ctxMenu.waitFor();
    assert.equal(await ctxMenu.getByRole('button', { name: 'Rename' }).count(), 0);
    assert.equal(await ctxMenu.getByRole('button', { name: 'Move' }).count(), 0);
    assert.equal(await ctxMenu.getByRole('button', { name: 'Delete' }).count(), 0);
    await page.mouse.click(10, 10);
    await page.waitForFunction(() => !document.querySelector('.file-ctx-menu'));
    await page.getByRole('button', { name: 'README.md', exact: true }).click();

    // Note options menu has no Edit / Delete
    await page.locator('.doc').getByRole('heading', { name: 'Read Only' }).waitFor();
    await page.getByRole('button', { name: 'Note options' }).click();
    const moreMenu = page.locator('.more-menu');
    await moreMenu.waitFor();
    assert.equal(await moreMenu.getByRole('button', { name: 'Edit' }).count(), 0);
    assert.equal(await moreMenu.getByRole('button', { name: 'Delete' }).count(), 0);

    assert.equal(pageErrors.length, 0);
    await context.close();
  } finally {
    await env.cleanup();
  }
});
