"use client";

import type { SimulationRun } from "@/lib/sim/schema";
import { formatClock } from "@/lib/utils";

const resources = ["food", "wood", "gold", "stone"] as const;
type ResourceKey = (typeof resources)[number];

const COLORS: Record<ResourceKey, string> = {
  food: "#22c55e",
  wood: "#f59e0b",
  gold: "#facc15",
  stone: "#94a3b8",
};

function buildPath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

export function ResourceGraph({
  run,
  cursorTime,
}: {
  run: SimulationRun;
  cursorTime: number;
}) {
  const width = 900;
  const height = 220;
  const padding = 24;
  const totalTime = run.keyframes[run.keyframes.length - 1]?.timeSec ?? 1;
  const maxResource = Math.max(
    1,
    ...run.keyframes.flatMap((frame) => [
      frame.stockpile.food,
      frame.stockpile.wood,
      frame.stockpile.gold,
      frame.stockpile.stone,
    ]),
  );

  const cursorX = padding + (cursorTime / totalTime) * (width - padding * 2);

  return (
    <div className="panel-subtle p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Resources over time</h3>
          <p className="text-xs text-slate-400">Banked stockpiles for the active run.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {resources.map((resource) => (
            <span className="badge" key={resource}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[resource] }} />{" "}
              {resource}
            </span>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
        <rect x="0" y="0" width={width} height={height} rx="16" fill="rgba(2, 6, 23, 0.35)" />
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

        {resources.map((resource) => {
          const points = run.keyframes.map((frame) => {
            const x = padding + (frame.timeSec / totalTime) * (width - padding * 2);
            const y =
              height - padding - (frame.stockpile[resource] / maxResource) * (height - padding * 2);
            return { x, y };
          });

          return (
            <path
              key={resource}
              d={buildPath(points)}
              fill="none"
              stroke={COLORS[resource]}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          );
        })}

        <line
          x1={cursorX}
          y1={padding}
          x2={cursorX}
          y2={height - padding}
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="1.5"
        />

        <text x={cursorX + 8} y={padding + 16} fill="white" fontSize="12">
          {formatClock(cursorTime)}
        </text>
      </svg>
    </div>
  );
}
