export function baseTitle(p) {
  if (!p) return 'New tab';
  return p.split('/').pop().replace(/\.md$/i, '');
}

export function isMarkdownPath(p) {
  return /\.(md|markdown|mdx)$/i.test(p);
}

export function isImagePath(p) {
  return /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(p);
}

export function isSvgPath(p) {
  return /\.svg$/i.test(p);
}

export function isPdfPath(p) {
  return /\.pdf$/i.test(p);
}

export function isAudioPath(p) {
  return /\.(mp3|wav|m4a|ogg)$/i.test(p);
}

export function isVideoPath(p) {
  return /\.(mp4|webm|mov)$/i.test(p);
}

export function isHtmlPath(p) {
  return /\.html?$/i.test(p);
}

export function isCsvPath(p) {
  return /\.(csv|tsv)$/i.test(p);
}

export function isNotebookPath(p) {
  return /\.ipynb$/i.test(p);
}

export function isDownloadOnlyPath(p) {
  return /\.(epub|zip|tar|gz|tgz|7z|rar|docx?|xlsx?|pptx?|odt|ods|odp|mkv|avi|dmg|exe|bin|whl|sqlite|db)$/i.test(p);
}

export function isTextEditablePath(p) {
  if (!p) return false;
  return (
    (!isImagePath(p) || isSvgPath(p)) &&
    !isPdfPath(p) &&
    !isAudioPath(p) &&
    !isVideoPath(p) &&
    !isNotebookPath(p) &&
    !isDownloadOnlyPath(p)
  );
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
  const clean = raw.split('|')[0].split('#')[0].trim().replace(/^\/+/, '').toLowerCase();
  if (!clean) return null;
  const cleanNoMd = clean.replace(/\.md$/i, '');
  const mdFiles = flatFiles.filter((f) => /\.md$/i.test(f));

  const exactAll = flatFiles.find((f) => f.toLowerCase() === clean);
  if (exactAll) return exactAll;
  const exactMd = mdFiles.find((f) => f.slice(0, -3).toLowerCase() === cleanNoMd);
  if (exactMd) return exactMd;

  const base = clean.split('/').pop();
  const baseNoMd = cleanNoMd.split('/').pop();
  const baseAll = flatFiles.find((f) => f.split('/').pop().toLowerCase() === base);
  if (baseAll) return baseAll;
  return mdFiles.find((f) => f.slice(0, -3).split('/').pop().toLowerCase() === baseNoMd) || null;
}

export function buildNewNotePath(title, folder) {
  const cleanTitle = (title || '').trim().replace(/^\/+|\/+$/g, '');
  if (!cleanTitle) return '';
  const fileName = /\.[a-z0-9]+$/i.test(cleanTitle) ? cleanTitle : `${cleanTitle}.md`;
  const cleanFolder = (folder || '').trim().replace(/^\/+|\/+$/g, '');
  return cleanFolder ? `${cleanFolder}/${fileName}` : fileName;
}

export function buildNewFolderPath(name, parentFolder) {
  const cleanName = (name || '').trim().replace(/^\/+|\/+$/g, '');
  if (!cleanName) return '';
  const cleanParent = (parentFolder || '').trim().replace(/^\/+|\/+$/g, '');
  return cleanParent ? `${cleanParent}/${cleanName}` : cleanName;
}

export function buildRenameTarget(targetPath, type = 'file') {
  const parts = targetPath.split('/');
  const newName = parts.pop() || '';
  return { type, oldPath: targetPath, parentDir: parts.join('/'), newName };
}

export function buildMoveTarget(targetPath, type = 'file') {
  const parts = targetPath.split('/');
  const name = parts.pop() || '';
  return { type, oldPath: targetPath, name, destFolder: parts.join('/') };
}

export function resolveImageUploadTarget(activePath, fileName, mode = 'same') {
  const noteDir = activePath && activePath.includes('/') ? activePath.split('/').slice(0, -1).join('/') : '';
  if (mode === 'assets') {
    return {
      uploadDir: noteDir ? `${noteDir}/assets` : 'assets',
      markdownHref: `assets/${fileName}`
    };
  }
  if (mode === 'vault-assets') {
    const depth = noteDir ? noteDir.split('/').length : 0;
    const prefix = depth > 0 ? '../'.repeat(depth) : '';
    return {
      uploadDir: 'assets',
      markdownHref: `${prefix}assets/${fileName}`
    };
  }
  return {
    uploadDir: noteDir,
    markdownHref: fileName
  };
}
