import GithubSlugger from 'github-slugger';

/**
 * Pure markdown introspection shared by the seeder and the reader.
 *
 * Anchors are produced by `github-slugger` — the exact library `rehype-slug`
 * uses when it injects `id` attributes at render time, so a table-of-contents
 * entry always matches the id on the page (including duplicate `-1` suffixes).
 */

export type ParsedHeading = {
  heading: string;
  anchor: string;
  level: number;
  order: number;
};

export type ParsedChapter = {
  title: string;
  headings: ParsedHeading[];
  words: number;
  estMinutes: number;
};

const FENCE = /^\s*(```|~~~)/;

/** Markdown headings, ignoring anything inside a fenced code block. */
export function parseChapter(md: string): ParsedChapter {
  const slugger = new GithubSlugger();
  const headings: ParsedHeading[] = [];
  let inFence = false;
  let title = '';
  let words = 0;

  const lines = md.split(/\r?\n/);
  for (const line of lines) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{1,6})\s+(.*?)\s*$/.exec(line);
    if (match) {
      const level = match[1].length;
      const text = match[2];
      if (level === 1 && !title) {
        title = text;
        continue;
      }
      if (level <= 3) {
        headings.push({
          heading: text,
          anchor: slugger.slug(text),
          level,
          order: headings.length,
        });
      }
      continue;
    }

    if (line.trim()) words += line.trim().split(/\s+/).length;
  }

  return { title, headings, words, estMinutes: estimateMinutes(words, md) };
}

/** ~200 wpm prose, plus a slower pass over code-heavy material. */
function estimateMinutes(words: number, md: string): number {
  const fences = (md.match(/^```/gm) ?? []).length;
  return Math.max(8, Math.round(words / 190) + Math.round(fences * 0.8));
}

/** Chapter slug from a `chapter-07-production.md` style filename. */
export function slugFromFilename(filename: string): string {
  return filename.replace(/^chapter-\d+-/, '').replace(/\.md$/, '');
}

export function chapterNumber(filename: string): number {
  const match = /^chapter-(\d+)/.exec(filename);
  return match ? Number(match[1]) : 999;
}
