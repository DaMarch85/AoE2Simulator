import type {
  BuildOrderPlanStep,
  BuildQueueTrigger,
  QueueCategory,
  ResolutionIssue,
  Ruleset,
  ScenarioDraft,
  ScriptEvent,
  Task,
  Trigger,
} from './schema';

function ageClickRef(age: 'feudal' | 'castle' | 'imperial') {
  return `age_${age}_clicked`;
}

function ageReachedRef(age: 'feudal' | 'castle' | 'imperial') {
  return `age_${age}_reached`;
}

function queueClickRef(index: number, rowId: string) {
  return `bo_queue_click_${index + 1}_${rowId}`;
}

function queueCompleteRef(index: number, rowId: string) {
  return `bo_queue_complete_${index + 1}_${rowId}`;
}

function buildStartRef(index: number, rowId: string) {
  return `bo_build_start_${index + 1}_${rowId}`;
}

function buildCompleteRef(index: number, rowId: string) {
  return `bo_build_complete_${index + 1}_${rowId}`;
}

function mapStepToTask(step: Exclude<BuildOrderPlanStep['task'], undefined>): Task {
  switch (step) {
    case 'hunt':
      return 'boar';
    case 'sheep':
    case 'berries':
    case 'deer':
    case 'farms':
    case 'wood':
    case 'gold':
    case 'stone':
    case 'idle':
      return step;
    default:
      return 'idle';
  }
}

function normalizePlanSteps(steps: BuildOrderPlanStep[]) {
  const tasks: Task[] = [];
  const walkTilesBeforeTasks: number[] = [];
  let pendingWalkTiles = 0;

  for (const step of steps) {
    if (step.kind === 'walking') {
      pendingWalkTiles += step.tiles ?? 0;
      continue;
    }

    if (!step.task) {
      continue;
    }

    tasks.push(mapStepToTask(step.task));
    walkTilesBeforeTasks.push(pendingWalkTiles);
    pendingWalkTiles = 0;
  }

  if (tasks.length === 0) {
    return {
      tasks: ['idle'] as Task[],
      walkTilesBeforeTasks: [0],
    };
  }

  return { tasks, walkTilesBeforeTasks };
}

function labelForPlanSteps(steps: BuildOrderPlanStep[]) {
  if (steps.length === 0) {
    return 'No orders';
  }

  return steps
    .map((step) => {
      if (step.kind === 'walking') {
        return `Walking (${step.tiles ?? 0})`;
      }

      switch (step.task) {
        case 'hunt':
          return 'Hunt';
        case 'farms':
          return 'Farm';
        default:
          return step.task ? `${step.task[0]?.toUpperCase() ?? ''}${step.task.slice(1)}` : '—';
      }
    })
    .join(' → ');
}

function queueTrigger(previousStartRef: string | null): Trigger {
  if (!previousStartRef) {
    return { type: 'on_start' };
  }

  return { type: 'on_entity_complete', entityRef: previousStartRef };
}

function buildTrigger(trigger: BuildQueueTrigger, previousBuildCompleteRef: string | null): Trigger {
  switch (trigger) {
    case 'on_start':
      return { type: 'on_start' };
    case 'prior_buildings_complete':
      return previousBuildCompleteRef
        ? { type: 'on_entity_complete', entityRef: previousBuildCompleteRef }
        : { type: 'on_start' };
    case 'feudal_clicked':
      return { type: 'on_entity_complete', entityRef: ageClickRef('feudal') };
    case 'feudal_reached':
      return { type: 'on_entity_complete', entityRef: ageReachedRef('feudal') };
    case 'castle_clicked':
      return { type: 'on_entity_complete', entityRef: ageClickRef('castle') };
    case 'castle_reached':
      return { type: 'on_entity_complete', entityRef: ageReachedRef('castle') };
    default:
      return { type: 'on_start' };
  }
}

function queueCategoryForProducer(buildingId: string): QueueCategory | undefined {
  if (buildingId === 'town_center') return 'town_center';
  if (buildingId === 'archery_range') return 'archery_range';
  if (buildingId === 'stable') return 'stable';
  if (buildingId === 'barracks') return 'barracks';
  return undefined;
}

function queueLabel(category: string, itemId: string, ordinal?: number) {
  if (category === 'villager') {
    return `Villager ${ordinal ?? ''}`.trim();
  }

  return itemId
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function compileBuildOrderEvents(
  draft: ScenarioDraft,
  ruleset: Ruleset,
): {
  events: ScriptEvent[];
  issues: ResolutionIssue[];
} {
  const buildOrder = draft.buildOrder;
  if (!buildOrder) {
    return { events: [], issues: [] };
  }

  const events: ScriptEvent[] = [];
  const issues: ResolutionIssue[] = [];

  let previousQueueStartRef: string | null = null;
  let villagerOrdinal = 0;

  for (let rowIndex = 0; rowIndex < buildOrder.queue.length; rowIndex += 1) {
    const row = buildOrder.queue[rowIndex];
    const trigger = queueTrigger(previousQueueStartRef);
    const defaultStartRef = queueClickRef(rowIndex, row.id);
    const defaultCompleteRef = queueCompleteRef(rowIndex, row.id);

    if (row.category === 'villager') {
      villagerOrdinal += 1;
      const plan = normalizePlanSteps(row.orderSteps);
      previousQueueStartRef = defaultStartRef;

      if (villagerOrdinal <= ruleset.startingVillagers) {
        events.push({
          id: `evt_queue_${row.id}`,
          label: queueLabel('villager', 'villager', villagerOrdinal),
          lane: 'eco',
          enabled: true,
          trigger,
          actions: [
            {
              type: 'assign_specific_villager_plan',
              villagerId: villagerOrdinal,
              tasks: plan.tasks,
              walkTilesBeforeTasks: plan.walkTilesBeforeTasks,
              startRef: defaultStartRef,
            },
          ],
        });
      } else {
        events.push({
          id: `evt_queue_${row.id}`,
          label: queueLabel('villager', 'villager', villagerOrdinal),
          lane: 'production',
          enabled: true,
          trigger,
          actions: [
            {
              type: 'train_once',
              unitId: 'villager',
              atBuildingId: 'town_center',
              priority: 'normal',
              queueCategory: 'town_center',
              startRef: defaultStartRef,
              completeRef: defaultCompleteRef,
              assignedTasks: plan.tasks,
              walkTilesBeforeTasks: plan.walkTilesBeforeTasks,
            },
          ],
          notes: labelForPlanSteps(row.orderSteps),
        });
      }

      continue;
    }

    if (row.category === 'military') {
      const unit = ruleset.units[row.itemId];
      const producerType = unit?.trainedAt[0] ?? 'archery_range';
      previousQueueStartRef = defaultStartRef;

      events.push({
        id: `evt_queue_${row.id}`,
        label: queueLabel(row.category, row.itemId),
        lane: 'production',
        enabled: true,
        trigger,
        actions: [
          {
            type: 'train_once',
            unitId: row.itemId,
            atBuildingId: producerType,
            priority: 'normal',
            queueCategory: queueCategoryForProducer(producerType),
            startRef: defaultStartRef,
            completeRef: defaultCompleteRef,
          },
        ],
      });
      continue;
    }

    if (row.category === 'eco_technology' || row.category === 'military_technology') {
      const tech = ruleset.techs[row.itemId];
      const buildingId = tech?.researchedAt ?? 'blacksmith';
      previousQueueStartRef = defaultStartRef;

      events.push({
        id: `evt_queue_${row.id}`,
        label: queueLabel(row.category, row.itemId),
        lane: 'research',
        enabled: true,
        trigger,
        actions: [
          {
            type: 'research',
            techId: row.itemId,
            atBuildingId: buildingId,
            priority: row.category === 'eco_technology' ? 'high' : 'normal',
            queueCategory: queueCategoryForProducer(buildingId),
            startRef: defaultStartRef,
            completeRef: defaultCompleteRef,
          },
        ],
      });
      continue;
    }

    const targetAge =
      row.itemId === 'feudal_age'
        ? 'feudal'
        : row.itemId === 'castle_age'
          ? 'castle'
          : 'imperial';

    previousQueueStartRef = ageClickRef(targetAge);

    events.push({
      id: `evt_queue_${row.id}`,
      label: queueLabel(row.category, row.itemId),
      lane: 'age',
      enabled: true,
      trigger,
      actions: [
        {
          type: 'advance_age',
          age: targetAge,
          priority: 'high',
          queueCategory: 'save',
          startRef: ageClickRef(targetAge),
          completeRef: ageReachedRef(targetAge),
        },
      ],
    });
  }

  let previousBuildCompleteRef: string | null = null;
  for (let rowIndex = 0; rowIndex < buildOrder.buildingQueue.length; rowIndex += 1) {
    const row = buildOrder.buildingQueue[rowIndex];
    const startRef = buildStartRef(rowIndex, row.id);
    const completeRef = buildCompleteRef(rowIndex, row.id);
    const trigger = buildTrigger(row.trigger, previousBuildCompleteRef);
    previousBuildCompleteRef = completeRef;

    const builderVillagerIds = [row.builderVillagerId, row.secondaryBuilderVillagerId].filter(
      (value): value is number => value != null,
    );

    events.push({
      id: `evt_build_${row.id}`,
      label: queueLabel('building', row.buildingId),
      lane: 'buildings',
      enabled: true,
      trigger,
      actions: [
        {
          type: 'build',
          buildingId: row.buildingId,
          builders: Math.max(1, builderVillagerIds.length || 1),
          builderVillagerIds: builderVillagerIds.length > 0 ? builderVillagerIds : undefined,
          priority: 'high',
          startRef,
          completeRef,
          walkToStartTiles: row.walkToStartTiles,
          walkAfterCompleteTiles: row.walkAfterCompleteTiles,
        },
      ],
    });
  }

  if (buildOrder.queue.length === 0) {
    issues.push({
      id: 'build-order-empty-queue',
      severity: 'info',
      message: 'The main queue is empty. Add villagers, military, technologies, or age-ups before running the sim.',
      suggestedPatch: 'Use Add queue order on the left panel.',
    });
  }

  return { events, issues };
}

export function summarizeBuildOrder(draft: ScenarioDraft) {
  const buildOrder = draft.buildOrder;
  if (!buildOrder) {
    return {
      queueItems: 0,
      villagerItems: 0,
      militaryItems: 0,
      ecoTechItems: 0,
      militaryTechItems: 0,
      ageUpItems: 0,
      buildingItems: 0,
    };
  }

  return {
    queueItems: buildOrder.queue.length,
    villagerItems: buildOrder.queue.filter((row) => row.category === 'villager').length,
    militaryItems: buildOrder.queue.filter((row) => row.category === 'military').length,
    ecoTechItems: buildOrder.queue.filter((row) => row.category === 'eco_technology').length,
    militaryTechItems: buildOrder.queue.filter((row) => row.category === 'military_technology').length,
    ageUpItems: buildOrder.queue.filter((row) => row.category === 'age_up').length,
    buildingItems: buildOrder.buildingQueue.length,
  };
}

export function buildOrderStepsLabel(steps: BuildOrderPlanStep[]) {
  return labelForPlanSteps(steps);
}
