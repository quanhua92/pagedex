import React, { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '../../lib/settings.js';

function parseFolderList(raw) {
  return raw
    .split(',')
    .map((x) => x.trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
}

export default function SettingsModal({
  settingsOpen,
  setSettingsOpen,
  settingsTab,
  setSettingsTab,
  settings,
  setSettings,
  setCollapsed
}) {
  const [autoCollapsedText, setAutoCollapsedText] = useState(() =>
    settings.autoCollapsed.join(', ')
  );
  const [hiddenFoldersText, setHiddenFoldersText] = useState(() =>
    settings.hiddenFolders.join(', ')
  );

  useEffect(() => {
    if (settingsOpen) {
      setAutoCollapsedText(settings.autoCollapsed.join(', '));
      setHiddenFoldersText(settings.hiddenFolders.join(', '));
    }
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  return (
    <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="btn" onClick={() => setSettingsOpen(false)}>
            Close
          </button>
        </div>

        <div className="settings-tabs">
          {[
            ['general', 'General'],
            ['appearance', 'Appearance'],
            ['files', 'Files & Search'],
            ['shortcuts', 'Shortcuts'],
            ['endpoints', 'API & MCP']
          ].map(([id, label]) => (
            <button
              key={id}
              className={`settings-tab${settingsTab === id ? ' active' : ''}`}
              onClick={() => setSettingsTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {settingsTab === 'general' && (
            <>
              <div className="field">
                <label>On startup / first open</label>
                <select
                  value={settings.startupMode}
                  onChange={(e) => setSettings((s) => ({ ...s, startupMode: e.target.value }))}
                >
                  <option value="readme">README.md</option>
                  <option value="last">Last opened note</option>
                  <option value="newtab">New tab launcher</option>
                  <option value="custom">Custom note path</option>
                </select>
                <div className="field-hint">
                  Used when opening the vault without a specific #note in the URL.
                </div>
              </div>
              {settings.startupMode === 'custom' && (
                <div className="field">
                  <label>Custom startup note path</label>
                  <input
                    type="text"
                    placeholder="core/README.md"
                    value={settings.startupPath}
                    onChange={(e) => setSettings((s) => ({ ...s, startupPath: e.target.value }))}
                  />
                </div>
              )}
            </>
          )}

          {settingsTab === 'appearance' && (
            <>
              <div className="field">
                <label>Theme</label>
                <select
                  value={settings.theme}
                  onChange={(e) => setSettings((s) => ({ ...s, theme: e.target.value }))}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>
              <div className="field">
                <label>Outline &amp; Backlinks panel</label>
                <select
                  value={settings.outlinePosition}
                  onChange={(e) => setSettings((s) => ({ ...s, outlinePosition: e.target.value }))}
                >
                  <option value="right">Right sidebar</option>
                  <option value="bottom">Bottom panel</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
              <div className="field">
                <label>Reader font size: {settings.fontSize}px</label>
                <input
                  type="range"
                  min="13"
                  max="20"
                  value={settings.fontSize}
                  onChange={(e) => setSettings((s) => ({ ...s, fontSize: Number(e.target.value) }))}
                />
              </div>
              <div className="field">
                <label>Line height: {settings.lineHeight}</label>
                <input
                  type="range"
                  min="1.35"
                  max="2.0"
                  step="0.05"
                  value={settings.lineHeight}
                  onChange={(e) => setSettings((s) => ({ ...s, lineHeight: Number(e.target.value) }))}
                />
              </div>
              <div className="field">
                <label>Max reading width: {settings.maxWidth}px</label>
                <input
                  type="range"
                  min="580"
                  max="980"
                  step="20"
                  value={settings.maxWidth}
                  onChange={(e) => setSettings((s) => ({ ...s, maxWidth: Number(e.target.value) }))}
                />
              </div>
            </>
          )}

          {settingsTab === 'files' && (
            <>
              <div className="field">
                <label>Auto-collapsed folders (comma-separated)</label>
                <input
                  type="text"
                  placeholder="apps, templates"
                  value={autoCollapsedText}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setAutoCollapsedText(raw);
                    const list = parseFolderList(raw);
                    setSettings((s) => ({ ...s, autoCollapsed: list }));
                    setCollapsed(new Set(list));
                  }}
                  onBlur={() => setAutoCollapsedText(settings.autoCollapsed.join(', '))}
                />
              </div>
              <div className="field">
                <label>Hidden folders (hide from sidebar & search)</label>
                <input
                  type="text"
                  placeholder="ideas, templates"
                  value={hiddenFoldersText}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setHiddenFoldersText(raw);
                    const list = parseFolderList(raw);
                    setSettings((s) => ({ ...s, hiddenFolders: list }));
                  }}
                  onBlur={() => setHiddenFoldersText(settings.hiddenFolders.join(', '))}
                />
              </div>
            </>
          )}

          {settingsTab === 'shortcuts' && (
            <>
              <div className="field">
                <label>Navigation &amp; Workspace</label>
                {[
                  ['Open Quick Switcher', ['Cmd/Ctrl + K', 'Cmd/Ctrl + O', '/']],
                  ['Previous / next tab', ['[', ']', 'Alt + [ / ]']],
                  ['Toggle left files sidebar', ['Cmd/Ctrl + \\']],
                  ['Toggle Preview / Edit', ['Cmd/Ctrl + E']],
                  ['Save note (in Editor / Raw)', ['Cmd/Ctrl + S']]
                ].map(([desc, keys]) => (
                  <div className="shortcut-row" key={desc}>
                    <span>{desc}</span>
                    <span className="shortcut-keys">
                      {keys.map((k) => (
                        <kbd className="shortcut-kbd" key={k}>
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              <div className="field">
                <label>Quick Switcher &amp; Dialogs</label>
                {[
                  ['Move selection', ['↑', '↓']],
                  ['Open selected file', ['Enter']],
                  ['Close Quick Switcher / dialog', ['Esc']]
                ].map(([desc, keys]) => (
                  <div className="shortcut-row" key={desc}>
                    <span>{desc}</span>
                    <span className="shortcut-keys">
                      {keys.map((k) => (
                        <kbd className="shortcut-kbd" key={k}>
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {settingsTab === 'endpoints' && (
            <>
              <div className="field">
                <label>REST API (v1) & Raw</label>
                <div className="endpoint-box">GET /api/v1/health — server root &amp; readOnly status</div>
                <div className="endpoint-box">GET /api/v1/tree · GET /api/v1/files?sort=mtime&amp;limit=50</div>
                <div className="endpoint-box">GET /api/v1/search?q=python</div>
                <div className="endpoint-box">GET /api/v1/file?path=README.md (supports ?download=1 &amp; Range)</div>
                <div className="endpoint-box">PUT / POST / PATCH /api/v1/file — {"{ path, content, append? } or { path, target, replacement, replaceAll? }"}</div>
                <div className="endpoint-box">POST /api/v1/file/rename · POST /api/v1/dir/rename · POST /api/v1/file/upload</div>
                <div className="endpoint-box">DELETE /api/v1/file?path=...</div>
                <div className="endpoint-box">GET /api/v1/changes · GET /api/v1/git/diff · POST /api/v1/git/discard · POST /api/v1/git/commit</div>
                <div className="endpoint-box">GET /api/v1/events (SSE) · GET /raw/&lt;path&gt;</div>
                <div className="endpoint-box">POST /api/v1/auth/login · POST /api/v1/auth/logout · GET /api/v1/auth/status</div>
              </div>
              <div className="field">
                <label>MCP Endpoint (/mcp — 2026-07-28, 2025-11-25, 2024-11-05)</label>
                <div className="endpoint-box">Read: list_vault, read_note, search_vault, get_vault_info, get_note_links, git_status, git_diff</div>
                <div className="endpoint-box">Write (--mcp write|full): write_note, move_path</div>
                <div className="endpoint-box">Full (--mcp full, default): delete_note</div>
                <div className="endpoint-box">Git (--mcp-git): git_commit, git_discard</div>
                <div className="endpoint-box">Flags: --auth-token-file &lt;path&gt; · --mcp &lt;read|write|full|off&gt; · --mcp-token-file &lt;path&gt; · --read-only</div>
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          <button
            className="btn"
            onClick={() => {
              setSettings(DEFAULT_SETTINGS);
              setCollapsed(new Set(DEFAULT_SETTINGS.autoCollapsed));
              setAutoCollapsedText(DEFAULT_SETTINGS.autoCollapsed.join(', '));
              setHiddenFoldersText(DEFAULT_SETTINGS.hiddenFolders.join(', '));
            }}
          >
            Reset defaults
          </button>
          <button className="btn primary" onClick={() => setSettingsOpen(false)}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
