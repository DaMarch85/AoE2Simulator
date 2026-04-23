import {
  type Policy,
  type ResolvedEvent,
  type ResolvedScenario,
  type Ruleset,
  type ScenarioDraft,
  DEFAULT_QUESTIONS,
  ResolvedScenarioSchema,
  ScenarioDraftSchema,
} from './schema';
import { compileBuildOrderEvents } from './build-order-compiler';

function addResolvedEvent(
  events: ResolvedEvent[],
  event: Omit<ResolvedEvent, 'source'> & { source?: ResolvedEvent['source'] },
) {
  events.push({
    ...event,
    source: event.source ?? 'user',
  });
}

function hasBuildAction(events: Array<{ actions: Array<{ type: string; buildingId?: string }> }>, buildingId: string) {
  return events.some((event) =>
    event.actions.some((action) => action.type === 'build' && action.buildingId === buildingId),
  );
}

function mergePolicies(templatePolicies: Policy[], userPolicies: Policy[]) {
  const merged = [...templatePolicies];
  const seen = new Set(templatePolicies.map((policy) => policy.id));

  for (const policy of userPolicies) {
    if (seen.has(policy.id)) {
      const index = merged.findIndex((item) => item.id === policy.id);
      merged[index] = policy;
    } else {
      merged.push(policy);
      seen.add(policy.id);
    }
  }

  return merged;
}

export function resolveScenario(draftInput: ScenarioDraft, ruleset: Ruleset): ResolvedScenario {
  const draft = ScenarioDraftSchema.parse(draftInput);
  const resolvedEvents: ResolvedEvent[] = [];
  const issues: ResolvedScenario['issues'] = [];
  const template = draft.baseOpeningId ? ruleset.openings[draft.baseOpeningId] : undefined;

  if (template) {
    for (const event of template.events) {
      addResolvedEvent(resolvedEvents, { ...event, source: 'template' });
    }
  } else if (draft.baseOpeningId) {
    issues.push({
      id: 'missing-template',
      severity: 'warning',
      message: `Template "${draft.baseOpeningId}" was not found in the active ruleset.`,
      suggestedPatch: 'Pick a known template or clear the baseOpeningId.',
    });
  }

  const compiledBuildOrder = compileBuildOrderEvents(draft);
  issues.push(...compiledBuildOrder.issues);
  for (const event of compiledBuildOrder.events) {
    addResolvedEvent(resolvedEvents, { ...event, source: 'user' });
  }

  for (const event of draft.userEvents) {
    addResolvedEvent(resolvedEvents, { ...event, source: 'user' });
  }

  const allEventsForChecks = resolvedEvents.map((event) => ({
    actions: event.actions as Array<{ type: string; buildingId?: string }>,
  }));

  const needsRange = hasBuildAction(allEventsForChecks, 'archery_range');
  const hasBarracks = hasBuildAction(allEventsForChecks, 'barracks');

  if (needsRange && !hasBarracks && draft.assumptions.autoDefaults.inferHardPrereqs) {
    addResolvedEvent(resolvedEvents, {
      id: 'inferred_barracks_before_range',
      label: 'Build Barracks before Range',
      lane: 'buildings',
      enabled: true,
      trigger: { type: 'at_villager_count', villagers: 17 },
      actions: [
        {
          type: 'build',
          buildingId: 'barracks',
          builders: 1,
          priority: 'high',
        },
      ],
      source: 'inferred',
    });

    issues.push({
      id: 'inferred-barracks',
      severity: 'info',
      message: 'A Barracks was inferred so the Range can be started immediately in Feudal Age.',
      suggestedPatch: 'Add an explicit Barracks row in the Buildings queue if you want tighter control.',
    });
  }

  const hasCastleQuestion = draft.questions.some(
    (question: ScenarioDraft['questions'][number]) =>
      (question.kind === 'age_affordable_at' ||
        question.kind === 'age_clicked_at' ||
        question.kind === 'age_reached_at') &&
      question.age === 'castle',
  );

  const hasCastlePolicy = draft.policies.some(
    (policy: ScenarioDraft['policies'][number]) => policy.kind === 'click_age_asap' && policy.targetAge === 'castle' && policy.enabled,
  );

  const hasSecondFeudalBuilding =
    hasBuildAction(allEventsForChecks, 'blacksmith') || hasBuildAction(allEventsForChecks, 'market');

  if ((hasCastleQuestion || hasCastlePolicy) && !hasSecondFeudalBuilding) {
    issues.push({
      id: 'missing-second-feudal-building',
      severity: 'warning',
      message:
        'Castle Age requires a second Feudal building. Add a Blacksmith or Market row before your Castle Age row.',
      suggestedPatch: 'Use the Buildings queue to add a Blacksmith or Market explicitly.',
    });
  }

  const questions = draft.questions.length > 0 ? draft.questions : DEFAULT_QUESTIONS;
  const policies = draft.buildOrder ? [] : mergePolicies(template?.policies ?? [], draft.policies);

  return ResolvedScenarioSchema.parse({
    ...draft,
    questions,
    policies,
    resolvedEvents,
    issues,
  });
}
