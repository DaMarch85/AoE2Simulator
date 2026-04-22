'use client';

import type { LaneSegment, SimulationRun } from '@/lib/sim/schema';
import { formatClock } from '@/lib/utils';

const LABEL_WIDTH = 148;
const CONTENT_WIDTH = 1000;
const CONTENT_PADDING = 16;

function laneWidth(totalTime: number, startSec: number, endSec: number) {
  const safeTotal = Math.max(1, totalTime);
  const left = (startSec / safeTotal) * 100;
  const width = ((endSec - startSec) / safeTotal) * 100;
  return {
    left: `${left}%`,
    width: `${Math.max(width, 0.75)}%`,
  };
}

function buildPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
}

function segmentColor(segment: LaneSegment) {
  if (segment.state === 'training') return 'bg-emerald-500/75';
  if (segment.state === 'researching') return 'bg-violet-500/75';
  if (segment.state === 'building') return 'bg-sky-500/75';
  if (segment.state === 'walking') return 'bg-slate-500/80';
  if (segment.state === 'idle') return 'bg-slate-700/65';
  return 'bg-slate-600/70';
}

function villagerSegmentColor(segment: LaneSegment) {
  const label = segment.label.toLowerCase();
  if (segment.state === 'walking') return 'bg-slate-500/80';
  if (segment.state === 'building') return 'bg-sky-500/75';
  if (segment.state === 'idle') return 'bg-slate-700/70';
  if (label.includes('wood')) return 'bg-amber-600/75';
  if (label.includes('gold')) return 'bg-yellow-400/80 text-slate-950';
  if (label.includes('stone')) return 'bg-slate-400/80 text-slate-950';
  if (label.includes('berries')) return 'bg-lime-500/80 text-slate-950';
  if (label.includes('boar') || label.includes('deer')) return 'bg-emerald-600/75';
  if (label.includes('farm')) return 'bg-green-500/80 text-slate-950';
  return 'bg-green-600/75';
}

function ageSegments(run: SimulationRun) {
  const totalTime = run.keyframes[run.keyframes.length - 1]?.timeSec ?? 1;
  const points = run.keyframes.map((frame) => ({ timeSec: frame.timeSec, age: frame.age }));
  const segments: Array<{ label: string; startSec: number; endSec: number }> = [];
  let currentAge = points[0]?.age ?? 'dark';
  let startSec = 0;

  for (const point of points) {
    if (point.age !== currentAge) {
      segments.push({
        label: `${currentAge[0]?.toUpperCase()}${currentAge.slice(1)} Age`,
        startSec,
        endSec: point.timeSec,
      });
      currentAge = point.age;
      startSec = point.timeSec;
    }
  }

  segments.push({
    label: `${currentAge[0]?.toUpperCase()}${currentAge.slice(1)} Age`,
    startSec,
    endSec: totalTime,
  });

  return segments;
}

function splitLaneSegments(run: SimulationRun) {
  const producerGroups = new Map<string, LaneSegment[]>();
  const villagerGroups = new Map<string, LaneSegment[]>();

  for (const segment of run.laneSegments) {
    if (segment.laneId.startsWith('villager_')) {
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
        const leftId = Number(left.laneId.replace('villager_', ''));
        const rightId = Number(right.laneId.replace('villager_', ''));
        return leftId - rightId;
      }),
  };
}

function laneTitle(laneId: string) {
  switch (laneId) {
    case 'tc_1':
      return 'Town Center';
    case 'archery_range_1':
      return 'Archery Range';
    case 'construction_main':
      return 'Construction';
    case 'construction_auto':
      return 'Houses';
    default:
      return laneId.replaceAll('_', ' ');
  }
}

function villagerLabel(laneId: string) {
  return `Villager ${laneId.replace('villager_', '')}`;
}

function ecoSeries(run: SimulationRun) {
  return run.keyframes.map((frame) => ({
    timeSec: frame.timeSec,
    food: (frame.tasks.sheep ?? 0) + (frame.tasks.boar ?? 0) + (frame.tasks.berries ?? 0) + (frame.tasks.deer ?? 0) + (frame.tasks.farms ?? 0),
    wood: frame.tasks.wood ?? 0,
    gold: frame.tasks.gold ?? 0,
    stone: frame.tasks.stone ?? 0,
    other: (frame.tasks.build ?? 0) + (frame.tasks.walk ?? 0),
  }));
}

function EcoChart({ run, cursorTime }: { run: SimulationRun; cursorTime: number }) {
  const width = CONTENT_WIDTH;
  const height = 220;
  const padding = CONTENT_PADDING;
  const totalTime = run.keyframes[run.keyframes.length - 1]?.timeSec ?? 1;
  const series = ecoSeries(run);
  const maxValue = Math.max(1, ...series.flatMap((point) => [point.food, point.wood, point.gold, point.stone, point.other]));
  const cursorX = padding + (cursorTime / totalTime) * (width - padding * 2);
  const colors = {
    food: '#22c55e',
    wood: '#f59e0b',
    gold: '#facc15',
    stone: '#94a3b8',
    other: '#a78bfa',
  } as const;

  const pathFor = (key: keyof typeof colors) =>
    buildPath(
      series.map((point) => ({
        x: padding + (point.timeSec / totalTime) * (width - padding * 2),
        y: height - padding - (point[key] / maxValue) * (height - padding * 2),
      })),
    );

  return (
    <div className="overflow-hidden border border-slate-800/70 bg-slate-950/40">
      <div className="border-b border-slate-800/70 px-3 py-2 text-xs text-slate-400">
        Food, wood, gold, stone, and other workers (build + walk).
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
        <rect x="0" y="0" width={width} height={height} fill="rgba(2, 6, 23, 0.35)" />
        {Array.from({ length: 5 }).map((_, index) => {
          const y = padding + ((height - padding * 2) / 4) * index;
          return (
            <line
              key={index}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="rgba(148, 163, 184, 0.12)"
              strokeDasharray="4 6"
            />
          );
        })}
        {Object.entries(colors).map(([key, color]) => (
          <path key={key} d={pathFor(key as keyof typeof colors)} fill="none" stroke={color} strokeWidth="2.5" />
        ))}
        <line x1={cursorX} y1={padding} x2={cursorX} y2={height - padding} stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" />
      </svg>
      <div className="flex flex-wrap gap-2 border-t border-slate-800/70 px-3 py-2 text-xs text-slate-300">
        {Object.entries(colors).map(([key, color]) => (
          <span className="badge" key={key}>
            <span className="inline-block h-2 w-2" style={{ backgroundColor: color }} /> {key}
          </span>
        ))}
      </div>
    </div>
  );
}

function Axis({ totalTime, cursorTime }: { totalTime: number; cursorTime: number }) {
  return (
    <div className="relative h-12 overflow-hidden border border-slate-800/70 bg-slate-950/40">
      {Array.from({ length: Math.floor(totalTime / 60) + 1 }).map((_, index) => {
        const left = ((index * 60) / totalTime) * 100;
        return (
          <div key={index} className="absolute inset-y-0" style={{ left: `${left}%` }}>
            <div className="h-full w-px bg-slate-700/60" />
            <div className="-translate-x-1/2 pt-1 text-[10px] text-slate-500">{formatClock(index * 60)}</div>
          </div>
        );
      })}
      <div className="pointer-events-none absolute inset-y-0 w-px bg-white/80" style={{ left: `${(cursorTime / totalTime) * 100}%` }} />
    </div>
  );
}

function BarLane({
  totalTime,
  cursorTime,
  segments,
  colorFn,
  belowLabels = false,
}: {
  totalTime: number;
  cursorTime: number;
  segments: LaneSegment[];
  colorFn: (segment: LaneSegment) => string;
  belowLabels?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="relative h-12 overflow-hidden border border-slate-800/70 bg-slate-950/40">
        {segments.map((segment) => (
          <button
            type="button"
            key={`${segment.laneId}-${segment.startSec}-${segment.endSec}-${segment.label}`}
            className={`absolute inset-y-1 overflow-hidden px-2 text-left text-[11px] font-medium text-white ${colorFn(segment)}`}
            style={laneWidth(totalTime, segment.startSec, segment.endSec)}
            title={`${segment.label} (${formatClock(segment.startSec)}–${formatClock(segment.endSec)})`}
          >
            {!belowLabels ? <span className="truncate">{segment.label}</span> : null}
          </button>
        ))}
        <div className="pointer-events-none absolute inset-y-0 w-px bg-white/80" style={{ left: `${(cursorTime / totalTime) * 100}%` }} />
      </div>
      {belowLabels ? (
        <div className="relative h-5 text-[10px] text-slate-400">
          {segments.map((segment) => (
            <div
              key={`${segment.laneId}-label-${segment.startSec}-${segment.endSec}`}
              className="absolute truncate"
              style={laneWidth(totalTime, segment.startSec, segment.endSec)}
              title={segment.label}
            >
              {segment.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
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
      <div className="mb-4 flex flex-col gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Timeline</h2>
          <p className="text-sm text-slate-400">Cursor-aligned swimlanes for ages, eco, producers, and individual villagers.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: `${LABEL_WIDTH}px minmax(0, 1fr)` }}>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Cursor</div>
          <div className="flex items-center gap-3">
            <input
              className="w-full accent-violet-400"
              type="range"
              min={0}
              max={totalTime}
              step={1}
              value={cursorTime}
              onChange={(event) => onCursorChange(Number(event.target.value))}
            />
            <span className="min-w-14 text-right text-sm text-slate-100">{formatClock(cursorTime)}</span>
          </div>

          <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Time</div>
          <Axis totalTime={totalTime} cursorTime={cursorTime} />

          <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Age</div>
          <div className="relative h-12 overflow-hidden border border-slate-800/70 bg-slate-950/40">
            {ages.map((segment) => (
              <div
                key={`${segment.label}-${segment.startSec}`}
                className="absolute inset-y-1 border border-violet-400/20 bg-violet-500/20 px-3 py-2 text-xs font-medium text-violet-100"
                style={laneWidth(totalTime, segment.startSec, segment.endSec)}
              >
                {segment.label}
              </div>
            ))}
            <div className="pointer-events-none absolute inset-y-0 w-px bg-white/80" style={{ left: `${(cursorTime / totalTime) * 100}%` }} />
          </div>

          <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Eco workers</div>
          <EcoChart run={run} cursorTime={cursorTime} />

          {producerGroups.map((group) => {
            const belowLabels = group.laneId === 'construction_main' || group.laneId === 'construction_auto';
            return (
              <div key={group.laneId} className="contents">
                <div className="pt-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  {laneTitle(group.laneId)}
                </div>
                <div>
                  <BarLane
                    totalTime={totalTime}
                    cursorTime={cursorTime}
                    segments={group.segments}
                    colorFn={segmentColor}
                    belowLabels={belowLabels}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <details className="panel-subtle p-4">
          <summary className="cursor-pointer select-none">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Individual villagers</h3>
                <p className="text-xs text-slate-400">Expand to inspect one horizontal timeline per villager.</p>
              </div>
              <span className="badge">{villagerGroups.length} lanes</span>
            </div>
          </summary>

          <div className="mt-4 max-h-[720px] space-y-2 overflow-auto pr-1">
            {villagerGroups.map((group) => (
              <div key={group.laneId} className="grid gap-2" style={{ gridTemplateColumns: `${LABEL_WIDTH}px minmax(0, 1fr)` }}>
                <div className="pt-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{villagerLabel(group.laneId)}</div>
                <BarLane totalTime={totalTime} cursorTime={cursorTime} segments={group.segments} colorFn={villagerSegmentColor} />
              </div>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}
