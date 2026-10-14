'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

type Props = {
  children?: ReactNode;
  node?: unknown;
  className?: string;
  style?: React.CSSProperties;
  tabIndex?: number;
  'data-language'?: string;
};

const LABELS: Record<string, string> = {
  plaintext: 'terminal',
  bash: 'bash',
  shell: 'bash',
  console: 'terminal',
  python: 'python',
  sql: 'sql',
  ts: 'typescript',
  typescript: 'typescript',
  json: 'json',
  yaml: 'yaml',
  ini: 'env',
  dockerfile: 'docker',
  markdown: 'markdown',
};

/** Copy button + language pill around a highlighted `<pre>`. */
export function CodeBlock(props: Props) {
  const { node, children, className, style, tabIndex } = props;
  const language = props['data-language'] ?? 'plaintext';
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  void node;

  const label = LABELS[language] ?? language;

  async function copy() {
    const pre = preRef.current;
    if (!pre) return;
    const lines = pre.querySelectorAll('[data-line]');
    const text =
      lines.length > 0
        ? Array.from(lines)
            .map((line) => line.textContent ?? '')
            .join('\n')
        : (pre.innerText ?? '');
    try {
      await navigator.clipboard.writeText(text.replace(/\n$/, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — leave the button alone */
    }
  }

  return (
    <figure className="md-code-group">
      <figcaption className="md-code-bar">
        <span className="md-code-lang">{label}</span>
        <button type="button" onClick={copy} className="md-copy" aria-label="Copy code">
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </figcaption>
      <pre ref={preRef} className={className} style={style} tabIndex={tabIndex}>
        {children}
      </pre>
    </figure>
  );
}
