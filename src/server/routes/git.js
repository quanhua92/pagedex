import { discardGitChange, getGitChanges, getGitDiff, gitCommitAndPush } from '../vault.js';
import { upsertFileInIndex } from '../search-index.js';

export function registerGitRoutes(app) {
  app.get('/api/v1/changes', (c) => {
    return c.json(getGitChanges());
  });

  app.get('/api/v1/git/diff', (c) => {
    const rel = c.req.query('path') || '';
    const result = getGitDiff(rel);
    if (result.error) return c.json(result, 400);
    return c.json(result);
  });

  app.post('/api/v1/git/discard', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.path !== 'string') {
      return c.json({ error: 'Expected JSON { path, hunkIndex?, lineIndex? }' }, 400);
    }
    const result = discardGitChange(body);
    if (result.error) return c.json(result, 400);
    upsertFileInIndex(body.path);
    return c.json(result);
  });

  app.post('/api/v1/git/commit', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.message !== 'string' || !body.message.trim()) {
      return c.json({ error: 'Commit message is required' }, 400);
    }
    const result = gitCommitAndPush({
      message: body.message,
      files: body.files,
      push: Boolean(body.push)
    });
    if (result.error) return c.json(result, 400);
    return c.json(result);
  });
}
