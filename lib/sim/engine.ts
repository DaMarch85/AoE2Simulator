import { buildAnswers, type SimulationMilestones } from './answers';
import { buildWarnings } from './warnings';
import type {
  Action,
  Age,
  Keyframe,
  LaneSegment,
  PartialResourceStock,
  Policy,
  ResolvedScenario,
  ResourcePoolState,
  ResourceStock,
  Ruleset,
  SimulationRun,
  Task,
} from './schema';
import { SimulationRunSchema } from './schema';
import {
  ageLabel,
  ageRow,
  ageTechId,
  canAfford,
  cloneResourcePools,
  cloneStock,
  cloneTaskCounts,
  createEmptyTaskCounts,
  normalizedLoomTiming,
  priorityScore,
  sameTaskCounts,
  spend,
  taskLabel,
  tilesToSeconds,
  walkSeconds,
} from './helpers';

interface PendingAction {
  action: Action;
  eventId: string;
  priority: number;
  createdAt: number;
}

interface Producer {
  key: string;
  buildingId: string;
  built: boolean;
  busyUntil: number;
}

interface TrainingJob {
  producerKey: string;
  unitId: string;
  startSec: number;
  endSec: number;
  startRef?: string;
  completeRef?: string;
  assignedTasks?: Task[];
  walkTilesBeforeTasks?: number[];
}

interface ResearchJob {
  producerKey: string;
  techId: string;
  startSec: number;
  endSec: number;
  ageTarget?: Age;
  startRef?: string;
  completeRef?: string;
}

interface BuildJob {
  id: string;
  laneId: string;
  buildingId: string;
  label: string;
  buildStartSec: number;
  endSec: number;
  builderIds: number[];
  returnTasks: Record<number, Task>;
  started: boolean;
  completeRef?: string;
  walkAfterCompleteTiles: number;
}

interface Villager {
  id: number;
  task: Task;
  pendingTask: Task | null;
  walkUntil: number | null;
  pendingBuildJobId: string | null;
  returnTask: Task | null;
  farmBuildUntil: number | null;
  farmFoodRemaining: number;
  orders: Task[];
  walkTilesBeforeTasks: number[];
  orderIndex: number;
}

interface VillagerVisual {
  state: LaneSegment['state'];
  label: string;
  startSec: number;
}

interface EngineState {
  timeSec: number;
  age: Age;
  resources: ResourceStock;
  resourcePools: ResourcePoolState;
  population: number;
  popCap: number;
  units: Record<string, number>;
  buildings: Record<string, number>;
  tasks: Record<Task, number>;
  nextVillagerPlans: Task[][];
  pendingActions: PendingAction[];
  completedEntityRefs: Map<string, number>;
  firedEvents: Set<string>;
  researchedTechs: Set<string>;
  producers: Map<string, Producer>;
  trainingJobs: TrainingJob[];
  researchJobs: ResearchJob[];
  buildJobs: BuildJob[];
  villagers: Villager[];
  blockedDurations: Map<string, number>;
  rawSegments: LaneSegment[];
  villagerVisuals: Map<number, VillagerVisual>;
  buildJobCounter: number;
}

function ageIndex(age: Age) {
  switch (age) {
    case 'dark':
      return 0;
    case 'feudal':
      return 1;
    case 'castle':
      return 2;
    case 'imperial':
      return 3;
    default:
      return 0;
  }
}

function canUseAge(currentAge: Age, requiredAge: Age) {
  return ageIndex(currentAge) >= ageIndex(requiredAge);
}

function createState(ruleset: Ruleset, scenario: ResolvedScenario): EngineState {
  const tasks = createEmptyTaskCounts();
  const villagers: Villager[] = [];
  const villagerVisuals = new Map<number, VillagerVisual>();

  for (let id = 1; id <= ruleset.startingVillagers; id += 1) {
    villagers.push({
      id,
      task: 'sheep',
      pendingTask: null,
      walkUntil: null,
      pendingBuildJobId: null,
      returnTask: null,
      farmBuildUntil: null,
      farmFoodRemaining: 0,
      orders: [],
      walkTilesBeforeTasks: [],
      orderIndex: -1,
    });
    tasks.sheep += 1;
    villagerVisuals.set(id, {
      state: 'gathering',
      label: 'Sheep',
      startSec: 0,
    });
  }

  return {
    timeSec: 0,
    age: 'dark',
    resources: cloneStock(ruleset.startingResources),
    resourcePools: {
      sheep: ruleset.startingFoodSources.sheep,
      boar: ruleset.startingFoodSources.boar,
      berries: ruleset.startingFoodSources.berries,
      deer: ruleset.startingFoodSources.deerPerPushed * scenario.assumptions.deerPushed,
      farms: 0,
    },
    population: ruleset.startingPopulation,
    popCap: ruleset.startingPopCap,
    units: {
      villager: ruleset.startingVillagers,
      archer: 0,
      scout_cavalry: 1,
    },
    buildings: {
      town_center: 1,
      house: 0,
      mill: 0,
      lumber_camp: 0,
      mining_camp: 0,
      barracks: 0,
      archery_range: 0,
      blacksmith: 0,
      market: 0,
    },
    tasks,
    nextVillagerPlans: [],
    pendingActions: [],
    completedEntityRefs: new Map<string, number>(),
    firedEvents: new Set<string>(),
    researchedTechs: new Set<string>(),
    producers: new Map<string, Producer>([
      ['tc_1', { key: 'tc_1', buildingId: 'town_center', built: true, busyUntil: 0 }],
    ]),
    trainingJobs: [],
    researchJobs: [],
    buildJobs: [],
    villagers,
    blockedDurations: new Map<string, number>(),
    rawSegments: [],
    villagerVisuals,
    buildJobCounter: 0,
  };
}

function getVillagerLaneId(id: number) {
  return `villager_${id}`;
}


function addEventRef(state: EngineState, ref: string | undefined) {
  if (!ref) {
    return;
  }
  state.completedEntityRefs.set(ref, state.timeSec + 1);
}

function hasEventRef(state: EngineState, ref: string) {
  return (state.completedEntityRefs.get(ref) ?? -1) >= state.timeSec;
}

function cleanupEventRefs(state: EngineState) {
  for (const [ref, expiresAt] of state.completedEntityRefs.entries()) {
    if (expiresAt < state.timeSec) {
      state.completedEntityRefs.delete(ref);
    }
  }
}

function pushRawSegment(state: EngineState, segment: LaneSegment) {
  if (segment.endSec <= segment.startSec) {
    return;
  }
  state.rawSegments.push(segment);
}

function setVillagerVisual(
  state: EngineState,
  villager: Villager,
  visualState: LaneSegment['state'],
  label: string,
) {
  const current = state.villagerVisuals.get(villager.id);
  if (current && current.state === visualState && current.label === label) {
    return;
  }

  if (current) {
    pushRawSegment(state, {
      laneId: getVillagerLaneId(villager.id),
      label: current.label,
      startSec: current.startSec,
      endSec: state.timeSec,
      state: current.state,
    });
  }

  state.villagerVisuals.set(villager.id, {
    state: visualState,
    label,
    startSec: state.timeSec,
  });
}

function finalizeVillagerVisuals(state: EngineState, totalTime: number) {
  for (const [id, current] of state.villagerVisuals.entries()) {
    pushRawSegment(state, {
      laneId: getVillagerLaneId(id),
      label: current.label,
      startSec: current.startSec,
      endSec: totalTime,
      state: current.state,
    });
  }
}

function decrementTask(state: EngineState, task: Task) {
  state.tasks[task] = Math.max(0, (state.tasks[task] ?? 0) - 1);
}

function incrementTask(state: EngineState, task: Task) {
  state.tasks[task] = (state.tasks[task] ?? 0) + 1;
}

function setVillagerTaskImmediate(state: EngineState, villager: Villager, task: Task, label = taskLabel(task)) {
  if (villager.task !== task) {
    decrementTask(state, villager.task);
    incrementTask(state, task);
    villager.task = task;
  }

  villager.pendingTask = null;
  villager.walkUntil = null;
  villager.pendingBuildJobId = null;
  villager.returnTask = null;

  const visualState: LaneSegment['state'] =
    task === 'walk' ? 'walking' : task === 'build' ? 'building' : task === 'idle' ? 'idle' : 'gathering';

  setVillagerVisual(state, villager, visualState, label);
}

function startVillagerWalk(
  state: EngineState,
  villager: Villager,
  nextTask: Task,
  label: string,
  explicitTiles = 0,
) {
  const travelTime =
    explicitTiles > 0
      ? tilesToSeconds(explicitTiles)
      : walkSeconds(nextTask, stateAssumptions(state).walkProfile);
  if (travelTime <= 0) {
    setVillagerTaskImmediate(state, villager, nextTask, label);
    return;
  }

  if (villager.task !== 'walk') {
    decrementTask(state, villager.task);
    incrementTask(state, 'walk');
  }

  villager.task = 'walk';
  villager.pendingTask = nextTask;
  villager.walkUntil = state.timeSec + travelTime;
  villager.pendingBuildJobId = null;
  villager.returnTask = null;
  setVillagerVisual(state, villager, 'walking', label);
}

function transitionVillagerToTask(
  state: EngineState,
  ruleset: Ruleset,
  villager: Villager,
  nextTask: Task,
  explicitTiles = 0,
) {
  if (nextTask === 'farms') {
    tryStartFarmForVillager(state, ruleset, villager, explicitTiles);
    return;
  }

  if (nextTask === 'idle' && explicitTiles <= 0) {
    setVillagerTaskImmediate(state, villager, 'idle', 'Idle');
    return;
  }

  if (explicitTiles <= 0 && state.timeSec === 0 && nextTask !== 'idle') {
    setVillagerTaskImmediate(state, villager, nextTask, taskLabel(nextTask));
    return;
  }

  startVillagerWalk(state, villager, nextTask, `Walk to ${taskLabel(nextTask).toLowerCase()}`, explicitTiles);
}

function setVillagerPlan(
  state: EngineState,
  villager: Villager,
  tasks: Task[],
  walkTilesBeforeTasks: number[] = [],
) {
  villager.orders = [...tasks];
  villager.walkTilesBeforeTasks = [...walkTilesBeforeTasks];
  villager.orderIndex = tasks.length > 0 ? 0 : -1;

  const firstTask = tasks[0] ?? 'idle';
  const firstWalkTiles = walkTilesBeforeTasks[0] ?? 0;

  transitionVillagerToTask(state, ACTIVE_RULESET!, villager, firstTask, firstWalkTiles);
}

function nextPlannedTask(villager: Villager): { task: Task | null; walkTiles: number } {
  if (villager.orderIndex < 0) {
    return { task: null, walkTiles: 0 };
  }
  const nextIndex = villager.orderIndex + 1;
  return {
    task: villager.orders[nextIndex] ?? null,
    walkTiles: villager.walkTilesBeforeTasks[nextIndex] ?? 0,
  };
}

function stepVillagerPlan(_state: EngineState, villager: Villager): { task: Task | null; walkTiles: number } {
  const next = nextPlannedTask(villager);
  if (!next.task) {
    return { task: null, walkTiles: 0 };
  }
  villager.orderIndex += 1;
  return next;
}

let ACTIVE_ASSUMPTIONS: ResolvedScenario['assumptions'] | null = null;

function stateAssumptions(_state: EngineState) {
  if (!ACTIVE_ASSUMPTIONS) {
    throw new Error('Simulation assumptions were not initialized.');
  }
  return ACTIVE_ASSUMPTIONS;
}

function hasDarkAgePrereqs(state: EngineState) {
  return (state.buildings.lumber_camp ?? 0) + (state.buildings.mill ?? 0) >= 2;
}

function hasCastlePrereqs(state: EngineState) {
  return (state.buildings.archery_range ?? 0) + (state.buildings.blacksmith ?? 0) + (state.buildings.market ?? 0) >= 2;
}

function canAdvanceToAge(state: EngineState, ruleset: Ruleset, age: Age) {
  const techId = ageTechId(age);
  const tech = ruleset.techs[techId];
  if (!tech || !canAfford(state.resources, tech.cost)) {
    return false;
  }

  if (age === 'feudal') {
    return state.age === 'dark' && hasDarkAgePrereqs(state);
  }

  if (age === 'castle') {
    return state.age === 'feudal' && hasCastlePrereqs(state);
  }

  if (age === 'imperial') {
    return state.age === 'castle';
  }

  return false;
}

function recordMilestoneUnits(
  milestones: SimulationMilestones,
  state: EngineState,
  milestone: 'age_click' | 'age_reach',
  age: Age,
) {
  const trackedUnits = ['archer', 'villager'];
  for (const unitId of trackedUnits) {
    milestones.unitCountsAtMilestone[`${unitId}:${milestone}:${age}`] = state.units[unitId] ?? 0;
  }
}

function actionQueueRank(scenario: ResolvedScenario, state: EngineState, action: Action) {
  if ('queueCategory' in action && action.queueCategory) {
    const priorities = ageRow(scenario.assumptions.agePriorityGrid, state.age);
    switch (action.queueCategory) {
      case 'town_center':
        return priorities.town_center;
      case 'archery_range':
        return priorities.archery_range;
      case 'stable':
        return priorities.stable;
      case 'barracks':
        return priorities.barracks;
      case 'save':
        return priorities.save;
      default:
        break;
    }
  }

  return 'priority' in action ? priorityScore(action.priority) : priorityScore('normal');
}

function addPendingAction(
  scenario: ResolvedScenario,
  state: EngineState,
  action: Action,
  eventId: string,
  createdAt: number,
) {
  if (action.type === 'assign_existing_villagers' || action.type === 'assign_next_villagers' || action.type === 'assign_specific_villager_plan' || action.type === 'note') {
    return false;
  }

  state.pendingActions.push({
    action,
    eventId,
    createdAt,
    priority: actionQueueRank(scenario, state, action),
  });

  state.pendingActions.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.createdAt - b.createdAt;
  });

  return true;
}


function producerByBuilding(state: EngineState, buildingId: string) {
  return [...state.producers.values()].filter((producer) => producer.buildingId === buildingId && producer.built);
}

function idleProducer(state: EngineState, buildingId: string) {
  return producerByBuilding(state, buildingId)
    .filter((producer) => producer.built)
    .sort((a, b) => a.busyUntil - b.busyUntil)[0];
}

function addProducerIfNeeded(state: EngineState, ruleset: Ruleset, buildingId: string) {
  const building = ruleset.buildings[buildingId];
  if (!building) {
    return;
  }

  if (building.supportsTraining.length === 0 && building.supportsResearch.length === 0) {
    return;
  }

  const count = producerByBuilding(state, buildingId).length + 1;
  const keyPrefix = buildingId === 'town_center' ? 'tc' : buildingId;
  const key = `${keyPrefix}_${count}`;
  state.producers.set(key, {
    key,
    buildingId,
    built: true,
    busyUntil: state.timeSec,
  });
}

function availableFoodTask(state: EngineState): Task | null {
  if (state.resourcePools.sheep > 0) return 'sheep';
  if (state.resourcePools.boar > 0) return 'boar';
  if (state.resourcePools.berries > 0) return 'berries';
  if (state.resourcePools.deer > 0) return 'deer';
  return 'farms';
}

function taskForNewVillager(state: EngineState): Task {
  const nextPlan = state.nextVillagerPlans.shift();
  if (nextPlan && nextPlan.length > 0) {
    return nextPlan[0];
  }

  if (state.age === 'dark') {
    return availableFoodTask(state) ?? 'wood';
  }

  if (state.age === 'feudal') {
    if ((state.tasks.gold ?? 0) < 6) {
      return 'gold';
    }
    if ((state.tasks.wood ?? 0) < 8) {
      return 'wood';
    }
    return availableFoodTask(state) ?? 'farms';
  }

  return 'farms';
}

function villagerSourcePreferenceForBuilding(buildingId: string): Task[] {
  switch (buildingId) {
    case 'mill':
      return ['berries', 'sheep', 'boar', 'deer', 'wood', 'gold'];
    case 'lumber_camp':
      return ['wood', 'sheep', 'boar', 'berries', 'deer', 'gold'];
    case 'mining_camp':
      return ['gold', 'wood', 'sheep', 'boar', 'berries', 'deer'];
    case 'house':
      return ['wood', 'sheep', 'boar', 'berries', 'deer', 'gold'];
    default:
      return ['wood', 'sheep', 'boar', 'berries', 'deer', 'gold', 'farms'];
  }
}

function chooseVillagers(state: EngineState, count: number, preferredTasks: Task[]) {
  const chosen: Villager[] = [];

  for (const task of preferredTasks) {
    for (const villager of state.villagers) {
      if (chosen.length >= count) {
        break;
      }
      if (villager.task !== task) {
        continue;
      }
      if (villager.pendingBuildJobId || villager.farmBuildUntil != null) {
        continue;
      }
      chosen.push(villager);
    }
    if (chosen.length >= count) {
      break;
    }
  }

  return chosen.length === count ? chosen : null;
}

function canUseBuildingNow(state: EngineState, ruleset: Ruleset, buildingId: string) {
  const definition = ruleset.buildings[buildingId];
  if (!definition) {
    return false;
  }
  if (!canUseAge(state.age, definition.age)) {
    return false;
  }
  if (buildingId === 'archery_range' && (state.buildings.barracks ?? 0) < 1) {
    return false;
  }
  return true;
}

function canUseUnitNow(state: EngineState, ruleset: Ruleset, unitId: string) {
  const definition = ruleset.units[unitId];
  if (!definition) {
    return false;
  }
  return canUseAge(state.age, definition.age);
}

function canUseTechNow(state: EngineState, ruleset: Ruleset, techId: string) {
  const definition = ruleset.techs[techId];
  if (!definition) {
    return false;
  }
  if (state.researchedTechs.has(techId)) {
    return false;
  }
  if (!canUseAge(state.age, definition.age)) {
    return false;
  }
  return true;
}

function trackBlocked(state: EngineState, label: string) {
  const current = state.blockedDurations.get(label) ?? 0;
  state.blockedDurations.set(label, current + 1);
}

function popRequiredForQueuedUnits(state: EngineState, ruleset: Ruleset) {
  return state.trainingJobs.reduce((sum, job) => sum + (ruleset.units[job.unitId]?.populationCost ?? 0), 0);
}

function actionPauseCategory(producerType: 'town_center' | 'archery_range' | 'stable' | 'barracks') {
  return producerType === 'town_center' ? 'town_center' : 'military';
}

function shouldSaveBeforeSpend(
  scenario: ResolvedScenario,
  state: EngineState,
  ruleset: Ruleset,
  producerType: 'town_center' | 'archery_range' | 'stable' | 'barracks',
  cost: PartialResourceStock,
) {
  const policy = scenario.policies.find(
    (item): item is Extract<Policy, { kind: 'click_age_asap' }> => item.kind === 'click_age_asap' && item.enabled,
  );

  if (!policy || policy.reserveMode === 'observe') {
    return false;
  }

  const targetAge = policy.targetAge;
  if (ageIndex(targetAge) !== ageIndex(state.age) + 1) {
    return false;
  }

  const pauseCategory = actionPauseCategory(producerType);
  if (!policy.canPause.includes(pauseCategory)) {
    return false;
  }

  const priorities = ageRow(scenario.assumptions.agePriorityGrid, state.age);
  const producerPriority = priorities[producerType];
  if (producerPriority <= priorities.save) {
    return false;
  }

  const ageTech = ruleset.techs[ageTechId(targetAge)];
  if (!ageTech) {
    return false;
  }

  const remainingAfterSpend = cloneStock(state.resources);
  spend(remainingAfterSpend, cost);

  return (remainingAfterSpend.food < (ageTech.cost.food ?? 0)) || (remainingAfterSpend.gold < (ageTech.cost.gold ?? 0));
}

function blockedReasonForTrain(
  scenario: ResolvedScenario,
  state: EngineState,
  ruleset: Ruleset,
  producerType: 'town_center' | 'archery_range' | 'stable' | 'barracks',
  unitId: string,
): string | null {
  const definition = ruleset.units[unitId];
  if (!definition) {
    return null;
  }

  const queuedPopulation = popRequiredForQueuedUnits(state, ruleset);
  if ((state.population + queuedPopulation + definition.populationCost) > state.popCap) {
    return 'Need house';
  }

  if (shouldSaveBeforeSpend(scenario, state, ruleset, producerType, definition.cost)) {
    return null;
  }

  if ((state.resources.food ?? 0) < (definition.cost.food ?? 0)) return 'Missing food';
  if ((state.resources.wood ?? 0) < (definition.cost.wood ?? 0)) return 'Missing wood';
  if ((state.resources.gold ?? 0) < (definition.cost.gold ?? 0)) return 'Missing gold';
  if ((state.resources.stone ?? 0) < (definition.cost.stone ?? 0)) return 'Missing stone';
  return null;
}

function tryStartFarmForVillager(
  state: EngineState,
  ruleset: Ruleset,
  villager: Villager,
  walkTilesOverride = 0,
) {
  const farmCost = ruleset.startingFoodSources.farmWoodCost;
  if (state.resources.wood < farmCost) {
    if (villager.task !== 'idle') {
      setVillagerTaskImmediate(state, villager, 'idle', 'Waiting for farm wood');
    }
    villager.pendingTask = 'farms';
    villager.farmBuildUntil = null;
    return false;
  }

  spend(state.resources, { wood: farmCost });
  const walkTime =
    walkTilesOverride > 0
      ? tilesToSeconds(walkTilesOverride)
      : walkSeconds('farms', stateAssumptions(state).walkProfile);

  if (villager.task !== 'walk') {
    decrementTask(state, villager.task);
    incrementTask(state, 'walk');
  }
  villager.task = 'walk';
  villager.pendingTask = 'farms';
  villager.walkUntil = state.timeSec + walkTime;
  villager.pendingBuildJobId = null;
  villager.returnTask = null;
  villager.farmBuildUntil = state.timeSec + walkTime + ruleset.startingFoodSources.farmBuildTimeSec;
  setVillagerVisual(state, villager, 'walking', 'Walk to farm');
  return true;
}

function reassignVillagerToFood(state: EngineState, ruleset: Ruleset, villager: Villager) {
  const nextPlanned = stepVillagerPlan(state, villager);
  if (nextPlanned.task) {
    transitionVillagerToTask(state, ruleset, villager, nextPlanned.task, nextPlanned.walkTiles);
    return;
  }

  const next = availableFoodTask(state);
  if (!next) {
    setVillagerTaskImmediate(state, villager, 'idle', 'Idle');
    return;
  }

  transitionVillagerToTask(state, ruleset, villager, next, 0);
}

function applyFoodFallbacks(state: EngineState, ruleset: Ruleset) {
  for (const villager of state.villagers) {
    if (villager.pendingBuildJobId || villager.task === 'walk' || villager.task === 'build') {
      continue;
    }

    if (villager.task === 'sheep' && state.resourcePools.sheep <= 0) {
      reassignVillagerToFood(state, ruleset, villager);
      continue;
    }
    if (villager.task === 'boar' && state.resourcePools.boar <= 0) {
      reassignVillagerToFood(state, ruleset, villager);
      continue;
    }
    if (villager.task === 'berries' && state.resourcePools.berries <= 0) {
      reassignVillagerToFood(state, ruleset, villager);
      continue;
    }
    if (villager.task === 'deer' && state.resourcePools.deer <= 0) {
      reassignVillagerToFood(state, ruleset, villager);
      continue;
    }
    if (villager.task === 'farms' && villager.farmFoodRemaining <= 0) {
      const nextPlanned = stepVillagerPlan(state, villager);
      if (nextPlanned.task && nextPlanned.task !== 'farms') {
        transitionVillagerToTask(state, ruleset, villager, nextPlanned.task, nextPlanned.walkTiles);
      } else {
        if (nextPlanned.task === 'farms') {
          villager.orderIndex -= 1;
        }
        tryStartFarmForVillager(state, ruleset, villager);
      }
      continue;
    }
    if (villager.task === 'idle' && villager.pendingTask === 'farms') {
      tryStartFarmForVillager(state, ruleset, villager);
    }
  }
}

function assignExistingVillagers(state: EngineState, count: number, to: Task, from?: Task, immediate = false) {
  let remaining = count;
  const sourceTasks: Task[] = from
    ? [from]
    : ['idle', 'sheep', 'boar', 'berries', 'deer', 'farms', 'wood', 'gold', 'stone'];

  for (const task of sourceTasks) {
    for (const villager of state.villagers) {
      if (remaining <= 0) break;
      if (villager.task !== task) continue;
      if (villager.pendingBuildJobId || villager.farmBuildUntil != null) continue;

      if (immediate || state.timeSec === 0) {
        setVillagerTaskImmediate(state, villager, to, taskLabel(to));
      } else if (to === 'farms') {
        tryStartFarmForVillager(state, ACTIVE_RULESET!, villager);
      } else {
        startVillagerWalk(state, villager, to, `Walk to ${taskLabel(to).toLowerCase()}`);
      }
      remaining -= 1;
    }
  }

  return remaining === 0;
}

let ACTIVE_RULESET: Ruleset | null = null;

function tryApplyAction(
  action: Action,
  scenario: ResolvedScenario,
  state: EngineState,
  ruleset: Ruleset,
  milestones: SimulationMilestones,
): boolean {
  switch (action.type) {
    case 'assign_existing_villagers': {
      return assignExistingVillagers(state, action.count, action.to, action.from, state.timeSec === 0);
    }

    case 'assign_next_villagers': {
      for (let index = 0; index < action.count; index += 1) {
        state.nextVillagerPlans.push([action.to]);
      }
      return true;
    }

    case 'assign_specific_villager_plan': {
      const villager = state.villagers.find((item) => item.id === action.villagerId);
      if (!villager) {
        return false;
      }
      setVillagerPlan(state, villager, action.tasks, action.walkTilesBeforeTasks);
      addEventRef(state, action.startRef);
      return true;
    }

    case 'note':
    case 'reserve_resources':
      return true;

    case 'build': {
      const definition = ruleset.buildings[action.buildingId];
      if (!definition) {
        return false;
      }
      if (!canUseBuildingNow(state, ruleset, action.buildingId)) {
        return false;
      }
      if (!canAfford(state.resources, definition.cost)) {
        return false;
      }

      const builders = action.builderVillagerIds && action.builderVillagerIds.length > 0
        ? (() => {
            const explicitBuilders = action.builderVillagerIds
              .map((villagerId) => state.villagers.find((item) => item.id === villagerId))
              .filter((villager): villager is Villager => Boolean(villager));

            if (explicitBuilders.length !== action.builderVillagerIds.length) {
              return null;
            }

            if (
              explicitBuilders.some(
                (villager) =>
                  villager.pendingBuildJobId ||
                  villager.farmBuildUntil != null ||
                  villager.task === 'walk' ||
                  villager.task === 'build',
              )
            ) {
              return null;
            }

            return explicitBuilders;
          })()
        : chooseVillagers(state, action.builders, villagerSourcePreferenceForBuilding(action.buildingId));
      if (!builders) {
        return false;
      }

      spend(state.resources, definition.cost);
      addEventRef(state, action.startRef);

      const walkTime =
        action.walkToStartTiles > 0
          ? tilesToSeconds(action.walkToStartTiles)
          : walkSeconds('build', stateAssumptions(state).walkProfile);
      const buildStartSec = state.timeSec + walkTime;
      const endSec = buildStartSec + definition.buildTimeSec;
      const jobId = `build_${++state.buildJobCounter}`;
      const returnTasks: Record<number, Task> = {};

      for (const builder of builders) {
        returnTasks[builder.id] = builder.task;
        decrementTask(state, builder.task);
        incrementTask(state, 'walk');
        builder.task = 'walk';
        builder.pendingTask = 'build';
        builder.walkUntil = buildStartSec;
        builder.pendingBuildJobId = jobId;
        builder.returnTask = returnTasks[builder.id];
        setVillagerVisual(state, builder, 'walking', `Walk to ${definition.name.toLowerCase()}`);
      }

      const laneId = action.buildingId === 'house' ? 'construction_auto' : 'construction_main';
      state.buildJobs.push({
        id: jobId,
        laneId,
        buildingId: action.buildingId,
        label: definition.name,
        buildStartSec,
        endSec,
        builderIds: builders.map((builder) => builder.id),
        returnTasks,
        started: false,
        completeRef: action.completeRef,
        walkAfterCompleteTiles: action.walkAfterCompleteTiles,
      });

      pushRawSegment(state, {
        laneId,
        label: definition.name,
        startSec: buildStartSec,
        endSec,
        state: 'building',
      });

      return true;
    }

    case 'train_once': {
      const definition = ruleset.units[action.unitId];
      if (!definition || !canUseUnitNow(state, ruleset, action.unitId)) {
        return false;
      }
      const producer = idleProducer(state, action.atBuildingId);
      if (!producer) {
        return false;
      }
      const producerType = action.atBuildingId as 'town_center' | 'archery_range' | 'stable' | 'barracks';
      const blockedReason = blockedReasonForTrain(scenario, state, ruleset, producerType, action.unitId);
      if (blockedReason) {
        trackBlocked(state, blockedReason);
        return false;
      }
      if (shouldSaveBeforeSpend(scenario, state, ruleset, producerType, definition.cost)) {
        return false;
      }
      if (!canAfford(state.resources, definition.cost)) {
        return false;
      }
      if ((state.population + popRequiredForQueuedUnits(state, ruleset) + definition.populationCost) > state.popCap) {
        trackBlocked(state, 'Need house');
        return false;
      }

      const startSec = Math.max(state.timeSec, producer.busyUntil);
      const endSec = startSec + definition.buildTimeSec;

      spend(state.resources, definition.cost);
      producer.busyUntil = endSec;
      addEventRef(state, action.startRef);
      state.trainingJobs.push({
        producerKey: producer.key,
        unitId: action.unitId,
        startSec,
        endSec,
        startRef: action.startRef,
        completeRef: action.completeRef,
        assignedTasks: action.assignedTasks,
        walkTilesBeforeTasks: action.walkTilesBeforeTasks,
      });
      pushRawSegment(state, {
        laneId: producer.key,
        label: definition.name,
        startSec,
        endSec,
        state: 'training',
        count: 1,
      });
      return true;
    }

    case 'research': {
      const definition = ruleset.techs[action.techId];
      if (!definition || !canUseTechNow(state, ruleset, action.techId)) {
        return false;
      }
      const producer = idleProducer(state, action.atBuildingId);
      if (!producer || !canAfford(state.resources, definition.cost)) {
        return false;
      }

      const startSec = Math.max(state.timeSec, producer.busyUntil);
      const endSec = startSec + definition.researchTimeSec;

      spend(state.resources, definition.cost);
      producer.busyUntil = endSec;
      addEventRef(state, action.startRef);
      state.researchJobs.push({
        producerKey: producer.key,
        techId: action.techId,
        startSec,
        endSec,
        startRef: action.startRef,
        completeRef: action.completeRef,
      });
      pushRawSegment(state, {
        laneId: producer.key,
        label: definition.name,
        startSec,
        endSec,
        state: 'researching',
      });
      return true;
    }

    case 'advance_age': {
      const techId = ageTechId(action.age);
      const tech = ruleset.techs[techId];
      const producer = idleProducer(state, 'town_center');
      if (!tech || !producer || !canAdvanceToAge(state, ruleset, action.age)) {
        return false;
      }

      const startSec = Math.max(state.timeSec, producer.busyUntil);
      const endSec = startSec + tech.researchTimeSec;

      spend(state.resources, tech.cost);
      producer.busyUntil = endSec;
      state.researchJobs.push({
        producerKey: producer.key,
        techId,
        startSec,
        endSec,
        ageTarget: action.age,
        startRef: action.startRef,
        completeRef: action.completeRef,
      });
      pushRawSegment(state, {
        laneId: producer.key,
        label: tech.name,
        startSec,
        endSec,
        state: 'researching',
      });
      milestones.ageClickedAt[action.age] = state.timeSec;
      addEventRef(state, action.startRef);
      recordMilestoneUnits(milestones, state, 'age_click', action.age);
      return true;
    }
  }

  return false;
}

function fireTriggeredEvents(
  scenario: ResolvedScenario,
  state: EngineState,
  ruleset: Ruleset,
  milestones: SimulationMilestones,
) {
  for (const event of scenario.resolvedEvents) {
    if (!event.enabled || state.firedEvents.has(event.id)) {
      continue;
    }

    let isTriggered = false;
    switch (event.trigger.type) {
      case 'on_start':
        isTriggered = state.timeSec === 0;
        break;
      case 'at_time':
        isTriggered = state.timeSec >= event.trigger.timeSec;
        break;
      case 'at_population':
        isTriggered = state.population >= event.trigger.population;
        break;
      case 'at_villager_count':
        isTriggered = (state.units.villager ?? 0) >= event.trigger.villagers;
        break;
      case 'on_age_reached':
        isTriggered = state.age === event.trigger.age;
        break;
      case 'on_entity_complete':
        isTriggered = hasEventRef(state, event.trigger.entityRef);
        break;
      case 'when_affordable':
        isTriggered = canAfford(state.resources, event.trigger.cost);
        break;
      case 'when_condition':
        isTriggered = false;
        break;
      default:
        isTriggered = false;
    }

    if (!isTriggered) {
      continue;
    }

    state.firedEvents.add(event.id);
    for (const action of event.actions) {
      const success = tryApplyAction(action, scenario, state, ruleset, milestones);
      if (!success) {
        addPendingAction(scenario, state, action, event.id, state.timeSec);
      }
    }
  }
}

function processPendingActions(
  scenario: ResolvedScenario,
  state: EngineState,
  ruleset: Ruleset,
  milestones: SimulationMilestones,
) {
  if (state.pendingActions.length === 0) {
    return false;
  }

  for (let index = 0; index < state.pendingActions.length; index += 1) {
    const pending = state.pendingActions[index];
    const success = tryApplyAction(pending.action, scenario, state, ruleset, milestones);
    if (success) {
      state.pendingActions.splice(index, 1);
      return true;
    }
  }

  return false;
}

function buildHousePolicyAction(scenario: ResolvedScenario, state: EngineState, ruleset: Ruleset): Action | null {
  const policy = scenario.policies.find((item): item is Extract<Policy, { kind: 'auto_house' }> => item.kind === 'auto_house' && item.enabled);
  if (!policy) {
    return null;
  }

  const activeHouseBuild = state.buildJobs.some((job) => job.buildingId === 'house');
  if (activeHouseBuild) {
    return null;
  }

  const freePop = state.popCap - (state.population + popRequiredForQueuedUnits(state, ruleset));
  if (freePop > policy.popBuffer) {
    return null;
  }

  return {
    type: 'build',
    buildingId: 'house',
    builders: policy.builders,
    priority: policy.priority,
    walkToStartTiles: 0,
    walkAfterCompleteTiles: 0,
  };
}

function buildLoomAction(state: EngineState, ruleset: Ruleset, scenario: ResolvedScenario): Action | null {
  if (scenario.buildOrder) {
    return null;
  }

  const loomTiming = normalizedLoomTiming(scenario.assumptions.loomTiming);
  if (loomTiming === 'skip' || state.researchedTechs.has('loom') || state.researchJobs.some((job) => job.techId === 'loom')) {
    return null;
  }

  let due = false;
  switch (loomTiming) {
    case 'dark_start':
      due = state.timeSec === 0;
      break;
    case 'dark_end':
      due = state.age === 'dark' && !state.researchJobs.some((job) => job.ageTarget === 'feudal') && canAdvanceToAge(state, ruleset, 'feudal');
      break;
    case 'feudal_start':
      due = state.age === 'feudal';
      break;
    case 'feudal_end':
      due = state.age === 'feudal' && !state.researchJobs.some((job) => job.ageTarget === 'castle') && canAdvanceToAge(state, ruleset, 'castle');
      break;
    case 'castle_start':
      due = state.age === 'castle';
      break;
    default:
      due = false;
  }

  if (!due) {
    return null;
  }

  return {
    type: 'research',
    techId: 'loom',
    atBuildingId: 'town_center',
    priority: 'high',
  };
}

function buildCastleAgePolicyAction(scenario: ResolvedScenario, state: EngineState): Action | null {
  const policy = scenario.policies.find(
    (item): item is Extract<Policy, { kind: 'click_age_asap' }> => item.kind === 'click_age_asap' && item.targetAge === 'castle' && item.enabled,
  );
  if (!policy || state.age !== 'feudal') {
    return null;
  }

  return { type: 'advance_age', age: 'castle', priority: policy.priority };
}

function buildKeepQueueActions(scenario: ResolvedScenario, state: EngineState) {
  const priorities = ageRow(scenario.assumptions.agePriorityGrid, state.age);
  const actions: Array<{ rank: number; action: Action }> = [];

  const rankForProducer = (producerType: 'town_center' | 'archery_range' | 'stable' | 'barracks') => {
    switch (producerType) {
      case 'town_center':
        return priorities.town_center;
      case 'archery_range':
        return priorities.archery_range;
      case 'stable':
        return priorities.stable;
      case 'barracks':
        return priorities.barracks;
      default:
        return priorities.save;
    }
  };

  for (const policy of scenario.policies) {
    if (!policy.enabled || policy.kind !== 'keep_queue_busy') {
      continue;
    }

    const producerType =
      policy.producerType === 'town_center' ||
      policy.producerType === 'archery_range' ||
      policy.producerType === 'stable' ||
      policy.producerType === 'barracks'
        ? policy.producerType
        : null;

    if (!producerType) {
      continue;
    }

    const producerCount = producerByBuilding(state, producerType).length;
    if (producerType !== 'town_center' && producerCount === 0) {
      continue;
    }

    actions.push({
      rank: rankForProducer(producerType),
      action: {
        type: 'train_once',
        unitId: policy.productId,
        atBuildingId: producerType,
        priority: policy.priority,
        walkTilesBeforeTasks: [],
      },
    });
  }

  return actions.sort((a, b) => a.rank - b.rank).map((item) => item.action);
}

function processPolicies(
  scenario: ResolvedScenario,
  state: EngineState,
  ruleset: Ruleset,
  milestones: SimulationMilestones,
) {
  const loomAction = buildLoomAction(state, ruleset, scenario);
  if (loomAction && tryApplyAction(loomAction, scenario, state, ruleset, milestones)) {
    return true;
  }

  const houseAction = buildHousePolicyAction(scenario, state, ruleset);
  if (houseAction && tryApplyAction(houseAction, scenario, state, ruleset, milestones)) {
    return true;
  }

  const castleAction = buildCastleAgePolicyAction(scenario, state);
  if (castleAction && tryApplyAction(castleAction, scenario, state, ruleset, milestones)) {
    return true;
  }

  const queueActions = buildKeepQueueActions(scenario, state);
  for (const action of queueActions) {
    if (tryApplyAction(action, scenario, state, ruleset, milestones)) {
      return true;
    }
  }

  return false;
}

function markAffordableMilestones(milestones: SimulationMilestones, state: EngineState, ruleset: Ruleset) {
  if (milestones.ageAffordableAt.feudal == null && canAdvanceToAge(state, ruleset, 'feudal')) {
    milestones.ageAffordableAt.feudal = state.timeSec;
  }
  if (milestones.ageAffordableAt.castle == null && canAdvanceToAge(state, ruleset, 'castle')) {
    milestones.ageAffordableAt.castle = state.timeSec;
  }
}

function recordKeyframe(keyframes: Keyframe[], state: EngineState) {
  keyframes.push({
    timeSec: state.timeSec,
    stockpile: cloneStock(state.resources),
    reserved: {},
    committed: {},
    resourcePools: cloneResourcePools(state.resourcePools),
    age: state.age,
    population: state.population,
    popCap: state.popCap,
    units: { ...state.units },
    buildings: { ...state.buildings },
    tasks: cloneTaskCounts(state.tasks),
  });
}

function processResourceGathering(state: EngineState, ruleset: Ruleset) {
  for (const villager of state.villagers) {
    switch (villager.task) {
      case 'sheep': {
        const gathered = Math.min(ruleset.gatherRates.sheep, state.resourcePools.sheep);
        state.resources.food += gathered;
        state.resourcePools.sheep = Math.max(0, state.resourcePools.sheep - gathered);
        break;
      }
      case 'boar': {
        const gathered = Math.min(ruleset.gatherRates.boar, state.resourcePools.boar);
        state.resources.food += gathered;
        state.resourcePools.boar = Math.max(0, state.resourcePools.boar - gathered);
        break;
      }
      case 'berries': {
        const gathered = Math.min(ruleset.gatherRates.berries, state.resourcePools.berries);
        state.resources.food += gathered;
        state.resourcePools.berries = Math.max(0, state.resourcePools.berries - gathered);
        break;
      }
      case 'deer': {
        const gathered = Math.min(ruleset.gatherRates.deer, state.resourcePools.deer);
        state.resources.food += gathered;
        state.resourcePools.deer = Math.max(0, state.resourcePools.deer - gathered);
        break;
      }
      case 'farms': {
        const gathered = Math.min(ruleset.gatherRates.farms, villager.farmFoodRemaining);
        state.resources.food += gathered;
        villager.farmFoodRemaining = Math.max(0, villager.farmFoodRemaining - gathered);
        state.resourcePools.farms = Math.max(0, state.resourcePools.farms - gathered);
        break;
      }
      case 'wood':
        state.resources.wood += ruleset.gatherRates.wood;
        break;
      case 'gold':
        state.resources.gold += ruleset.gatherRates.gold;
        break;
      case 'stone':
        state.resources.stone += ruleset.gatherRates.stone;
        break;
      default:
        break;
    }
  }
}

function processVillagerTransitions(state: EngineState, ruleset: Ruleset) {
  for (const job of state.buildJobs) {
    if (!job.started && job.buildStartSec <= state.timeSec) {
      job.started = true;
      for (const builderId of job.builderIds) {
        const villager = state.villagers.find((item) => item.id === builderId);
        if (!villager) continue;
        if (villager.task === 'walk') {
          decrementTask(state, 'walk');
          incrementTask(state, 'build');
        }
        villager.task = 'build';
        villager.pendingTask = null;
        villager.walkUntil = null;
        setVillagerVisual(state, villager, 'building', `Build ${job.label}`);
      }
    }
  }

  for (const villager of state.villagers) {
    if (villager.task === 'walk' && villager.pendingBuildJobId == null && villager.walkUntil != null && villager.walkUntil <= state.timeSec) {
      if (villager.farmBuildUntil != null) {
        decrementTask(state, 'walk');
        incrementTask(state, 'build');
        villager.task = 'build';
        villager.walkUntil = null;
        setVillagerVisual(state, villager, 'building', 'Build farm');
      } else if (villager.pendingTask) {
        setVillagerTaskImmediate(state, villager, villager.pendingTask, taskLabel(villager.pendingTask));
      }
    }

    if (villager.task === 'build' && villager.farmBuildUntil != null && villager.farmBuildUntil <= state.timeSec) {
      villager.farmFoodRemaining = ruleset.startingFoodSources.farmFood;
      state.resourcePools.farms += ruleset.startingFoodSources.farmFood;
      villager.farmBuildUntil = null;
      setVillagerTaskImmediate(state, villager, 'farms', 'Farms');
    }
  }
}


function refreshProducerBusyUntil(state: EngineState, producerKey: string) {
  const producer = state.producers.get(producerKey);
  if (!producer) {
    return;
  }

  const nextTrainingEnd = state.trainingJobs
    .filter((job) => job.producerKey === producerKey)
    .reduce((maxEnd, job) => Math.max(maxEnd, job.endSec), state.timeSec);

  const nextResearchEnd = state.researchJobs
    .filter((job) => job.producerKey === producerKey)
    .reduce((maxEnd, job) => Math.max(maxEnd, job.endSec), state.timeSec);

  producer.busyUntil = Math.max(state.timeSec, nextTrainingEnd, nextResearchEnd);
}

function processFinishedTraining(state: EngineState, ruleset: Ruleset) {
  const finished = state.trainingJobs.filter((job) => job.endSec <= state.timeSec);
  state.trainingJobs = state.trainingJobs.filter((job) => job.endSec > state.timeSec);

  for (const job of finished) {
    const definition = ruleset.units[job.unitId];
    if (!definition) continue;
    refreshProducerBusyUntil(state, job.producerKey);

    state.units[job.unitId] = (state.units[job.unitId] ?? 0) + 1;
    state.population += definition.populationCost;
    addEventRef(state, job.unitId);
    addEventRef(state, job.completeRef);

    if (job.unitId === 'villager') {
      const defaultTask = taskForNewVillager(state);
      const assignedTasks = job.assignedTasks && job.assignedTasks.length > 0 ? [...job.assignedTasks] : [defaultTask];
      const walkTilesBeforeTasks =
        job.walkTilesBeforeTasks && job.walkTilesBeforeTasks.length > 0
          ? [...job.walkTilesBeforeTasks]
          : [0];

      const villager: Villager = {
        id: state.villagers.length + 1,
        task: 'idle',
        pendingTask: null,
        walkUntil: null,
        pendingBuildJobId: null,
        returnTask: null,
        farmBuildUntil: null,
        farmFoodRemaining: 0,
        orders: assignedTasks,
        walkTilesBeforeTasks,
        orderIndex: 0,
      };
      state.villagers.push(villager);
      incrementTask(state, 'idle');
      setVillagerVisual(state, villager, 'idle', 'Spawned');

      const firstTask = assignedTasks[0] ?? 'idle';
      const firstWalkTiles = walkTilesBeforeTasks[0] ?? 0;
      transitionVillagerToTask(state, ruleset, villager, firstTask, firstWalkTiles);
    }
  }

  return finished.length > 0;
}

function processFinishedResearch(state: EngineState, ruleset: Ruleset, milestones: SimulationMilestones) {
  const finished = state.researchJobs.filter((job) => job.endSec <= state.timeSec);
  state.researchJobs = state.researchJobs.filter((job) => job.endSec > state.timeSec);

  for (const job of finished) {
    refreshProducerBusyUntil(state, job.producerKey);
    state.researchedTechs.add(job.techId);
    addEventRef(state, job.techId);
    addEventRef(state, job.completeRef);

    if (job.ageTarget) {
      state.age = job.ageTarget;
      milestones.ageReachedAt[job.ageTarget] = state.timeSec;
      recordMilestoneUnits(milestones, state, 'age_reach', job.ageTarget);
    }
  }

  return finished.length > 0;
}

function processFinishedBuilds(state: EngineState, ruleset: Ruleset) {
  const finished = state.buildJobs.filter((job) => job.endSec <= state.timeSec);
  state.buildJobs = state.buildJobs.filter((job) => job.endSec > state.timeSec);

  for (const job of finished) {
    state.buildings[job.buildingId] = (state.buildings[job.buildingId] ?? 0) + 1;
    if (job.buildingId === 'house') {
      state.popCap += ruleset.buildings.house.populationProvided;
    }
    addEventRef(state, job.buildingId);
    addEventRef(state, job.completeRef);
    addProducerIfNeeded(state, ruleset, job.buildingId);

    for (const builderId of job.builderIds) {
      const villager = state.villagers.find((item) => item.id === builderId);
      if (!villager) continue;
      if (villager.task === 'build') {
        decrementTask(state, 'build');
      }
      const returnTask = job.returnTasks[builderId] ?? 'idle';
      villager.pendingBuildJobId = null;
      villager.pendingTask = null;
      villager.walkUntil = null;
      villager.returnTask = null;

      if (job.walkAfterCompleteTiles > 0) {
        incrementTask(state, 'walk');
        villager.task = 'walk';
        villager.pendingTask = returnTask;
        villager.walkUntil = state.timeSec + tilesToSeconds(job.walkAfterCompleteTiles);
        setVillagerVisual(state, villager, 'walking', `Walk after ${job.label.toLowerCase()}`);
      } else if (returnTask === 'farms') {
        tryStartFarmForVillager(state, ruleset, villager);
      } else {
        incrementTask(state, returnTask);
        villager.task = returnTask;
        setVillagerVisual(state, villager, returnTask === 'idle' ? 'idle' : 'gathering', taskLabel(returnTask));
      }
    }
  }

  return finished.length > 0;
}

function summarizeBottleneck(blockedDurations: Map<string, number>): string | null {
  const filtered = [...blockedDurations.entries()].filter(([label]) => label !== 'Saving resources');
  filtered.sort((a, b) => b[1] - a[1]);
  return filtered[0]?.[0] ?? null;
}

function mergeSegments(rawSegments: LaneSegment[]) {
  const sorted = [...rawSegments].sort((a, b) => {
    if (a.laneId !== b.laneId) return a.laneId.localeCompare(b.laneId);
    if (a.startSec !== b.startSec) return a.startSec - b.startSec;
    return a.endSec - b.endSec;
  });

  const merged: LaneSegment[] = [];

  for (const segment of sorted) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.laneId === segment.laneId &&
      previous.state === segment.state &&
      previous.label.replace(/ x\d+$/, '') === segment.label.replace(/ x\d+$/, '') &&
      previous.endSec === segment.startSec
    ) {
      previous.endSec = segment.endSec;
      if (/^(tc_|archery_range_|stable_|barracks_)/.test(segment.laneId) && segment.state === 'training') {
        const nextCount = (previous.count ?? 1) + (segment.count ?? 1);
        previous.count = nextCount;
        previous.label = `${segment.label.replace(/ x\d+$/, '')} x${nextCount}`;
      }
      continue;
    }

    merged.push({ ...segment, count: segment.count });
  }

  return merged.filter((segment) => segment.endSec > segment.startSec);
}

export function runSimulation(
  scenario: ResolvedScenario,
  ruleset: Ruleset,
): { run: SimulationRun; milestones: SimulationMilestones } {
  ACTIVE_ASSUMPTIONS = scenario.assumptions;
  ACTIVE_RULESET = ruleset;

  const state = createState(ruleset, scenario);
  const keyframes: Keyframe[] = [];
  const allocationSegments: SimulationRun['allocationSegments'] = [];

  const milestones: SimulationMilestones = {
    ageAffordableAt: {},
    ageClickedAt: {},
    ageReachedAt: {},
    unitCountsAtMilestone: {},
    bottleneckLabel: null,
  };

  let currentAllocationStart = 0;
  let currentAllocationCounts = cloneTaskCounts(state.tasks);

  function flushAllocationIfChanged() {
    if (sameTaskCounts(currentAllocationCounts, state.tasks)) {
      return;
    }
    allocationSegments.push({
      startSec: currentAllocationStart,
      endSec: state.timeSec,
      counts: cloneTaskCounts(currentAllocationCounts),
    });
    currentAllocationStart = state.timeSec;
    currentAllocationCounts = cloneTaskCounts(state.tasks);
  }

  fireTriggeredEvents(scenario, state, ruleset, milestones);
  let progressed = true;
  while (progressed) {
    const pending = processPendingActions(scenario, state, ruleset, milestones);
    const policies = processPolicies(scenario, state, ruleset, milestones);
    progressed = pending || policies;
  }
  applyFoodFallbacks(state, ruleset);
  markAffordableMilestones(milestones, state, ruleset);
  recordKeyframe(keyframes, state);

  const horizonSec = 28 * 60;

  for (let tick = 0; tick < horizonSec; tick += 1) {
    processResourceGathering(state, ruleset);
    state.timeSec += 1;

    const trainingDone = processFinishedTraining(state, ruleset);
    const researchDone = processFinishedResearch(state, ruleset, milestones);
    const buildsDone = processFinishedBuilds(state, ruleset);
    processVillagerTransitions(state, ruleset);
    applyFoodFallbacks(state, ruleset);

    fireTriggeredEvents(scenario, state, ruleset, milestones);
    markAffordableMilestones(milestones, state, ruleset);

    let progressedNow = true;
    while (progressedNow) {
      const pending = processPendingActions(scenario, state, ruleset, milestones);
      const policies = processPolicies(scenario, state, ruleset, milestones);
      progressedNow = pending || policies;
    }

    flushAllocationIfChanged();
    recordKeyframe(keyframes, state);

    if (state.age === 'castle' && state.timeSec > (milestones.ageReachedAt.castle ?? 0) + 90) {
      break;
    }

    cleanupEventRefs(state);
  }

  const totalTime = keyframes[keyframes.length - 1]?.timeSec ?? state.timeSec;
  finalizeVillagerVisuals(state, totalTime);
  allocationSegments.push({
    startSec: currentAllocationStart,
    endSec: totalTime,
    counts: cloneTaskCounts(currentAllocationCounts),
  });

  const laneSegments = mergeSegments(state.rawSegments);

  const baseRun: SimulationRun = SimulationRunSchema.parse({
    scenarioId: scenario.id,
    startedAt: new Date().toISOString(),
    answers: [],
    warnings: [],
    keyframes,
    laneSegments,
    allocationSegments: allocationSegments.filter((segment) => segment.endSec > segment.startSec),
  });

  milestones.bottleneckLabel = summarizeBottleneck(state.blockedDurations);
  const answers = buildAnswers(baseRun, scenario, ruleset, milestones);
  const warnings = buildWarnings(baseRun, scenario, ruleset, milestones, state.blockedDurations);

  const run = SimulationRunSchema.parse({
    ...baseRun,
    answers,
    warnings,
  });

  ACTIVE_ASSUMPTIONS = null;
  ACTIVE_RULESET = null;

  return { run, milestones };
}
