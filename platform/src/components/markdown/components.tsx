import type { ReactNode } from 'react';

import { CodeBlock } from './code-block';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Props = Record<string, any>;

function slugHref(id?: string) {
  return id ? `#${id}` : undefined;
}

function AnchorLink({ id }: { id?: string }) {
  if (!id) return null;
  return (
    <a href={slugHref(id)} className="md-anchor" aria-label="Link to this section">
      #
    </a>
  );
}

/** Flattens heading children so we can spot emoji-led titles (🔁 Cycle 1 …). */
function plainText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(plainText).join('');
  if (typeof node === 'object' && 'props' in node) {
    return plainText((node as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

function heading(level: 2 | 3 | 4) {
  const Tag = `h${level}` as 'h2' | 'h3' | 'h4';
  return function Heading({ node, id, children }: Props) {
    void node;
    const emojiLed = /^\p{Extended_Pictographic}/u.test(plainText(children).trimStart());
    return (
      <Tag id={id}>
        <span className={emojiLed ? 'md-emoji-heading' : undefined}>{children}</span>
        {level < 4 ? <AnchorLink id={id} /> : null}
      </Tag>
    );
  };
}

/**
 * Component map for the book's markdown. Typography itself lives in
 * globals.css under `.md-body`; this file only adds behaviour:
 * anchors, scrollable tables, copyable code, task checkboxes, safe links.
 */
export const markdownComponents: Record<string, (props: Props) => ReactNode> = {
  h1: ({ node, id, children }: Props) => {
    void node;
    return (
      <h1 id={id}>
        <span>{children}</span>
      </h1>
    );
  },
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),

  a: ({ node, href, children }: Props) => {
    void node;
    const external = /^https?:\/\//i.test(href ?? '');
    const safe = /^(https?:\/\/|mailto:|\/|#)/i.test(href ?? '') ? href : undefined;
    return (
      <a href={safe} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
        {children}
      </a>
    );
  },

  pre: (props: Props) => <CodeBlock {...props} />,

  table: ({ node, children }: Props) => {
    void node;
    return (
      <div className="md-table-scroll" tabIndex={0}>
        <table>{children}</table>
      </div>
    );
  },

  blockquote: ({ node, children }: Props) => {
    void node;
    return (
      <blockquote className="md-callout">
        <span className="md-callout-mark" aria-hidden>
          ✦
        </span>
        <div>{children}</div>
      </blockquote>
    );
  },

  input: ({ node, checked, disabled, type }: Props) => {
    void node;
    if (type !== 'checkbox') return <input type={type} checked={checked} disabled={disabled} />;
    return (
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        readOnly
        className="md-task-checkbox"
      />
    );
  },
};
