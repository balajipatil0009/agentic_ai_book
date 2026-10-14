import { Fragment, type ReactNode } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import { unified } from 'unified';

import { markdownComponents } from '@/components/markdown/components';

/**
 * The book is rendered with the same unified pipeline react-markdown uses,
 * but driven manually so `rehype-pretty-code` (async shiki highlighting) can
 * run — react-markdown's own `runSync` would throw on it.
 *
 * Anchors come from rehype-slug/github-slugger, which is also what the seeder
 * uses to build the table of contents, so ids and TOC entries always agree.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypePrettyCode, {
    theme: 'vitesse-dark',
    keepBackground: false,
    defaultLang: 'plaintext',
  });

export async function renderMarkdown(source: string): Promise<ReactNode> {
  const tree = await processor.run(processor.parse(source));
  return toJsxRuntime(tree as never, {
    Fragment,
    jsx,
    jsxs,
    components: markdownComponents,
    elementAttributeNameCase: 'react',
    ignoreInvalidStyle: true,
  }) as ReactNode;
}
