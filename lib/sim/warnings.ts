import type {
  ResolvedScenario,
  Ruleset,
  SimulationRun,
  Warning,
} from "./schema";
import { WarningSchema } from "./schema";
import type { SimulationMilestones } from "./answers";

function sumDurationsByLabel(run: SimulationRun) {
  const durations = new Map<string, number>();

  for (const segment of run.laneSegments) {
    if (segment.state !== "blocked") {
      continue;
    }

    const current = durations.get(segment.label) ?? 0;
    durations.set(segment.label, current + Math.max(0, segment.endSec - segment.startSec));
  }

  return durations;
}

export function buildWarnings(
  run: SimulationRun,
  scenario: ResolvedScenario,
  _ruleset: Ruleset,
  milestones: SimulationMilestones,
): Warning[] {
  const warnings: Warning[] = [];
  const blockedDurations = sumDurationsByLabel(run);

  for (const issue of scenario.issues) {
    warnings.push(
      WarningSchema.parse({
        code: issue.id,
        severity: issue.severity,
        message: issue.message,
      }),
    );
  }

  const rangeGoldBlock = blockedDurations.get("Missing gold") ?? 0;
  if (rangeGoldBlock > 0) {
    warnings.push(
      WarningSchema.parse({
        code: "range-missing-gold",
        severity: "info",
        message: `Range idle for about ${Math.round(rangeGoldBlock)}s because gold was short.`,
      }),
    );
  }

  const rangeReserveBlock = blockedDurations.get("Castle reserve") ?? 0;
  if (rangeReserveBlock > 0) {
    warnings.push(
      WarningSchema.parse({
        code: "range-castle-reserve",
        severity: "info",
        message: `Range queue was paused for about ${Math.round(rangeReserveBlock)}s to preserve the Castle Age click.`,
      }),
    );
  }

  const houseBlock = blockedDurations.get("Need house") ?? 0;
  if (houseBlock > 0) {
    warnings.push(
      WarningSchema.parse({
        code: "need-house",
        severity: "warning",
        message: `Population cap caused about ${Math.round(houseBlock)}s of blocked production.`,
      }),
    );
  }

  const affordable = milestones.ageAffordableAt.castle;
  const clicked = milestones.ageClickedAt.castle;
  if (affordable != null && clicked != null && clicked > affordable) {
    warnings.push(
      WarningSchema.parse({
        code: "castle-click-delayed",
        severity: "info",
        message: `Castle became affordable ${Math.round(clicked - affordable)}s before it was clicked.`,
        startSec: affordable,
        endSec: clicked,
      }),
    );
  }

  return warnings;
}
