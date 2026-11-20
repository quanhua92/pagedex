import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdownWithLinks } from '../src/client/lib/markdown.js';

test('renders inline and block LaTeX math with KaTeX', () => {
  const sample = [
    'Forward pass: Map input tensor $x$ through registered nn.Module layers to produce raw unnormalized scores (logits) $z$.',
    'Loss & Autograd: Compare logits $z$ to target labels $y$ via a scalar loss $\\mathcal{L}$, then call loss.backward() so PyTorch walks the dynamic computation graph in reverse and populates .grad on every parameter.',
    'Optimizer step: Clear stale gradients (zero_grad(set_to_none=True)) before each step, then let AdamW update parameters using momentum and adaptive variance:',
    '$$ \\theta_{t+1} = \\theta_t - \\eta \\left( \\frac{\\hat{m}_t}{\\sqrt{\\hat{v}_t} + \\epsilon} + \\lambda \\theta_t \\right) $$'
  ].join('\n');

  const { renderedHtml } = renderMarkdownWithLinks(sample, 'note.md', ['note.md']);

  assert.match(renderedHtml, /class="katex"/);
  assert.match(renderedHtml, /class="katex-display"/);
  assert.doesNotMatch(renderedHtml, /\$\$ \\theta_\{t\+1\}/);
  assert.doesNotMatch(renderedHtml, /\$\\mathcal\{L\}\$/);
});

test('renders multiline block math and ignores currency and code blocks', () => {
  const sample = [
    'Price is $10 and $20.',
    '',
    'Inline code `$x$` and fenced:',
    '',
    '```tex',
    '$$x^2$$',
    '```',
    '',
    '$$',
    'E = mc^2',
    '$$'
  ].join('\n');

  const { renderedHtml } = renderMarkdownWithLinks(sample, 'note.md', ['note.md']);

  assert.match(renderedHtml, /Price is \$10 and \$20\./);
  assert.match(renderedHtml, /<code>\$x\$<\/code>/);
  assert.match(renderedHtml, /class="katex-display"/);
});
