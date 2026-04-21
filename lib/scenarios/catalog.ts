import type { ScenarioDraft } from "@/lib/sim/schema";
import { exampleScenarioDraft } from "@/lib/fixtures/example-scenario";

const fixtures: Record<string, ScenarioDraft> = {
  [exampleScenarioDraft.id]: exampleScenarioDraft,
  demo: exampleScenarioDraft,
};

export function listScenarioFixtures() {
  return Object.values(fixtures).filter((scenario, index, array) => {
    return array.findIndex((item) => item.id === scenario.id) === index;
  });
}

export function getScenarioFixture(id: string) {
  return fixtures[id];
}
