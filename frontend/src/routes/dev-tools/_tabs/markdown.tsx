import { useMemo, useState } from "react";
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: true });

const SAMPLE = `# noname

A *small* toolbox of **local-only** utilities.

- text translator
- docx translator
- yt downloader
- dev tools

\`\`\`ts
const greeting = "hello"; // monospace lives
\`\`\`
`;

export function MarkdownTab() {
  const [source, setSource] = useState<string>(SAMPLE);
  const html = useMemo(() => md.render(source), [source]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <textarea
        value={source}
        onChange={(e) => setSource(e.target.value)}
        spellCheck={false}
        className="min-h-[24rem] bg-surface/40 border border-border rounded-sm p-3 font-mono text-xs leading-relaxed text-fg focus:border-accent focus:outline-none"
        data-testid="markdown-input"
      />
      <div
        className="min-h-[24rem] bg-surface/40 border border-border rounded-sm p-4 font-serif text-sm text-fg overflow-auto markdown-preview"
        dangerouslySetInnerHTML={{ __html: html }}
        data-testid="markdown-output"
      />
    </div>
  );
}
