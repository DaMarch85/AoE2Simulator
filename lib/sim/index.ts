import type { Ruleset, ScenarioDraft } from "./schema";
import { resolveScenario } from "./resolver";
import { runSimulation } from "./engine";
import { genericRuleset } from "./rules/generic-ruleset";

export * from "./schema";
export * from "./resolver";
export * from "./engine";
export * from "./rules/generic-ruleset";

export function simulateScenario(draft: ScenarioDraft, ruleset: Ruleset = genericRuleset) {
  const resolved = resolveScenario(draft, ruleset);
  const { run } = runSimulation(resolved, ruleset);

  return {
    resolved,
    run,
  };
}
