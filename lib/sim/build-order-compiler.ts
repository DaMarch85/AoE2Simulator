import type {
  BuildOrderTaskStep,
  BuildQueueTrigger,
  QueueCategory,
  ResolutionIssue,
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

function mapStepToTask(step: BuildOrderTaskStep): Task {
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

function mapStepsToTasks(steps: BuildOrderTaskStep[]): Task[] {
  return steps.map(mapStepToTask);
}

function labelForSteps(steps: BuildOrderTaskStep[]) {
  if (steps.length === 0) {
    return 'No orders';
  }

  return steps
    .map((step) => {
      switch (step) {
        case 'hunt':
          return 'Hunt';
        case 'farms':
          return 'Farm';
        default:
          return `${step[0]?.toUpperCase() ?? ''}${step.slice(1)}`;
      }
    })
    .join(' → ');
}

function queueTrigger(previousRef: string | null): Trigger {
  if (!previousRef) {
    return { type: 'on_start' };
  }

  return { type: 'on_entity_complete', entityRef: previousRef };
}

function buildTrigger(trigger: BuildQueueTrigger, previousRef: string | null): Trigger {
  switch (trigger) {
    case 'on_start':
      return { type: 'on_start' };
    case 'prior_complete':
      return previousRef ? { type: 'on_entity_complete', entityRef: previousRef } : { type: 'on_start' };
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

function techQueueCategory(buildingId: string, techId: string): QueueCategory | undefined {
  if (buildingId === 'town_center' && techId === 'loom') {
    return 'town_center';
  }

  return undefined;
}

export function compileBuildOrderEvents(draft: ScenarioDraft): {
  events: ScriptEvent[];
  issues: ResolutionIssue[];
} {
  const buildOrder = draft.buildOrder;
  if (!buildOrder) {
    return { events: [], issues: [] };
  }

  const events: ScriptEvent[] = [];
  const issues: ResolutionIssue[] = [];

  const startingVillagerActions = buildOrder.startingVillagers
    .filter((row) => row.steps.length > 0)
    .map((row) => ({
      type: 'assign_specific_villager_plan' as const,
      villagerId: row.villagerId,
      tasks: mapStepsToTasks(row.steps),
    }));

  if (startingVillagerActions.length > 0) {
    events.push({
      id: 'bo_starting_villager_orders',
      label: 'Starting villager orders',
      lane: 'eco',
      enabled: true,
      trigger: { type: 'on_start' },
      actions: startingVillagerActions,
    });
  }

  let previousTownCenterRef: string | null = null;
  for (const row of buildOrder.townCenterQueue) {
    for (let index = 1; index <= row.quantity; index += 1) {
      const completionRef = `bo_tc_${row.id}_${index}`;
      const trigger = queueTrigger(previousTownCenterRef);
      previousTownCenterRef = completionRef;

      if (row.itemType === 'villager') {
        events.push({
          id: `evt_tc_${row.id}_${index}`,
          label: `Town Center: Villager ${index}/${row.quantity}`,
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
              assignedTasks: row.villagerSteps.length > 0 ? mapStepsToTasks(row.villagerSteps) : ['idle'],
              completeRef: completionRef,
            },
          ],
        });
        continue;
      }

      if (row.itemType === 'loom') {
        events.push({
          id: `evt_tc_${row.id}_${index}`,
          label: 'Town Center: Loom',
          lane: 'research',
          enabled: true,
          trigger,
          actions: [
            {
              type: 'research',
              techId: 'loom',
              atBuildingId: 'town_center',
              priority: 'high',
              queueCategory: 'town_center',
              completeRef: completionRef,
            },
          ],
        });
        continue;
      }

      const targetAge = row.itemType === 'feudal_age'
        ? 'feudal'
        : row.itemType === 'castle_age'
          ? 'castle'
          : 'imperial';

      events.push({
        id: `evt_tc_${row.id}_${index}`,
        label: `Town Center: ${targetAge[0].toUpperCase()}${targetAge.slice(1)} Age`,
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
  }

  const previousMilitaryRef = new Map<string, string | null>();
  for (const row of buildOrder.militaryQueue) {
    const key = row.producerType;
    let currentPrevious = previousMilitaryRef.get(key) ?? null;

    for (let index = 1; index <= row.quantity; index += 1) {
      const completionRef = `bo_military_${row.id}_${index}`;
      const trigger = queueTrigger(currentPrevious);
      currentPrevious = completionRef;

      events.push({
        id: `evt_military_${row.id}_${index}`,
        label: `${row.producerType.replace('_', ' ')}: ${row.unitId} ${index}/${row.quantity}`,
        lane: 'production',
        enabled: true,
        trigger,
        actions: [
          {
            type: 'train_once',
            unitId: row.unitId,
            atBuildingId: row.producerType,
            priority: 'normal',
            queueCategory: row.producerType,
            completeRef: completionRef,
          },
        ],
      });
    }

    previousMilitaryRef.set(key, currentPrevious);
  }

  const previousTechRef = new Map<string, string | null>();
  for (const row of buildOrder.techQueue) {
    const key = row.buildingId;
    const trigger = queueTrigger(previousTechRef.get(key) ?? null);
    const completionRef = `bo_tech_${row.id}`;
    previousTechRef.set(key, completionRef);

    events.push({
      id: `evt_tech_${row.id}`,
      label: `${row.techId.replace(/_/g, ' ')}`,
      lane: 'research',
      enabled: true,
      trigger,
      actions: [
        {
          type: 'research',
          techId: row.techId,
          atBuildingId: row.buildingId,
          priority: 'high',
          queueCategory: techQueueCategory(row.buildingId, row.techId),
          completeRef: completionRef,
        },
      ],
    });
  }

  let previousBuildRef: string | null = null;
  for (const row of buildOrder.buildingQueue) {
    for (let index = 1; index <= row.quantity; index += 1) {
      const completionRef = `bo_build_${row.id}_${index}`;
      const trigger = buildTrigger(row.trigger, previousBuildRef);
      previousBuildRef = completionRef;

      events.push({
        id: `evt_build_${row.id}_${index}`,
        label: `${row.buildingId.replace(/_/g, ' ')} ${index}/${row.quantity}`,
        lane: 'buildings',
        enabled: true,
        trigger,
        actions: [
          {
            type: 'build',
            buildingId: row.buildingId,
            builders: 1,
            builderVillagerId: row.builderVillagerId,
            priority: 'high',
            completeRef: completionRef,
          },
        ],
      });
    }
  }

  const missingTcQueue = buildOrder.townCenterQueue.length === 0;
  if (missingTcQueue) {
    issues.push({
      id: 'build-order-empty-tc-queue',
      severity: 'info',
      message: 'The Town Center queue is empty. Add villagers, Loom, or age-ups before running a full build order.',
      suggestedPatch: 'Use the Town Center queue grid on the left panel to add your first items.',
    });
  }

  return { events, issues };
}

export function summarizeBuildOrder(draft: ScenarioDraft) {
  const buildOrder = draft.buildOrder;
  if (!buildOrder) {
    return {
      tcItems: 0,
      militaryItems: 0,
      techItems: 0,
      buildingItems: 0,
      startVillagers: 0,
    };
  }

  return {
    tcItems: buildOrder.townCenterQueue.reduce((sum, row) => sum + row.quantity, 0),
    militaryItems: buildOrder.militaryQueue.reduce((sum, row) => sum + row.quantity, 0),
    techItems: buildOrder.techQueue.length,
    buildingItems: buildOrder.buildingQueue.reduce((sum, row) => sum + row.quantity, 0),
    startVillagers: buildOrder.startingVillagers.length,
  };
}

export function buildOrderStepsLabel(steps: BuildOrderTaskStep[]) {
  return labelForSteps(steps);
}
