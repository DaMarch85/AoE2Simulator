import { summarizeBuildOrder } from '@/lib/sim/build-order-compiler';
import type { ResolvedScenario, ScenarioDraft } from '@/lib/sim/schema';

export function AssumptionBar({
  draft,
  resolved,
}: {
  draft: ScenarioDraft;
  resolved: ResolvedScenario | null;
}) {
  const summary = summarizeBuildOrder(draft);

  return (
    <section className="panel-subtle flex flex-wrap gap-2 px-4 py-3">
      <span className="badge">Civ: {draft.civId}</span>
      <span className="badge">Worker efficiency: {draft.assumptions.workerEfficiency}%</span>
      <span className="badge">Queue: {summary.queueItems}</span>
      <span className="badge">Villagers: {summary.villagerItems}</span>
      <span className="badge">Military: {summary.militaryItems}</span>
      <span className="badge">Eco tech: {summary.ecoTechItems}</span>
      <span className="badge">Military tech: {summary.militaryTechItems}</span>
      <span className="badge">Age ups: {summary.ageUpItems}</span>
      <span className="badge">Buildings: {summary.buildingItems}</span>
      {resolved?.issues.map((issue) => (
        <span
          className={
            issue.severity === 'error'
              ? 'badge badge-error'
              : issue.severity === 'warning'
                ? 'badge badge-warning'
                : 'badge badge-info'
          }
          key={issue.id}
          title={issue.suggestedPatch}
        >
          {issue.message}
        </span>
      ))}
    </section>
  );
}
