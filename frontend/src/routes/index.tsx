import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.32em] text-subtle">
          README
        </p>
        <h1 className="font-mono text-5xl leading-tight tracking-tight text-fg">
          A small toolbox.
          <br />
          <span className="text-accent">Local. No telemetry.</span>
        </h1>
      </header>

      <p className="font-serif italic text-lg text-muted max-w-prose leading-relaxed">
        Pick a utility from the sidebar. Each one runs entirely on this machine —
        no API keys, no LLM round-trips, no data leaving the box. The translators
        use neural machine translation models that download once and run on CPU.
      </p>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-subtle mb-3">
          Status
        </h2>
        <ul className="font-mono text-sm space-y-1.5 text-muted">
          <li>
            <span className="text-success">✓</span> infra (postgres, redis,
            adminer) running on docker
          </li>
          <li>
            <span className="text-success">✓</span> backend (django + drf)
            scaffolded
          </li>
          <li>
            <span className="text-success">✓</span> frontend (vite + tanstack)
            scaffolded
          </li>
          <li>
            <span className="text-subtle">·</span> utilities — wiring in progress
          </li>
        </ul>
      </section>
    </article>
  );
}
