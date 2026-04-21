import { notFound } from "next/navigation";
import { ScenarioWorkbench } from "@/components/scenario/scenario-workbench";
import { getScenarioFixture } from "@/lib/scenarios/catalog";
import { genericRuleset } from "@/lib/sim/rules/generic-ruleset";

export default async function ScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scenario = getScenarioFixture(id);

  if (!scenario) {
    notFound();
  }

  return <ScenarioWorkbench initialDraft={scenario} ruleset={genericRuleset} />;
}
