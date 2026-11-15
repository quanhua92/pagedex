import React from 'react';

export default function GitCommitModal({
  commitOpen,
  setCommitOpen,
  commitSelected,
  setCommitSelected,
  gitChanges,
  commitMessage,
  setCommitMessage,
  commitPush,
  setCommitPush,
  commitStatus,
  commitBusy,
  handleCommitSubmit
}) {
  if (!commitOpen) return null;

  return (
    <div className="modal-backdrop" onClick={() => setCommitOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Commit &amp; Push</h2>
          <button className="btn" onClick={() => setCommitOpen(false)}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Files ({commitSelected.size} selected)</label>
            <div className="commit-files">
              {gitChanges.map((c) => (
                <label key={c.path} className="commit-file-row">
                  <input
                    type="checkbox"
                    checked={commitSelected.has(c.path)}
                    onChange={(e) => {
                      setCommitSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(c.path);
                        else next.delete(c.path);
                        return next;
                      });
                    }}
                  />
                  <span className={`git-badge git-${c.status}`}>{c.status}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.path}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Commit message</label>
            <input
              type="text"
              placeholder="docs: update vault notes"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
            />
          </div>

          <label className="toggle-row">
            <span>Push to remote after commit</span>
            <input
              type="checkbox"
              checked={commitPush}
              onChange={(e) => setCommitPush(e.target.checked)}
            />
          </label>

          {commitStatus && (
            <div
              className="git-output"
              style={{ color: commitStatus.ok ? 'var(--green)' : '#f87171' }}
            >
              {commitStatus.text}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => setCommitOpen(false)}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={commitBusy || !commitMessage.trim() || commitSelected.size === 0}
            onClick={handleCommitSubmit}
          >
            {commitBusy ? 'Running...' : commitPush ? 'Commit & Push' : 'Commit'}
          </button>
        </div>
      </div>
    </div>
  );
}
