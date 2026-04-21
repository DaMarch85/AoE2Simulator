"use client";

import type { Keyframe, SimulationRun } from "@/lib/sim/schema";
import { formatClock } from "@/lib/utils";

function closestKeyframe(run: SimulationRun, timeSec: number): Keyframe {
  return (
    run.keyframes.find((frame) => frame.timeSec >= timeSec) ??
    run.keyframes[run.keyframes.length - 1]
  );
}

function taskLine(label: string, value: string | number) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}

export function InspectorPanel({
  run,
  cursorTime,
}: {
  run: SimulationRun;
  cursorTime: number;
}) {
  const frame = closestKeyframe(run, cursorTime);
  const warnings = run.warnings.slice(0, 3);

  return (
    <aside className="panel p-4">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Inspector</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-50">{formatClock(frame.timeSec)}</h2>
      </div>

      <div className="space-y-4">
        <section className="panel-subtle p-3">
          <h3 className="text-sm font-semibold text-slate-200">Resources</h3>
          <div className="mt-3 space-y-2">
            {taskLine("Food", Math.round(frame.stockpile.food))}
            {taskLine("Wood", Math.round(frame.stockpile.wood))}
            {taskLine("Gold", Math.round(frame.stockpile.gold))}
            {taskLine("Stone", Math.round(frame.stockpile.stone))}
          </div>
        </section>

        <section className="panel-subtle p-3">
          <h3 className="text-sm font-semibold text-slate-200">Population</h3>
          <div className="mt-3 space-y-2">
            {taskLine("Age", frame.age)}
            {taskLine("Villagers", frame.units.villager ?? 0)}
            {taskLine("Archers", frame.units.archer ?? 0)}
            {taskLine("Population", frame.population)}
            {taskLine("Pop cap", frame.popCap)}
          </div>
        </section>

        <section className="panel-subtle p-3">
          <h3 className="text-sm font-semibold text-slate-200">Villager tasks</h3>
          <div className="mt-3 space-y-2">
            {taskLine("Food", (frame.tasks.sheep ?? 0) + (frame.tasks.boar ?? 0) + (frame.tasks.berries ?? 0) + (frame.tasks.farms ?? 0))}
            {taskLine("Wood", frame.tasks.wood ?? 0)}
            {taskLine("Gold", frame.tasks.gold ?? 0)}
            {taskLine("Building", frame.tasks.build ?? 0)}
          </div>
        </section>

        <section className="panel-subtle p-3">
          <h3 className="text-sm font-semibold text-slate-200">Warnings</h3>
          <div className="mt-3 space-y-2">
            {warnings.length === 0 ? (
              <p className="text-sm text-slate-400">No active warnings for this run.</p>
            ) : (
              warnings.map((warning) => (
                <div key={warning.code} className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-2 text-sm">
                  <p className="font-medium text-slate-100">{warning.message}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
