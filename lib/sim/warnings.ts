import type { ResolvedScenario, Ruleset, SimulationRun, Warning } from './schema';
import { WarningSchema } from './schema';
import type { SimulationMilestones } from './answers';

export function buildWarnings(
  _run: SimulationRun,
  scenario: ResolvedScenario,
  _ruleset: Ruleset,
  milestones: SimulationMilestones,
  blockedDurations: Map<string, number>,
): Warning[] {
  const warnings: Warning[] = [];

  for (const issue of scenario.issues) {
    warnings.push(
      WarningSchema.parse({
        code: issue.id,
        severity: issue.severity,
        message: issue.message,
      }),
    );
  }

  const goldShort = blockedDurations.get('Missing gold') ?? 0;
  if (goldShort > 0) {
    warnings.push(
      WarningSchema.parse({
        code: 'missing-gold',
        severity: 'info',
        message: `A production queue was blocked by gold for about ${Math.round(goldShort)}s.`,
      }),
    );
  }

  const foodShort = blockedDurations.get('Missing food') ?? 0;
  if (foodShort > 0) {
    warnings.push(
      WarningSchema.parse({
        code: 'missing-food',
        severity: 'info',
        message: `A production queue was blocked by food for about ${Math.round(foodShort)}s.`,
      }),
    );
  }

  const woodShort = blockedDurations.get('Missing wood') ?? 0;
  if (woodShort > 0) {
    warnings.push(
      WarningSchema.parse({
        code: 'missing-wood',
        severity: 'info',
        message: `A production queue was blocked by wood for about ${Math.round(woodShort)}s.`,
      }),
    );
  }

  const needHouse = blockedDurations.get('Need house') ?? 0;
  if (needHouse > 0) {
    warnings.push(
      WarningSchema.parse({
        code: 'need-house',
        severity: 'warning',
        message: `Population cap blocked production for about ${Math.round(needHouse)}s.`,
      }),
    );
  }

  if (milestones.ageClickedAt.castle == null) {
    warnings.push(
      WarningSchema.parse({
        code: 'castle-not-clicked',
        severity: 'warning',
        message: 'Castle Age was never clicked within the current simulation horizon.',
      }),
    );
  }

  return warnings;
}
