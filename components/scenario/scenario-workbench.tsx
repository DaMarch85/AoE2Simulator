"use client";

import { useEffect, useMemo, useState } from "react";
import { AssumptionBar } from "./assumption-bar";
import { BuilderTabs } from "./builder-tabs";
import { InspectorPanel } from "./inspector-panel";
import { KpiBar } from "./kpi-bar";
import { ResourceGraph } from "./resource-graph";
import { TimelineViewport } from "./timeline-viewport";
import { WarningsRail } from "./warnings-rail";
import { simulateScenario } from "@/lib/sim";
import type { ResolvedScenario, Ruleset, ScenarioDraft, SimulationRun } from "@/lib/sim/schema";

type TabId = "setup" | "events" | "policies" | "questions" | "json";

function storageKey(id: string) {
  return `aoe2-build-lab:${id}`;
}

export function ScenarioWorkbench({
  initialDraft,
  ruleset,
}: {
  initialDraft: ScenarioDraft;
  ruleset: Ruleset;
}) {
  const [draft, setDraft] = useState<ScenarioDraft>(initialDraft);
  const initialResolvedAndRun = useMemo(() => simulateScenario(initialDraft, ruleset), [initialDraft, ruleset]);
  const [resolved, setResolved] = useState<ResolvedScenario>(initialResolvedAndRun.resolved);
  const [run, setRun] = useState<SimulationRun>(initialResolvedAndRun.run);
  const [activeTab, setActiveTab] = useState<TabId>("setup");
  const [cursorTime, setCursorTime] = useState<number>(0);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey(initialDraft.id));
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as ScenarioDraft;
      setDraft(parsed);
      const result = simulateScenario(parsed, ruleset);
      setResolved(result.resolved);
      setRun(result.run);
    } catch {
      // Ignore broken local drafts and fall back to the fixture.
    }
  }, [initialDraft.id, ruleset]);

  useEffect(() => {
    window.localStorage.setItem(storageKey(draft.id), JSON.stringify(draft));
  }, [draft]);

  const handleDraftChange = (nextDraft: ScenarioDraft) => {
    setDraft(nextDraft);
    setIsDirty(true);
  };

  const handleRun = () => {
    const result = simulateScenario(draft, ruleset);
    setResolved(result.resolved);
    setRun(result.run);
    setCursorTime(0);
    setIsDirty(false);
  };

  const totalTime = run.keyframes[run.keyframes.length - 1]?.timeSec ?? 0;

  return (
    <div className="space-y-4">
      <header className="panel p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">AoE2 Build Lab</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-50">{draft.name}</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-300">{draft.prompt}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={isDirty ? "badge badge-warning" : "badge badge-success"}>
              {isDirty ? "Draft changed" : "Run up to date"}
            </span>
            <button
              type="button"
              onClick={() => {
                setDraft(initialDraft);
                const result = simulateScenario(initialDraft, ruleset);
                setResolved(result.resolved);
                setRun(result.run);
                setCursorTime(0);
                setIsDirty(false);
                window.localStorage.removeItem(storageKey(initialDraft.id));
              }}
              className="rounded-full border border-slate-700/70 bg-slate-900/45 px-4 py-2 text-sm text-slate-200"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleRun}
              className="rounded-full border border-violet-400/40 bg-violet-500/20 px-4 py-2 text-sm font-medium text-violet-100"
            >
              Run sim
            </button>
          </div>
        </div>
      </header>

      <AssumptionBar draft={draft} resolved={resolved} />
      <KpiBar run={run} />

      <div className="grid-board">
        <BuilderTabs
          draft={draft}
          resolved={resolved}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onDraftChange={handleDraftChange}
        />

        <div className="space-y-4">
          <TimelineViewport run={run} cursorTime={cursorTime} onCursorChange={setCursorTime} />
          <ResourceGraph run={run} cursorTime={cursorTime} />
          <WarningsRail run={run} />
        </div>

        <InspectorPanel run={run} cursorTime={cursorTime} />
      </div>

      <section className="panel-subtle p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Developer notes</h3>
            <p className="text-xs text-slate-400">
              This scaffold keeps persistence local and the engine intentionally lightweight.
            </p>
          </div>
          <span className="badge">Run length: {Math.round(totalTime / 60)}m</span>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <details className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-100">Resolved scenario JSON</summary>
            <pre className="mt-3 max-h-96 overflow-auto text-xs text-slate-300">
              {JSON.stringify(resolved, null, 2)}
            </pre>
          </details>

          <details className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-100">Run output JSON</summary>
            <pre className="mt-3 max-h-96 overflow-auto text-xs text-slate-300">
              {JSON.stringify(run, null, 2)}
            </pre>
          </details>
        </div>
      </section>
    </div>
  );
}
