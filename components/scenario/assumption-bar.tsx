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
      <span className="badge">Map: {draft.assumptions.mapPreset}</span>
      <span className="badge">Start vils: {summary.startVillagers}</span>
      <span className="badge">TC queue: {summary.tcItems}</span>
      <span className="badge">Military: {summary.militaryItems}</span>
      <span className="badge">Tech: {summary.techItems}</span>
      <span className="badge">Buildings: {summary.buildingItems}</span>
      <span className="badge">Exec: {draft.assumptions.executionProfile}</span>
      <span className="badge">Deer: {draft.assumptions.deerPushed}</span>
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
