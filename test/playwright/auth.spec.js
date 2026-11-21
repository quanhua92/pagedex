import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createPlaywrightVault } from './helpers/harness.js';

test('auth-token-file locks Web UI until login, persists via cookie, and signs out cleanly', async () => {
  const tokenDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pagedex-pw-auth-'));
  const tokenFile = path.join(tokenDir, 'auth-tokens');
  fs.writeFileSync(tokenFile, 'web-secret-1, web-secret-2\n', 'utf8');

  const authedEnv = await createPlaywrightVault(
    {
      'README.md': '# Private Vault\nTop secret content.\n'
    },
    { PAGEDEX_AUTH_TOKEN_FILE: tokenFile }
  );

  try {
    const { context, page, pageErrors } = await authedEnv.openAppPage();
    await page.getByLabel('Access token').waitFor();
    assert.equal(await page.getByText('Top secret content.').count(), 0);

    // Wrong token shows error
    await page.getByLabel('Access token').fill('bad-token');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(), /Invalid token/);

    // Valid token unlocks vault
    await page.getByLabel('Access token').fill('web-secret-1');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.getByRole('button', { name: 'README.md', exact: true }).click();
    await page.locator('.doc').getByText('Top secret content.').waitFor();

    // Reload stays authenticated via HttpOnly cookie
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.doc').getByText('Top secret content.').waitFor();

    // Sign out re-locks the UI (under Sidebar options menu)
    await page.getByRole('button', { name: 'Sidebar options' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByLabel('Access token').waitFor();

    assert.deepEqual(pageErrors, []);
    await context.close();
  } finally {
    await authedEnv.cleanup();
    fs.rmSync(tokenDir, { recursive: true, force: true });
  }
});
