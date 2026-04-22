'use client';

import type { SimulationRun } from '@/lib/sim/schema';
import { formatClock } from '@/lib/utils';

const UNIT_COLORS: Record<string, string> = {
  villager: '#10b981',
  archer: '#60a5fa',
  scout_cavalry: '#f59e0b',
};

function buildPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
}

function labelForUnit(unitId: string) {
  return unitId.replaceAll('_', ' ');
}

export function UnitCountGraph({ run, cursorTime }: { run: SimulationRun; cursorTime: number }) {
  const width = 1000;
  const height = 280;
  const padding = 32;
  const totalTime = run.keyframes[run.keyframes.length - 1]?.timeSec ?? 1;

  const unitIds = Array.from(
    new Set(
      run.keyframes.flatMap((frame) => Object.keys(frame.units)).filter((unitId) => run.keyframes.some((frame) => (frame.units[unitId] ?? 0) > 0)),
    ),
  );

  const maxUnits = Math.max(1, ...run.keyframes.flatMap((frame) => unitIds.map((unitId) => frame.units[unitId] ?? 0)));
  const cursorX = padding + (cursorTime / totalTime) * (width - padding * 2);

  return (
    <div className="panel-subtle p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Cumulative units built</h3>
          <p className="text-xs text-slate-400">Villagers, archers, and any other produced unit totals over time.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unitIds.map((unitId) => (
            <span className="badge" key={unitId}>
              <span className="inline-block h-2 w-2" style={{ backgroundColor: UNIT_COLORS[unitId] ?? '#e2e8f0' }} /> {labelForUnit(unitId)}
            </span>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full">
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
              stroke="rgba(148, 163, 184, 0.15)"
              strokeDasharray="4 6"
            />
          );
        })}

        {unitIds.map((unitId) => {
          const points = run.keyframes.map((frame) => {
            const x = padding + (frame.timeSec / totalTime) * (width - padding * 2);
            const y = height - padding - ((frame.units[unitId] ?? 0) / maxUnits) * (height - padding * 2);
            return { x, y };
          });

          return <path key={unitId} d={buildPath(points)} fill="none" stroke={UNIT_COLORS[unitId] ?? '#e2e8f0'} strokeWidth="2.5" />;
        })}

        <line x1={cursorX} y1={padding} x2={cursorX} y2={height - padding} stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" />
        <text x={cursorX + 8} y={padding + 16} fill="white" fontSize="12">
          {formatClock(cursorTime)}
        </text>
      </svg>
    </div>
  );
}
