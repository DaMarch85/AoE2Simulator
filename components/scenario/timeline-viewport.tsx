"use client";

import type { AllocationSegment, LaneSegment, SimulationRun } from "@/lib/sim/schema";
import { formatClock } from "@/lib/utils";

function laneWidth(totalTime: number, startSec: number, endSec: number) {
  const safeTotal = Math.max(1, totalTime);
  const left = (startSec / safeTotal) * 100;
  const width = ((endSec - startSec) / safeTotal) * 100;
  return {
    left: `${left}%`,
    width: `${Math.max(width, 1)}%`,
  };
}

function segmentColor(label: string, state: string) {
  if (state === "training") return "bg-emerald-500/60";
  if (state === "researching") return "bg-violet-500/60";
  if (state === "building") return "bg-sky-500/60";
  if (state === "blocked") return "bg-amber-500/55";
  return "bg-slate-600/60";
}

function ageSegments(run: SimulationRun) {
  const totalTime = run.keyframes[run.keyframes.length - 1]?.timeSec ?? 1;
  const points = run.keyframes.map((frame) => ({ timeSec: frame.timeSec, age: frame.age }));
  const segments: Array<{ label: string; startSec: number; endSec: number }> = [];
  let currentAge = points[0]?.age ?? "dark";
  let startSec = 0;

  for (const point of points) {
    if (point.age !== currentAge) {
      segments.push({
        label: `${currentAge[0].toUpperCase()}${currentAge.slice(1)} Age`,
        startSec,
        endSec: point.timeSec,
      });
      currentAge = point.age;
      startSec = point.timeSec;
    }
  }

  segments.push({
    label: `${currentAge[0].toUpperCase()}${currentAge.slice(1)} Age`,
    startSec,
    endSec: totalTime,
  });

  return segments;
}

function ecoSummary(segment: AllocationSegment) {
  const food = (segment.counts.sheep ?? 0) + (segment.counts.boar ?? 0) + (segment.counts.berries ?? 0) + (segment.counts.farms ?? 0);
  return `${food} food / ${segment.counts.wood ?? 0} wood / ${segment.counts.gold ?? 0} gold`;
}

function groupProducerSegments(run: SimulationRun) {
  const groups = new Map<string, SimulationRun["laneSegments"]>();

  for (const segment of run.laneSegments) {
    const current = groups.get(segment.laneId) ?? [];
    current.push(segment);
    groups.set(segment.laneId, current);
  }

  return [...groups.entries()]
    .map(([laneId, segments]) => ({ laneId, segments }))
    .sort((a, b) => a.laneId.localeCompare(b.laneId));
}

function titleForLane(laneId: string) {
  switch (laneId) {
    case "tc_1":
      return "Town Center";
    case "archery_range_1":
      return "Archery Range";
    case "construction_main":
      return "Construction";
    case "construction_auto":
      return "Auto houses";
    default:
      return laneId.replaceAll("_", " ");
  }
}

export function TimelineViewport({
  run,
  cursorTime,
  onCursorChange,
}: {
  run: SimulationRun;
  cursorTime: number;
  onCursorChange: (value: number) => void;
}) {
  const totalTime = run.keyframes[run.keyframes.length - 1]?.timeSec ?? 1;
  const groups = groupProducerSegments(run);
  const ages = ageSegments(run);

  return (
    <section className="panel p-4">
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Timeline</h2>
          <p className="text-sm text-slate-400">
            Swimlanes for age progression, eco allocation, and producer activity.
          </p>
        </div>
        <div className="flex w-full max-w-xl items-center gap-3">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Cursor</span>
          <input
            className="w-full accent-violet-400"
            type="range"
            min={0}
            max={totalTime}
            step={5}
            value={cursorTime}
            onChange={(event) => onCursorChange(Number(event.target.value))}
          />
          <span className="min-w-14 text-right text-sm text-slate-100">{formatClock(cursorTime)}</span>
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/35 p-4">
          <div className="mb-2 flex justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
            <span>Time</span>
            <span>{formatClock(totalTime)}</span>
          </div>
          <div className="relative h-10 rounded-xl bg-slate-900/50">
            {Array.from({ length: Math.floor(totalTime / 60) + 1 }).map((_, index) => {
              const left = (index * 60 / totalTime) * 100;
              return (
                <div key={index} className="absolute inset-y-0" style={{ left: `${left}%` }}>
                  <div className="h-full w-px bg-slate-700/60" />
                  <div className="-translate-x-1/2 pt-1 text-[10px] text-slate-500">{formatClock(index * 60)}</div>
                </div>
              );
            })}
            <div
              className="pointer-events-none absolute inset-y-0 w-px bg-white/80"
              style={{ left: `${(cursorTime / totalTime) * 100}%` }}
            />
          </div>
        </div>

        <div className="grid gap-3">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-200">Age</span>
              <span className="text-xs text-slate-400">Reached age bands</span>
            </div>
            <div className="relative h-12 rounded-2xl bg-slate-900/55">
              {ages.map((segment) => (
                <div
                  key={`${segment.label}-${segment.startSec}`}
                  className="absolute inset-y-2 rounded-xl border border-violet-400/20 bg-violet-500/20 px-3 py-2 text-xs font-medium text-violet-100"
                  style={laneWidth(totalTime, segment.startSec, segment.endSec)}
                  title={segment.label}
                >
                  {segment.label}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-200">Eco allocation</span>
              <span className="text-xs text-slate-400">Grouped villager counts</span>
            </div>
            <div className="relative h-14 rounded-2xl bg-slate-900/55">
              {run.allocationSegments.map((segment: AllocationSegment) => (
                <div
                  key={`${segment.startSec}-${segment.endSec}`}
                  className="absolute inset-y-2 overflow-hidden rounded-xl border border-sky-400/20 bg-sky-500/20 px-3 py-2 text-[11px] font-medium text-sky-100"
                  style={laneWidth(totalTime, segment.startSec, segment.endSec)}
                  title={ecoSummary(segment)}
                >
                  <span className="truncate">{ecoSummary(segment)}</span>
                </div>
              ))}
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.laneId}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-200">{titleForLane(group.laneId)}</span>
                <span className="text-xs text-slate-400">{group.segments.length} segment(s)</span>
              </div>
              <div className="relative h-14 rounded-2xl bg-slate-900/55">
                {group.segments.map((segment: LaneSegment) => (
                  <button
                    type="button"
                    key={`${group.laneId}-${segment.startSec}-${segment.endSec}`}
                    className={`absolute inset-y-2 overflow-hidden rounded-xl px-3 py-2 text-left text-[11px] font-medium text-white ${segmentColor(segment.label, segment.state)}`}
                    style={laneWidth(totalTime, segment.startSec, segment.endSec)}
                    onClick={() => onCursorChange(segment.startSec)}
                    title={`${segment.label} (${formatClock(segment.startSec)}–${formatClock(segment.endSec)})`}
                  >
                    <span className="truncate">{segment.label}</span>
                  </button>
                ))}
                <div
                  className="pointer-events-none absolute inset-y-0 w-px bg-white/80"
                  style={{ left: `${(cursorTime / totalTime) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
