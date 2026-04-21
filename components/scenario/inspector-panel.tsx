"use client";

import type { Keyframe, LaneSegment, SimulationRun } from "@/lib/sim/schema";
import { formatClock } from "@/lib/utils";

function closestKeyframe(run: SimulationRun, timeSec: number): Keyframe {
  return run.keyframes.find((frame) => frame.timeSec >= timeSec) ?? run.keyframes[run.keyframes.length - 1];
}

function taskLine(label: string, value: string | number) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}

function ageLabel(value: string) {
  return value[0]?.toUpperCase() + value.slice(1);
}

function activeVillagerSegments(run: SimulationRun, timeSec: number) {
  const items = run.laneSegments
    .filter((segment) => segment.laneId.startsWith("villager_"))
    .filter((segment) => segment.startSec <= timeSec && segment.endSec >= timeSec)
    .sort((left, right) => {
      const leftId = Number(left.laneId.replace("villager_", ""));
      const rightId = Number(right.laneId.replace("villager_", ""));
      return leftId - rightId;
    });

  return items.map((segment) => ({
    id: segment.laneId.replace("villager_", ""),
    label: segment.label,
    state: segment.state,
  }));
}

function villagerCardClass(segment: Pick<LaneSegment, "state"> | { state?: string }) {
  if (segment.state === "walking") return "border-slate-600/60 bg-slate-900/60";
  if (segment.state === "building") return "border-sky-500/40 bg-sky-500/10";
  return "border-slate-700/60 bg-slate-900/50";
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
  const villagers = activeVillagerSegments(run, cursorTime);
  const foodWorkers =
    (frame.tasks.sheep ?? 0) +
    (frame.tasks.boar ?? 0) +
    (frame.tasks.berries ?? 0) +
    (frame.tasks.farms ?? 0);
  const reserveFood = frame.reserved.food ?? 0;
  const reserveGold = frame.reserved.gold ?? 0;

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
            {taskLine("Age", ageLabel(frame.age))}
            {taskLine("Villagers", frame.units.villager ?? 0)}
            {taskLine("Archers", frame.units.archer ?? 0)}
            {taskLine("Population", frame.population)}
            {taskLine("Pop cap", frame.popCap)}
          </div>
        </section>

        <section className="panel-subtle p-3">
          <h3 className="text-sm font-semibold text-slate-200">Villager tasks</h3>
          <div className="mt-3 space-y-2">
            {taskLine("Food", foodWorkers)}
            {taskLine("Wood", frame.tasks.wood ?? 0)}
            {taskLine("Gold", frame.tasks.gold ?? 0)}
            {taskLine("Stone", frame.tasks.stone ?? 0)}
            {taskLine("Walking", frame.tasks.walk ?? 0)}
            {taskLine("Building", frame.tasks.build ?? 0)}
          </div>
        </section>

        {reserveFood > 0 || reserveGold > 0 ? (
          <section className="panel-subtle p-3">
            <h3 className="text-sm font-semibold text-slate-200">Castle reserve</h3>
            <div className="mt-3 space-y-2">
              {taskLine("Food still needed", Math.round(reserveFood))}
              {taskLine("Gold still needed", Math.round(reserveGold))}
            </div>
          </section>
        ) : null}

        <details className="panel-subtle p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">
            Individual villagers at cursor ({villagers.length})
          </summary>
          <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
            {villagers.map((villager) => (
              <div key={villager.id} className={`border p-2 text-sm ${villagerCardClass(villager)}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-100">Villager {villager.id}</span>
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{villager.state}</span>
                </div>
                <p className="mt-1 text-slate-300">{villager.label}</p>
              </div>
            ))}
          </div>
        </details>

        <section className="panel-subtle p-3">
          <h3 className="text-sm font-semibold text-slate-200">Warnings</h3>
          <div className="mt-3 space-y-2">
            {warnings.length === 0 ? (
              <p className="text-sm text-slate-400">No active warnings for this run.</p>
            ) : (
              warnings.map((warning) => (
                <div key={warning.code} className="border border-slate-700/60 bg-slate-900/50 p-2 text-sm">
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
