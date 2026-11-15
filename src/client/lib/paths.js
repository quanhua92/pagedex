export function baseTitle(p) {
  if (!p) return 'New tab';
  return p.split('/').pop().replace(/\.md$/i, '');
}

export function isImagePath(p) {
  return /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(p);
}

export function isDownloadOnlyPath(p) {
  return /\.(epub|pdf|zip|tar|gz|tgz|7z|rar|docx?|xlsx?|pptx?|odt|ods|odp|mp3|wav|m4a|mp4|mov|webm|mkv|avi|dmg|exe|bin|whl|sqlite|db)$/i.test(p);
}

export function resolveRelative(basePath, href) {
  const clean = href.split('#')[0];
  const dir = basePath.includes('/') ? basePath.split('/').slice(0, -1).join('/') : '';
  const joined = (dir ? `${dir}/` : '') + clean;
  const parts = [];
  for (const seg of joined.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

export function resolveWikiTarget(raw, flatFiles) {
  const clean = raw.split('|')[0].split('#')[0].trim().replace(/\.md$/i, '').replace(/^\/+/, '').toLowerCase();
  if (!clean) return null;
  const mdFiles = flatFiles.filter((f) => f.endsWith('.md'));
  const exact = mdFiles.find((f) => f.slice(0, -3).toLowerCase() === clean);
  if (exact) return exact;
  const base = clean.split('/').pop();
  return mdFiles.find((f) => f.slice(0, -3).split('/').pop().toLowerCase() === base) || null;
}

export function buildNewNotePath(title, folder) {
  const cleanTitle = (title || '').trim().replace(/^\/+|\/+$/g, '');
  if (!cleanTitle) return '';
  const fileName = /\.[a-z0-9]+$/i.test(cleanTitle) ? cleanTitle : `${cleanTitle}.md`;
  const cleanFolder = (folder || '').trim().replace(/^\/+|\/+$/g, '');
  return cleanFolder ? `${cleanFolder}/${fileName}` : fileName;
}
