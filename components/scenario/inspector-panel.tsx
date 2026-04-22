'use client';

import type { Keyframe, LaneSegment, SimulationRun } from '@/lib/sim/schema';
import { formatClock } from '@/lib/utils';

function closestKeyframe(run: SimulationRun, timeSec: number): Keyframe {
  return run.keyframes.find((frame) => frame.timeSec >= timeSec) ?? run.keyframes[run.keyframes.length - 1];
}

function row(label: string, value: string | number) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}

function activeVillagerSegments(run: SimulationRun, timeSec: number) {
  return run.laneSegments
    .filter((segment) => segment.laneId.startsWith('villager_'))
    .filter((segment) => segment.startSec <= timeSec && segment.endSec >= timeSec)
    .sort((left, right) => {
      const leftId = Number(left.laneId.replace('villager_', ''));
      const rightId = Number(right.laneId.replace('villager_', ''));
      return leftId - rightId;
    })
    .map((segment) => ({
      id: segment.laneId.replace('villager_', ''),
      label: segment.label,
      state: segment.state,
    }));
}

function villagerCardClass(segment: Pick<LaneSegment, 'state'> | { state?: string }) {
  if (segment.state === 'walking') return 'border-slate-600/60 bg-slate-900/60';
  if (segment.state === 'building') return 'border-sky-500/40 bg-sky-500/10';
  if (segment.state === 'idle') return 'border-slate-700/60 bg-slate-900/70';
  return 'border-slate-700/60 bg-slate-900/50';
}

function ageLabel(value: string) {
  return value[0]?.toUpperCase() + value.slice(1);
}

export function InspectorPanel({ run, cursorTime }: { run: SimulationRun; cursorTime: number }) {
  const frame = closestKeyframe(run, cursorTime);
  const warnings = run.warnings.slice(0, 4);
  const villagers = activeVillagerSegments(run, cursorTime);
  const foodWorkers = (frame.tasks.sheep ?? 0) + (frame.tasks.boar ?? 0) + (frame.tasks.berries ?? 0) + (frame.tasks.deer ?? 0) + (frame.tasks.farms ?? 0);

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
            {row('Food', Math.round(frame.stockpile.food))}
            {row('Wood', Math.round(frame.stockpile.wood))}
            {row('Gold', Math.round(frame.stockpile.gold))}
            {row('Stone', Math.round(frame.stockpile.stone))}
          </div>
        </section>

        <section className="panel-subtle p-3">
          <h3 className="text-sm font-semibold text-slate-200">Starting food remaining</h3>
          <div className="mt-3 space-y-2">
            {row('Sheep', Math.round(frame.resourcePools.sheep ?? 0))}
            {row('Boar', Math.round(frame.resourcePools.boar ?? 0))}
            {row('Berries', Math.round(frame.resourcePools.berries ?? 0))}
            {row('Deer', Math.round(frame.resourcePools.deer ?? 0))}
            {row('Farm food', Math.round(frame.resourcePools.farms ?? 0))}
          </div>
        </section>

        <section className="panel-subtle p-3">
          <h3 className="text-sm font-semibold text-slate-200">Population</h3>
          <div className="mt-3 space-y-2">
            {row('Age', ageLabel(frame.age))}
            {row('Villagers', frame.units.villager ?? 0)}
            {row('Archers', frame.units.archer ?? 0)}
            {row('Population', frame.population)}
            {row('Pop cap', frame.popCap)}
          </div>
        </section>

        <section className="panel-subtle p-3">
          <h3 className="text-sm font-semibold text-slate-200">Villager tasks</h3>
          <div className="mt-3 space-y-2">
            {row('Food', foodWorkers)}
            {row('Wood', frame.tasks.wood ?? 0)}
            {row('Gold', frame.tasks.gold ?? 0)}
            {row('Stone', frame.tasks.stone ?? 0)}
            {row('Walking', frame.tasks.walk ?? 0)}
            {row('Building', frame.tasks.build ?? 0)}
          </div>
        </section>

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
