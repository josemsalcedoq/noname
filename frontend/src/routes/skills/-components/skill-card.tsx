import { useState } from "react";

import {
  useInstallSkill,
  useInstallSteps,
  useUninstallSkill,
  type CatalogSkill,
} from "../api";

export function SkillCard({ skill }: { skill: CatalogSkill }) {
  const [showSteps, setShowSteps] = useState(false);
  const [copied, setCopied] = useState(false);
  const install = useInstallSkill();
  const uninstall = useUninstallSkill();
  const steps = useInstallSteps(showSteps ? skill.name : null);

  const onCopyOneliner = async () => {
    if (!steps.data) return;
    await navigator.clipboard.writeText(steps.data.oneliner);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article
      className="border border-border rounded-sm p-4 flex flex-col gap-3 bg-surface/30 hover:border-muted transition-colors"
      data-testid={`skill-card-${skill.name}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={skill.html_url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sm text-fg hover:text-accent break-all"
          >
            {skill.name}
          </a>
          {skill.installed ? (
            <p className="font-mono text-[10px] text-success mt-1">installed</p>
          ) : (
            <p className="font-mono text-[10px] text-subtle mt-1">not installed</p>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {skill.installed ? (
            <button
              type="button"
              onClick={() => uninstall.mutate(skill.name)}
              disabled={uninstall.isPending}
              className="px-3 py-1 border border-error text-error font-mono text-[11px] rounded-sm hover:bg-error/10 disabled:opacity-40"
              data-testid={`uninstall-${skill.name}`}
            >
              {uninstall.isPending ? "removing…" : "uninstall"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => install.mutate(skill.name)}
              disabled={install.isPending}
              className="px-3 py-1 bg-accent text-bg font-mono text-[11px] rounded-sm hover:opacity-90 disabled:opacity-40"
              data-testid={`install-${skill.name}`}
            >
              {install.isPending ? "installing…" : "install"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowSteps((prev) => !prev)}
            className="px-3 py-1 border border-border font-mono text-[11px] rounded-sm hover:border-accent"
            data-testid={`toggle-steps-${skill.name}`}
          >
            {showSteps ? "hide steps" : "manual steps"}
          </button>
        </div>
      </header>

      <p className="font-serif text-sm text-muted leading-relaxed">
        {skill.description || <span className="italic text-subtle">no description</span>}
      </p>

      {showSteps ? (
        <div className="space-y-2">
          {steps.isLoading ? (
            <p className="font-mono text-[11px] text-subtle">loading steps…</p>
          ) : steps.data ? (
            <>
              <pre className="bg-bg/60 border border-border rounded-sm p-3 font-mono text-[11px] text-fg whitespace-pre-wrap break-words">
                {steps.data.steps.join("\n")}
              </pre>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onCopyOneliner}
                  className="px-3 py-1 border border-border hover:border-accent font-mono text-[11px] rounded-sm"
                  data-testid={`copy-oneliner-${skill.name}`}
                >
                  {copied ? "copied" : "copy one-liner"}
                </button>
                <a
                  href={skill.skill_md_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] text-subtle hover:text-accent underline-offset-2 hover:underline"
                >
                  view SKILL.md ↗
                </a>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {(install.isError || uninstall.isError) && (
        <p className="font-mono text-[11px] text-error" role="alert">
          {String((install.error ?? uninstall.error) as Error)}
        </p>
      )}
    </article>
  );
}
