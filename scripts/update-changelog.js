import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const dryRun = process.argv.includes('--dry-run');

let prevTag = null;
try {
  prevTag = execFileSync('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
} catch {
  prevTag = null;
}

const range = prevTag ? `${prevTag}..HEAD` : 'HEAD';
const raw = execFileSync('git', ['log', range, '--pretty=format:%h%x09%s'], {
  cwd: root,
  encoding: 'utf8'
}).trim();

const sections = [
  ['Features', []],
  ['Bug Fixes', []],
  ['Tests', []],
  ['Documentation', []],
  ['CI', []],
  ['Other Changes', []]
];
const map = new Map(sections);

for (const line of raw ? raw.split('\n') : []) {
  const [hash, subject] = line.split('\t');
  if (!subject || subject.startsWith('chore(release):')) continue;

  const match = /^([a-z]+)(?:\(([^)]+)\))?:\s*(.+)$/i.exec(subject);
  const type = match?.[1]?.toLowerCase();
  const scope = match?.[2];
  const msg = match?.[3] || subject;
  const entry = scope ? `- **${scope}:** ${msg} (${hash})` : `- ${msg} (${hash})`;

  if (type === 'feat') map.get('Features').push(entry);
  else if (type === 'fix') map.get('Bug Fixes').push(entry);
  else if (type === 'test') map.get('Tests').push(entry);
  else if (type === 'docs') map.get('Documentation').push(entry);
  else if (type === 'ci') map.get('CI').push(entry);
  else map.get('Other Changes').push(entry);
}

const date = new Date().toISOString().slice(0, 10);
const lines = [`## [${pkg.version}] - ${date}`, ''];

let hasEntries = false;
for (const [title, items] of sections) {
  if (!items.length) continue;
  hasEntries = true;
  lines.push(`### ${title}`, '', ...items, '');
}
if (!hasEntries) {
  lines.push('- Maintenance release.', '');
}

const newSection = lines.join('\n');

if (dryRun) {
  console.log(newSection);
  process.exit(0);
}

const changelogPath = path.join(root, 'CHANGELOG.md');
const header = '# Changelog\n\nAll notable changes to `pagedex` will be documented in this file.\n\n';
let existing = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : header;
if (!existing.startsWith('# Changelog')) {
  existing = header + existing;
}

const bodyStart = existing.indexOf('\n## ');
const updated =
  bodyStart === -1
    ? `${existing.trimEnd()}\n\n${newSection}`
    : `${existing.slice(0, bodyStart + 1)}${newSection}\n${existing.slice(bodyStart + 1)}`;

fs.writeFileSync(changelogPath, updated, 'utf8');
console.log(`Updated CHANGELOG.md for v${pkg.version}`);
