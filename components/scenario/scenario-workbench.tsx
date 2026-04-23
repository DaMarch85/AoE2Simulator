'use client';

import { useEffect, useState } from 'react';
import { AssumptionBar } from './assumption-bar';
import { BuildOrderPanel } from './build-order-panel';
import { CollectionRatePanel } from './collection-rate-panel';
import { InspectorPanel } from './inspector-panel';
import { KpiBar } from './kpi-bar';
import { ResourceGraph } from './resource-graph';
import { TimelineViewport } from './timeline-viewport';
import { UnitCountGraph } from './unit-count-graph';
import { WarningsRail } from './warnings-rail';
import { simulateScenario } from '@/lib/sim';
import {
  createDefaultBuildOrder,
  type ResolvedScenario,
  type Ruleset,
  type ScenarioDraft,
  type SimulationRun,
  ScenarioDraftSchema,
} from '@/lib/sim/schema';

function storageKey(id: string) {
  return `aoe2-build-lab:${id}`;
}

function withBuildOrderFallback(draft: ScenarioDraft, ruleset: Ruleset) {
  if (draft.buildOrder) {
    return draft;
  }

  return {
    ...draft,
    buildOrder: createDefaultBuildOrder(ruleset.startingVillagers),
  };
}

export function ScenarioWorkbench({
  initialDraft,
  ruleset,
}: {
  initialDraft: ScenarioDraft;
  ruleset: Ruleset;
}) {
  const initialEditorDraft = withBuildOrderFallback(initialDraft, ruleset);
  const [draft, setDraft] = useState<ScenarioDraft>(initialEditorDraft);
  const [resolved, setResolved] = useState<ResolvedScenario | null>(null);
  const [run, setRun] = useState<SimulationRun | null>(null);
  const [cursorTime, setCursorTime] = useState<number>(0);
  const [isDirty, setIsDirty] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey(initialDraft.id));
    if (!raw) return;

    try {
      const parsed = withBuildOrderFallback(ScenarioDraftSchema.parse(JSON.parse(raw)), ruleset);
      setDraft(parsed);
    } catch {
      // Ignore broken or stale local drafts and fall back to the fixture.
    }
  }, [initialDraft.id, ruleset]);

  useEffect(() => {
    window.localStorage.setItem(storageKey(draft.id), JSON.stringify(draft));
  }, [draft]);

  const handleDraftChange = (nextDraft: ScenarioDraft) => {
    setDraft(withBuildOrderFallback(nextDraft, ruleset));
    setIsDirty(true);
  };

  const handleRun = () => {
    const normalizedDraft = withBuildOrderFallback(ScenarioDraftSchema.parse(draft), ruleset);
    const result = simulateScenario(normalizedDraft, ruleset);
    setDraft(normalizedDraft);
    setResolved(result.resolved);
    setRun(result.run);
    setCursorTime(0);
    setIsDirty(false);
    setHasRun(true);
  };

  return (
    <div className="space-y-4">
      <header className="panel p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">AoE2 Build Lab</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-50">{draft.name}</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-300">
              Author the build order in the left panel, then click Run simulation to populate the dashboard.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={isDirty ? 'badge badge-warning' : 'badge badge-success'}>
              {isDirty ? 'Unsimulated changes' : hasRun ? 'Run up to date' : 'Not simulated yet'}
            </span>
            <button
              type="button"
              onClick={() => {
                const resetDraft = withBuildOrderFallback(initialDraft, ruleset);
                setDraft(resetDraft);
                setResolved(null);
                setRun(null);
                setCursorTime(0);
                setIsDirty(false);
                setHasRun(false);
                window.localStorage.removeItem(storageKey(initialDraft.id));
              }}
              className="border border-slate-700/70 bg-slate-900/45 px-4 py-2 text-sm text-slate-200"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleRun}
              className="border border-violet-400/40 bg-violet-500/20 px-4 py-2 text-sm font-medium text-violet-100"
            >
              Run simulation
            </button>
          </div>
        </div>
      </header>

      <AssumptionBar draft={draft} resolved={resolved} />
      {hasRun && run ? <KpiBar run={run} /> : null}

      <div className="grid-board">
        <BuildOrderPanel draft={draft} ruleset={ruleset} onDraftChange={handleDraftChange} />

        <div className="space-y-4">
          {hasRun && run ? (
            <>
              <TimelineViewport run={run} cursorTime={cursorTime} onCursorChange={setCursorTime} />
              <ResourceGraph run={run} cursorTime={cursorTime} />
              <UnitCountGraph run={run} cursorTime={cursorTime} />
              <CollectionRatePanel ruleset={ruleset} />
              <WarningsRail run={run} />
            </>
          ) : (
            <section className="panel p-8">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Simulation output</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-50">Run the build to populate the dashboard</h2>
              <p className="mt-3 max-w-2xl text-sm text-slate-300">
                The timeline, stockpile charts, cumulative unit graph, and warnings will appear here after you queue villagers, military units, technologies, and buildings and then click Run simulation.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="stat-card">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">1</p>
                  <p className="mt-2 text-sm text-slate-200">Set starting villagers and TC queue</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">2</p>
                  <p className="mt-2 text-sm text-slate-200">Add military, tech, and building rows</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">3</p>
                  <p className="mt-2 text-sm text-slate-200">Click Run simulation</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">4</p>
                  <p className="mt-2 text-sm text-slate-200">Inspect timings, bottlenecks, and unit counts</p>
                </div>
              </div>
            </section>
          )}
        </div>

        {hasRun && run ? (
          <InspectorPanel run={run} cursorTime={cursorTime} />
        ) : (
          <section className="panel-subtle p-4">
            <h3 className="text-sm font-semibold text-slate-100">Inspector</h3>
            <p className="mt-2 text-sm text-slate-400">The right-hand inspector activates after the first simulation run.</p>
          </section>
        )}
      </div>

      {hasRun && resolved && run ? (
        <section className="panel-subtle p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Simulation internals</h3>
              <p className="text-xs text-slate-400">Useful while the MVP editor and compiler are still evolving.</p>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <details className="border border-slate-700/70 bg-slate-950/45 p-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-100">Resolved scenario JSON</summary>
              <pre className="mt-3 max-h-96 overflow-auto text-xs text-slate-300">
                {JSON.stringify(resolved, null, 2)}
              </pre>
            </details>

            <details className="border border-slate-700/70 bg-slate-950/45 p-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-100">Run output JSON</summary>
              <pre className="mt-3 max-h-96 overflow-auto text-xs text-slate-300">
                {JSON.stringify(run, null, 2)}
              </pre>
            </details>
          </div>
        </section>
      ) : null}
    </div>
  );
}
