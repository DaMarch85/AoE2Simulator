import type { ResolvedScenario, ScenarioDraft } from '@/lib/sim/schema';

function loomLabel(value: string) {
  switch (value) {
    case 'skip':
      return 'Skip';
    case 'dark_start':
      return 'Dark start';
    case 'dark_end':
      return 'Dark end';
    case 'feudal_start':
      return 'Feudal start';
    case 'feudal_end':
      return 'Feudal end';
    case 'castle_start':
      return 'Castle start';
    case 'auto':
      return 'Auto';
    case 'early':
      return 'Early';
    case 'late':
      return 'Late';
    default:
      return value;
  }
}

export function AssumptionBar({ draft, resolved }: { draft: ScenarioDraft; resolved: ResolvedScenario }) {
  return (
    <section className="panel-subtle flex flex-wrap gap-2 px-4 py-3">
      <span className="badge">Civ: {draft.civId}</span>
      <span className="badge">Map: {draft.assumptions.mapPreset}</span>
      <span className="badge">Start: {draft.assumptions.startPreset}</span>
      <span className="badge">Deer: {draft.assumptions.deerPushed}</span>
      <span className="badge">Exec: {draft.assumptions.executionProfile}</span>
      <span className="badge">Loom: {loomLabel(draft.assumptions.loomTiming)}</span>
      {resolved.issues.map((issue) => (
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
