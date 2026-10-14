import { cn } from '@/lib/utils';
import { renderMarkdown } from '@/lib/markdown';

/** Server component: markdown in, fully styled chapter body out. */
export async function MarkdownView({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const content = await renderMarkdown(source);
  return <div className={cn('md-body', className)}>{content}</div>;
}
