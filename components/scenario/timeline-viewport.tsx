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

function producerSegmentColor(segment: LaneSegment) {
  if (segment.state === "training") return "bg-emerald-500/60";
  if (segment.state === "researching") return "bg-violet-500/60";
  if (segment.state === "building") return "bg-sky-500/60";
  if (segment.state === "blocked") return "bg-amber-500/55";
  return "bg-slate-600/60";
}

function villagerSegmentColor(segment: LaneSegment) {
  if (segment.state === "building") return "bg-sky-500/60";
  if (segment.state === "walking") return "bg-slate-500/70";
  if (segment.state === "idle") return "bg-slate-700/70";

  const label = segment.label.toLowerCase();
  if (label.includes("wood")) return "bg-amber-600/70";
  if (label.includes("gold")) return "bg-yellow-400/70 text-slate-950";
  if (label.includes("stone")) return "bg-slate-400/70 text-slate-950";
  if (label.includes("boar")) return "bg-emerald-600/70";
  if (label.includes("berries")) return "bg-lime-500/70 text-slate-950";
  if (label.includes("farm")) return "bg-green-500/70 text-slate-950";
  return "bg-green-600/70";
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
  const food =
    (segment.counts.sheep ?? 0) +
    (segment.counts.boar ?? 0) +
    (segment.counts.berries ?? 0) +
    (segment.counts.farms ?? 0);
  return `${food} food / ${segment.counts.wood ?? 0} wood / ${segment.counts.gold ?? 0} gold`;
}

function splitLaneSegments(run: SimulationRun) {
  const producerGroups = new Map<string, LaneSegment[]>();
  const villagerGroups = new Map<string, LaneSegment[]>();

  for (const segment of run.laneSegments) {
    if (segment.laneId.startsWith("villager_")) {
      const current = villagerGroups.get(segment.laneId) ?? [];
      current.push(segment);
      villagerGroups.set(segment.laneId, current);
      continue;
    }

    const current = producerGroups.get(segment.laneId) ?? [];
    current.push(segment);
    producerGroups.set(segment.laneId, current);
  }

  return {
    producerGroups: [...producerGroups.entries()]
      .map(([laneId, segments]) => ({ laneId, segments }))
      .sort((left, right) => left.laneId.localeCompare(right.laneId)),
    villagerGroups: [...villagerGroups.entries()]
      .map(([laneId, segments]) => ({ laneId, segments }))
      .sort((left, right) => {
        const leftId = Number(left.laneId.replace("villager_", ""));
        const rightId = Number(right.laneId.replace("villager_", ""));
        return leftId - rightId;
      }),
  };
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

function villagerLabel(laneId: string) {
  return `Villager ${laneId.replace("villager_", "")}`;
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
  const { producerGroups, villagerGroups } = splitLaneSegments(run);
  const ages = ageSegments(run);

  return (
    <section className="panel p-4">
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Timeline</h2>
          <p className="text-sm text-slate-400">
            Swimlanes for age progression, eco allocation, producers, and optional villager-level tracks.
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
        <div className="border border-slate-800/70 bg-slate-950/35 p-4">
          <div className="mb-2 flex justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
            <span>Time</span>
            <span>{formatClock(totalTime)}</span>
          </div>
          <div className="relative h-10 bg-slate-900/50">
            {Array.from({ length: Math.floor(totalTime / 60) + 1 }).map((_, index) => {
              const left = ((index * 60) / totalTime) * 100;
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
            <div className="relative h-12 bg-slate-900/55">
              {ages.map((segment) => (
                <div
                  key={`${segment.label}-${segment.startSec}`}
                  className="absolute inset-y-2 border border-violet-400/20 bg-violet-500/20 px-3 py-2 text-xs font-medium text-violet-100"
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
            <div className="relative h-14 bg-slate-900/55">
              {run.allocationSegments.map((segment) => (
                <div
                  key={`${segment.startSec}-${segment.endSec}`}
                  className="absolute inset-y-2 overflow-hidden border border-sky-400/20 bg-sky-500/20 px-3 py-2 text-[11px] font-medium text-sky-100"
                  style={laneWidth(totalTime, segment.startSec, segment.endSec)}
                  title={ecoSummary(segment)}
                >
                  <span className="truncate">{ecoSummary(segment)}</span>
                </div>
              ))}
            </div>
          </div>

          {producerGroups.map((group) => (
            <div key={group.laneId}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-200">{titleForLane(group.laneId)}</span>
                <span className="text-xs text-slate-400">{group.segments.length} segment(s)</span>
              </div>
              <div className="relative h-14 bg-slate-900/55">
                {group.segments.map((segment) => (
                  <button
                    type="button"
                    key={`${group.laneId}-${segment.startSec}-${segment.endSec}`}
                    className={`absolute inset-y-2 overflow-hidden px-3 py-2 text-left text-[11px] font-medium text-white ${producerSegmentColor(segment)}`}
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

        <details className="panel-subtle p-4">
          <summary className="cursor-pointer select-none">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Individual villagers</h3>
                <p className="text-xs text-slate-400">
                  Expand to inspect one horizontal timeline per villager.
                </p>
              </div>
              <span className="badge">{villagerGroups.length} lanes</span>
            </div>
          </summary>

          <div className="mt-4 max-h-[720px] space-y-2 overflow-auto pr-1">
            {villagerGroups.map((group) => (
              <div key={group.laneId} className="grid gap-2 md:grid-cols-[112px_minmax(0,1fr)] md:items-center">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  {villagerLabel(group.laneId)}
                </div>
                <div className="relative h-9 bg-slate-900/60">
                  {group.segments.map((segment) => (
                    <button
                      type="button"
                      key={`${group.laneId}-${segment.startSec}-${segment.endSec}`}
                      className={`absolute inset-y-1 overflow-hidden px-2 text-left text-[10px] font-medium text-white ${villagerSegmentColor(segment)}`}
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
        </details>
      </div>
    </section>
  );
}
