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

          {settingsTab === 'endpoints' && (
            <>
              <div className="field">
                <label>REST API (v1)</label>
                <div className="endpoint-box">GET /api/v1/health</div>
                <div className="endpoint-box">GET /api/v1/tree</div>
                <div className="endpoint-box">GET /api/v1/file?path=README.md</div>
                <div className="endpoint-box">PUT / POST / PATCH /api/v1/file — {"{ path, content, append? } or { path, target, replacement, replaceAll? }"}</div>
                <div className="endpoint-box">DELETE /api/v1/file?path=...</div>
                <div className="endpoint-box">GET /api/v1/search?q=python</div>
                <div className="endpoint-box">GET /api/v1/events (SSE)</div>
              </div>
              <div className="field">
                <label>MCP Endpoint (Streamable HTTP)</label>
                <div className="endpoint-box">POST /mcp — tools: list_vault, read_note, search_vault, write_note, delete_note</div>
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
