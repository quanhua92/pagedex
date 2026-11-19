export const DEFAULT_SETTINGS = {
  theme: 'dark',
  fontSize: 15,
  lineHeight: 1.65,
  maxWidth: 780,
  outlinePosition: 'right', // 'right' | 'bottom' | 'hidden'
  startupMode: 'newtab', // 'newtab' | 'readme' | 'last' | 'custom'
  startupPath: 'README.md',
  autoCollapsed: ['apps', 'backups'],
  hiddenFolders: []
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem('vault-settings');
    if (!raw) return DEFAULT_SETTINGS;
    const p = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...p,
      theme: p.theme === 'light' ? 'light' : 'dark',
      fontSize: Number(p.fontSize) >= 12 && Number(p.fontSize) <= 22 ? Number(p.fontSize) : 15,
      lineHeight: Number(p.lineHeight) >= 1.3 && Number(p.lineHeight) <= 2.1 ? Number(p.lineHeight) : 1.65,
      maxWidth: Number(p.maxWidth) >= 560 && Number(p.maxWidth) <= 1040 ? Number(p.maxWidth) : 780,
      outlinePosition: ['right', 'bottom', 'hidden'].includes(p.outlinePosition) ? p.outlinePosition : 'right',
      autoCollapsed: Array.isArray(p.autoCollapsed) ? p.autoCollapsed : DEFAULT_SETTINGS.autoCollapsed,
      hiddenFolders: Array.isArray(p.hiddenFolders) ? p.hiddenFolders : []
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function resolveStartupPath(s) {
  const hash = decodeURIComponent(location.hash.slice(1) || '');
  if (hash) return hash;
  if (s.startupMode === 'readme') return 'README.md';
  if (s.startupMode === 'last') return localStorage.getItem('vault-last-path') || null;
  if (s.startupMode === 'custom') return s.startupPath.trim() || null;
  return null;
}
