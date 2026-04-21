import { buildAnswers, type SimulationMilestones } from "./answers";
import { buildWarnings } from "./warnings";
import {
  type Action,
  type Age,
  type Assumptions,
  type Keyframe,
  type LaneSegment,
  type ResolvedScenario,
  type ResourceStock,
  type Ruleset,
  type SimulationRun,
  type Task,
  SimulationRunSchema,
} from "./schema";
import {
  ageTechId,
  AGES,
  canAfford,
  cloneStock,
  cloneTaskCounts,
  createEmptyTaskCounts,
  priorityScore,
  sameTaskCounts,
  spend,
} from "./helpers";

interface PendingAction {
  action: Action;
  eventId: string;
  priority: number;
  createdAt: number;
}

interface Producer {
  key: string;
  buildingId: string;
  label: string;
  state: "idle" | "training" | "researching" | "building" | "blocked";
  busyUntil: number;
  built: boolean;
}

interface TrainingJob {
  producerKey: string;
  unitId: string;
  endSec: number;
}

interface ResearchJob {
  producerKey: string;
  techId: string;
  endSec: number;
  ageTarget?: Age;
}

interface BuilderAssignment {
  villagerId: number;
  returnTask: Task;
}

interface BuildJob {
  laneId: string;
  buildingId: string;
  endSec: number;
  builders: BuilderAssignment[];
  label: string;
}

interface VillagerState {
  id: number;
  task: Task;
  pendingTask: Task | null;
  walkUntil: number | null;
}

interface EngineState {
  timeSec: number;
  age: Age;
  resources: ResourceStock;
  villagers: number;
  population: number;
  popCap: number;
  units: Record<string, number>;
  buildings: Record<string, number>;
  tasks: Record<Task, number>;
  villagerRoster: VillagerState[];
  nextVillagerId: number;
  nextVillagerAssignments: Task[];
  pendingActions: PendingAction[];
  completedEntityRefs: Set<string>;
  firedEvents: Set<string>;
  producers: Map<string, Producer>;
  trainingJobs: TrainingJob[];
  researchJobs: ResearchJob[];
  buildJobs: BuildJob[];
}

interface LaneVisualState {
  state: LaneSegment["state"];
  label: string;
  startSec: number;
}

interface CastleReserveStatus {
  action: Action | null;
  active: boolean;
  remaining: Partial<ResourceStock>;
  canPause: Array<"military" | "economy" | "town_center">;
}

const FOOD_TASKS: Task[] = ["sheep", "boar", "berries", "farms"];
const DEFAULT_HORIZON_SEC = 28 * 60;

function ageRank(age: Age) {
  return AGES.indexOf(age);
}

function createVillagerRoster(count: number): VillagerState[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    task: "sheep",
    pendingTask: null,
    walkUntil: null,
  }));
}

function createState(ruleset: Ruleset): EngineState {
  const villagerRoster = createVillagerRoster(ruleset.startingVillagers);
  const state: EngineState = {
    timeSec: 0,
    age: "dark",
    resources: cloneStock(ruleset.startingResources),
    villagers: ruleset.startingVillagers,
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
    tasks: createEmptyTaskCounts(),
    villagerRoster,
    nextVillagerId: ruleset.startingVillagers + 1,
    nextVillagerAssignments: [],
    pendingActions: [],
    completedEntityRefs: new Set<string>(),
    firedEvents: new Set<string>(),
    producers: new Map<string, Producer>([
      [
        "tc_1",
        {
          key: "tc_1",
          buildingId: "town_center",
          label: "Idle",
          state: "idle",
          busyUntil: 0,
          built: true,
        },
      ],
    ]),
    trainingJobs: [],
    researchJobs: [],
    buildJobs: [],
  };

  syncTaskCounts(state);
  return state;
}

function syncTaskCounts(state: EngineState) {
  const nextCounts = createEmptyTaskCounts();

  for (const villager of state.villagerRoster) {
    nextCounts[villager.task] += 1;
  }

  state.tasks = nextCounts;
  state.villagers = state.villagerRoster.length;
  state.units.villager = state.villagerRoster.length;
}

function hasDarkAgePrereqs(state: EngineState) {
  return (state.buildings.lumber_camp ?? 0) + (state.buildings.mill ?? 0) >= 2;
}

function hasCastlePrereqs(state: EngineState) {
  return (state.buildings.archery_range ?? 0) + (state.buildings.blacksmith ?? 0) + (state.buildings.market ?? 0) >= 2;
}

function meetsRequirements(
  state: EngineState,
  requirements: Array<{ kind: string; age?: Age; buildingId?: string; count?: number; techId?: string }>,
) {
  return requirements.every((requirement) => {
    if (requirement.kind === "age") {
      return requirement.age ? ageRank(state.age) >= ageRank(requirement.age) : true;
    }

    if (requirement.kind === "building") {
      return (state.buildings[requirement.buildingId ?? ""] ?? 0) >= (requirement.count ?? 1);
    }

    if (requirement.kind === "tech") {
      return state.completedEntityRefs.has(requirement.techId ?? "");
    }

    return true;
  });
}

function canAdvanceToAge(state: EngineState, ruleset: Ruleset, age: Age) {
  const techId = ageTechId(age);
  const tech = ruleset.techs[techId];
  if (!tech) {
    return false;
  }

  if (!canAfford(state.resources, tech.cost)) {
    return false;
  }

  if (age === "feudal") {
    return state.age === "dark" && hasDarkAgePrereqs(state);
  }

  if (age === "castle") {
    return state.age === "feudal" && hasCastlePrereqs(state);
  }

  return false;
}

function recordMilestoneUnits(
  milestones: SimulationMilestones,
  state: EngineState,
  milestone: "age_click" | "age_reach",
  age: Age,
) {
  const trackedUnits = ["archer", "villager"];

  for (const unitId of trackedUnits) {
    milestones.unitCountsAtMilestone[`${unitId}:${milestone}:${age}`] = state.units[unitId] ?? 0;
  }
}

function addPendingAction(state: EngineState, action: Action, eventId: string, createdAt: number) {
  if (action.type === "assign_existing_villagers" || action.type === "assign_next_villagers" || action.type === "note") {
    return false;
  }

  state.pendingActions.push({
    action,
    eventId,
    createdAt,
    priority: "priority" in action ? priorityScore(action.priority) : priorityScore("normal"),
  });

  state.pendingActions.sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    return left.createdAt - right.createdAt;
  });

  return true;
}

function taskForNewVillager(state: EngineState): Task {
  const next = state.nextVillagerAssignments.shift();
  if (next) {
    return next;
  }

  if (state.age === "dark") {
    return "wood";
  }

  if (state.age === "feudal") {
    if ((state.tasks.gold ?? 0) < 6) {
      return "gold";
    }

    if ((state.tasks.wood ?? 0) < 8) {
      return "wood";
    }

    return "farms";
  }

  return "farms";
}

function preferredBuilderSources(buildingId: string): Task[] {
  switch (buildingId) {
    case "mill":
      return ["berries", "sheep", "boar", "wood", "gold"];
    case "lumber_camp":
      return ["wood", "sheep", "berries", "gold"];
    case "mining_camp":
      return ["gold", "wood", "sheep", "berries"];
    case "house":
      return ["wood", "sheep", "berries", "gold"];
    default:
      return ["wood", "sheep", "berries", "gold", "boar", "farms"];
  }
}

function walkDurationForTask(task: Task, assumptions: Assumptions) {
  const lookup = {
    short: 2,
    medium: 4,
    long: 6,
  } as const;

  if (task === "wood") {
    return lookup[assumptions.walkProfile.wood];
  }

  if (task === "gold") {
    return lookup[assumptions.walkProfile.gold];
  }

  if (task === "stone") {
    return lookup[assumptions.walkProfile.stone];
  }

  if (FOOD_TASKS.includes(task)) {
    return lookup[assumptions.walkProfile.food];
  }

  return 0;
}

function findVillager(state: EngineState, villagerId: number) {
  return state.villagerRoster.find((villager) => villager.id === villagerId);
}

function sourceTasksForAction(action: Action & { type: "assign_existing_villagers" }): Task[] {
  if (action.from) {
    return [action.from];
  }

  return ["idle", "sheep", "boar", "berries", "farms", "wood", "gold", "stone"];
}

function selectVillagers(state: EngineState, count: number, sourceTasks: Task[]) {
  const selected: VillagerState[] = [];

  for (const task of sourceTasks) {
    const matches = state.villagerRoster
      .filter((villager) => villager.task === task)
      .sort((left, right) => left.id - right.id);

    for (const villager of matches) {
      if (selected.length >= count) {
        break;
      }

      if (selected.some((item) => item.id === villager.id)) {
        continue;
      }

      selected.push(villager);
    }

    if (selected.length >= count) {
      break;
    }
  }

  return selected;
}

function assignVillagerTask(
  villager: VillagerState,
  task: Task,
  state: EngineState,
  assumptions: Assumptions,
  withWalk = true,
) {
  if (villager.task === task && villager.pendingTask == null) {
    return;
  }

  if (!withWalk || task === "build" || task === "idle" || task === "walk") {
    villager.task = task;
    villager.pendingTask = null;
    villager.walkUntil = null;
    return;
  }

  const walkDuration = walkDurationForTask(task, assumptions);
  if (walkDuration <= 0) {
    villager.task = task;
    villager.pendingTask = null;
    villager.walkUntil = null;
    return;
  }

  villager.task = "walk";
  villager.pendingTask = task;
  villager.walkUntil = state.timeSec + walkDuration;
}

function allocateBuilders(state: EngineState, count: number, buildingId: string): BuilderAssignment[] | null {
  const selected = selectVillagers(state, count, preferredBuilderSources(buildingId));
  if (selected.length < count) {
    return null;
  }

  const builders: BuilderAssignment[] = [];
  for (const villager of selected) {
    const returnTask = villager.task === "walk" ? villager.pendingTask ?? "idle" : villager.task;
    builders.push({ villagerId: villager.id, returnTask });
    villager.task = "build";
    villager.pendingTask = null;
    villager.walkUntil = null;
  }

  syncTaskCounts(state);
  return builders;
}

function releaseBuilders(state: EngineState, builders: BuilderAssignment[], assumptions: Assumptions) {
  for (const builder of builders) {
    const villager = findVillager(state, builder.villagerId);
    if (!villager) {
      continue;
    }

    assignVillagerTask(villager, builder.returnTask, state, assumptions, true);
  }

  syncTaskCounts(state);
}

function updateWalkingVillagers(state: EngineState) {
  let changed = false;

  for (const villager of state.villagerRoster) {
    if (villager.task !== "walk") {
      continue;
    }

    if (villager.walkUntil == null || villager.walkUntil > state.timeSec) {
      continue;
    }

    villager.task = villager.pendingTask ?? "idle";
    villager.pendingTask = null;
    villager.walkUntil = null;
    changed = true;
  }

  if (changed) {
    syncTaskCounts(state);
  }
}

function producerByBuilding(state: EngineState, buildingId: string) {
  return [...state.producers.values()].filter((producer) => producer.buildingId === buildingId && producer.built);
}

function idleProducer(state: EngineState, buildingId: string) {
  return producerByBuilding(state, buildingId).find((producer) => producer.busyUntil <= state.timeSec);
}

function addProducerIfNeeded(state: EngineState, buildingId: string) {
  const supportsQueue = buildingId === "town_center" || buildingId === "archery_range";
  if (!supportsQueue) {
    return;
  }

  const count = producerByBuilding(state, buildingId).length + 1;
  const keyPrefix = buildingId === "town_center" ? "tc" : buildingId;
  const key = `${keyPrefix}_${count}`;

  state.producers.set(key, {
    key,
    buildingId,
    label: "Idle",
    state: "idle",
    busyUntil: state.timeSec,
    built: true,
  });
}

function castleReserveStatus(state: EngineState, scenario: ResolvedScenario, ruleset: Ruleset): CastleReserveStatus {
  const policy = scenario.policies.find(
    (item) => item.kind === "click_age_asap" && item.targetAge === "castle" && item.enabled,
  );

  if (!policy || policy.kind !== "click_age_asap" || state.age !== "feudal") {
    return { action: null, active: false, remaining: {}, canPause: [] };
  }

  const action: Action = {
    type: "advance_age",
    age: "castle",
    priority: policy.priority,
  };

  const castleTech = ruleset.techs.castle_age;
  const remaining = {
    food: Math.max(0, (castleTech.cost.food ?? 0) - state.resources.food),
    gold: Math.max(0, (castleTech.cost.gold ?? 0) - state.resources.gold),
  } satisfies Partial<ResourceStock>;

  const prereqsReady = hasCastlePrereqs(state);
  const affordableSoon = (remaining.food ?? 0) <= 150 || (remaining.gold ?? 0) <= 50;
  const active =
    prereqsReady &&
    policy.reserveMode !== "observe" &&
    (policy.reserveMode === "hard" || affordableSoon || state.resources.food >= 650 || state.resources.gold >= 150);

  return { action, active, remaining, canPause: policy.canPause };
}

function shouldPauseQueue(
  state: EngineState,
  scenario: ResolvedScenario,
  ruleset: Ruleset,
  domain: "military" | "economy" | "town_center",
) {
  const reserve = castleReserveStatus(state, scenario, ruleset);
  return reserve.active && reserve.canPause.includes(domain);
}

function queueBlockedReason(
  state: EngineState,
  ruleset: Ruleset,
  buildingId: "town_center" | "archery_range",
  scenario: ResolvedScenario,
): string {
  if (buildingId === "town_center") {
    if ((state.population + 1) > state.popCap) {
      return "Need house";
    }

    if (shouldPauseQueue(state, scenario, ruleset, "town_center")) {
      return "Castle reserve";
    }

    if (!canAfford(state.resources, ruleset.units.villager.cost)) {
      return "Missing food";
    }

    return "Idle";
  }

  if ((state.population + 1) > state.popCap) {
    return "Need house";
  }

  if (shouldPauseQueue(state, scenario, ruleset, "military")) {
    return "Castle reserve";
  }

  if (!canAfford(state.resources, ruleset.units.archer.cost)) {
    if (state.resources.gold < (ruleset.units.archer.cost.gold ?? 0)) {
      return "Missing gold";
    }

    return "Missing wood";
  }

  return "Idle";
}

function tryApplyAction(
  action: Action,
  state: EngineState,
  ruleset: Ruleset,
  scenario: ResolvedScenario,
  milestones: SimulationMilestones,
): boolean {
  switch (action.type) {
    case "assign_existing_villagers": {
      const selected = selectVillagers(state, action.count, sourceTasksForAction(action));
      if (selected.length < action.count) {
        return false;
      }

      for (const villager of selected) {
        assignVillagerTask(villager, action.to, state, scenario.assumptions, true);
      }

      syncTaskCounts(state);
      return true;
    }

    case "assign_next_villagers": {
      for (let index = 0; index < action.count; index += 1) {
        state.nextVillagerAssignments.push(action.to);
      }
      return true;
    }

    case "note":
      return true;

    case "reserve_resources":
      return true;

    case "build": {
      const definition = ruleset.buildings[action.buildingId];
      if (!definition) {
        return false;
      }

      if (ageRank(state.age) < ageRank(definition.age) || !meetsRequirements(state, definition.requirements)) {
        return false;
      }

      if (!canAfford(state.resources, definition.cost)) {
        return false;
      }

      if (action.buildingId === "archery_range" && (state.buildings.barracks ?? 0) < 1) {
        return false;
      }

      const builders = allocateBuilders(state, action.builders, action.buildingId);
      if (!builders) {
        return false;
      }

      spend(state.resources, definition.cost);
      state.buildJobs.push({
        laneId: action.buildingId === "house" ? "construction_auto" : "construction_main",
        buildingId: action.buildingId,
        endSec: state.timeSec + definition.buildTimeSec,
        builders,
        label: definition.name,
      });
      return true;
    }

    case "train_once": {
      const definition = ruleset.units[action.unitId];
      if (!definition) {
        return false;
      }

      if (ageRank(state.age) < ageRank(definition.age) || !meetsRequirements(state, definition.requirements)) {
        return false;
      }

      if (action.atBuildingId === "archery_range" && shouldPauseQueue(state, scenario, ruleset, "military")) {
        return false;
      }

      if (action.atBuildingId === "town_center" && shouldPauseQueue(state, scenario, ruleset, "town_center")) {
        return false;
      }

      const producer = idleProducer(state, action.atBuildingId);
      if (!producer) {
        return false;
      }

      if (!canAfford(state.resources, definition.cost)) {
        return false;
      }

      if ((state.population + definition.populationCost) > state.popCap) {
        return false;
      }

      spend(state.resources, definition.cost);
      producer.busyUntil = state.timeSec + definition.buildTimeSec;
      producer.state = "training";
      producer.label = definition.name;
      state.trainingJobs.push({
        producerKey: producer.key,
        unitId: action.unitId,
        endSec: producer.busyUntil,
      });
      return true;
    }

    case "research": {
      const definition = ruleset.techs[action.techId];
      if (!definition) {
        return false;
      }

      if (ageRank(state.age) < ageRank(definition.age) || !meetsRequirements(state, definition.requirements)) {
        return false;
      }

      const producer = idleProducer(state, action.atBuildingId);
      if (!producer) {
        return false;
      }

      if (!canAfford(state.resources, definition.cost)) {
        return false;
      }

      spend(state.resources, definition.cost);
      producer.busyUntil = state.timeSec + definition.researchTimeSec;
      producer.state = "researching";
      producer.label = definition.name;
      state.researchJobs.push({
        producerKey: producer.key,
        techId: action.techId,
        endSec: producer.busyUntil,
      });
      return true;
    }

    case "advance_age": {
      const techId = ageTechId(action.age);
      const tech = ruleset.techs[techId];
      const producer = idleProducer(state, "town_center");
      if (!tech || !producer) {
        return false;
      }

      if (!canAdvanceToAge(state, ruleset, action.age)) {
        return false;
      }

      spend(state.resources, tech.cost);
      producer.busyUntil = state.timeSec + tech.researchTimeSec;
      producer.state = "researching";
      producer.label = tech.name;
      state.researchJobs.push({
        producerKey: producer.key,
        techId,
        endSec: producer.busyUntil,
        ageTarget: action.age,
      });

      milestones.ageClickedAt[action.age] = state.timeSec;
      recordMilestoneUnits(milestones, state, "age_click", action.age);
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
      case "on_start":
        isTriggered = state.timeSec === 0;
        break;
      case "at_time":
        isTriggered = state.timeSec >= event.trigger.timeSec;
        break;
      case "at_population":
        isTriggered = state.population >= event.trigger.population;
        break;
      case "at_villager_count":
        isTriggered = state.units.villager >= event.trigger.villagers;
        break;
      case "on_age_reached":
        isTriggered = state.age === event.trigger.age;
        break;
      case "on_entity_complete":
        isTriggered = state.completedEntityRefs.has(event.trigger.entityRef);
        break;
      case "when_affordable":
        isTriggered = canAfford(state.resources, event.trigger.cost);
        break;
      case "when_condition":
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
      const success = tryApplyAction(action, state, ruleset, scenario, milestones);
      if (!success) {
        addPendingAction(state, action, event.id, state.timeSec);
      }
    }
  }
}

function processPendingActions(
  state: EngineState,
  ruleset: Ruleset,
  scenario: ResolvedScenario,
  milestones: SimulationMilestones,
) {
  if (state.pendingActions.length === 0) {
    return false;
  }

  for (let index = 0; index < state.pendingActions.length; index += 1) {
    const pending = state.pendingActions[index];
    const success = tryApplyAction(pending.action, state, ruleset, scenario, milestones);
    if (success) {
      state.pendingActions.splice(index, 1);
      return true;
    }
  }

  return false;
}

function buildHousePolicyAction(scenario: ResolvedScenario, state: EngineState): Action | null {
  const policy = scenario.policies.find((item) => item.kind === "auto_house" && item.enabled);
  if (!policy || policy.kind !== "auto_house") {
    return null;
  }

  const activeHouseBuild = state.buildJobs.some((job) => job.buildingId === "house");
  if (activeHouseBuild) {
    return null;
  }

  const trainingPopulation = state.trainingJobs.reduce((sum, job) => {
    const cost = job.unitId === "villager" || job.unitId === "archer" ? 1 : 0;
    return sum + cost;
  }, 0);

  const freePop = state.popCap - (state.population + trainingPopulation);
  if (freePop > policy.popBuffer) {
    return null;
  }

  return {
    type: "build",
    buildingId: "house",
    builders: policy.builders,
    priority: policy.priority,
  };
}

function buildCastleAgePolicyAction(
  scenario: ResolvedScenario,
  state: EngineState,
  ruleset: Ruleset,
): Action | null {
  const reserve = castleReserveStatus(state, scenario, ruleset);
  return reserve.action;
}

function buildKeepQueueActions(scenario: ResolvedScenario, state: EngineState): Action[] {
  const actions: Action[] = [];

  for (const policy of scenario.policies) {
    if (!policy.enabled || policy.kind !== "keep_queue_busy") {
      continue;
    }

    if (policy.producerType === "town_center") {
      actions.push({
        type: "train_once",
        unitId: policy.productId,
        atBuildingId: "town_center",
        priority: policy.priority,
      });
    }

    if (policy.producerType === "archery_range") {
      const rangeCount = producerByBuilding(state, "archery_range").length;
      if (rangeCount > 0) {
        const repeatCount = Math.min(policy.maxBuildings ?? rangeCount, rangeCount);
        for (let index = 0; index < repeatCount; index += 1) {
          actions.push({
            type: "train_once",
            unitId: policy.productId,
            atBuildingId: "archery_range",
            priority: policy.priority,
          });
        }
      }
    }
  }

  return actions.sort((left, right) => {
    const leftScore = "priority" in left ? priorityScore(left.priority) : 9;
    const rightScore = "priority" in right ? priorityScore(right.priority) : 9;
    return leftScore - rightScore;
  });
}

function processPolicies(
  scenario: ResolvedScenario,
  state: EngineState,
  ruleset: Ruleset,
  milestones: SimulationMilestones,
) {
  const houseAction = buildHousePolicyAction(scenario, state);
  if (houseAction && tryApplyAction(houseAction, state, ruleset, scenario, milestones)) {
    return true;
  }

  const castleAction = buildCastleAgePolicyAction(scenario, state, ruleset);
  if (castleAction && tryApplyAction(castleAction, state, ruleset, scenario, milestones)) {
    return true;
  }

  const queueActions = buildKeepQueueActions(scenario, state);
  for (const action of queueActions) {
    if (tryApplyAction(action, state, ruleset, scenario, milestones)) {
      return true;
    }
  }

  return false;
}

function recordKeyframe(
  keyframes: Keyframe[],
  state: EngineState,
  scenario: ResolvedScenario,
  ruleset: Ruleset,
) {
  const reserve = castleReserveStatus(state, scenario, ruleset);

  keyframes.push({
    timeSec: state.timeSec,
    stockpile: cloneStock(state.resources),
    reserved: reserve.active ? reserve.remaining : {},
    committed: {},
    age: state.age,
    population: state.population,
    popCap: state.popCap,
    units: { ...state.units },
    buildings: { ...state.buildings },
    tasks: cloneTaskCounts(state.tasks),
  });
}

function markAffordableMilestones(
  milestones: SimulationMilestones,
  state: EngineState,
  ruleset: Ruleset,
) {
  if (milestones.ageAffordableAt.feudal == null && canAdvanceToAge(state, ruleset, "feudal")) {
    milestones.ageAffordableAt.feudal = state.timeSec;
  }

  if (milestones.ageAffordableAt.castle == null && canAdvanceToAge(state, ruleset, "castle")) {
    milestones.ageAffordableAt.castle = state.timeSec;
  }
}

function summarizeBottleneck(run: SimulationRun): string | null {
  const labelDurations = new Map<string, number>();

  for (const segment of run.laneSegments) {
    if (segment.state !== "blocked") {
      continue;
    }

    const current = labelDurations.get(segment.label) ?? 0;
    labelDurations.set(segment.label, current + Math.max(0, segment.endSec - segment.startSec));
  }

  const [top] = [...labelDurations.entries()].sort((left, right) => right[1] - left[1]);
  return top?.[0] ?? null;
}

function villagerLaneId(villagerId: number) {
  return `villager_${villagerId}`;
}

function villagerVisual(villager: VillagerState): Pick<LaneVisualState, "label" | "state"> {
  switch (villager.task) {
    case "sheep":
      return { label: "Sheep", state: "gathering" };
    case "boar":
      return { label: "Boar", state: "gathering" };
    case "berries":
      return { label: "Berries", state: "gathering" };
    case "farms":
      return { label: "Farms", state: "gathering" };
    case "wood":
      return { label: "Wood", state: "gathering" };
    case "gold":
      return { label: "Gold", state: "gathering" };
    case "stone":
      return { label: "Stone", state: "gathering" };
    case "build":
      return { label: "Building", state: "building" };
    case "walk":
      return {
        label: villager.pendingTask ? `Walk → ${villager.pendingTask}` : "Walking",
        state: "walking",
      };
    case "idle":
    default:
      return { label: "Idle", state: "idle" };
  }
}

function gatherResourcesForSecond(state: EngineState, ruleset: Ruleset) {
  for (const task of Object.keys(state.tasks) as Task[]) {
    const count = state.tasks[task] ?? 0;
    if (count <= 0) {
      continue;
    }

    const rate = ruleset.gatherRates[task];
    if (rate <= 0) {
      continue;
    }

    if (task === "wood") {
      state.resources.wood += count * rate;
    } else if (task === "gold") {
      state.resources.gold += count * rate;
    } else if (task === "stone") {
      state.resources.stone += count * rate;
    } else {
      state.resources.food += count * rate;
    }
  }
}

export function runSimulation(
  scenario: ResolvedScenario,
  ruleset: Ruleset,
): { run: SimulationRun; milestones: SimulationMilestones } {
  const state = createState(ruleset);
  const keyframes: Keyframe[] = [];
  const laneSegments: LaneSegment[] = [];
  const allocationSegments: SimulationRun["allocationSegments"] = [];

  const milestones: SimulationMilestones = {
    ageAffordableAt: {},
    ageClickedAt: {},
    ageReachedAt: {},
    unitCountsAtMilestone: {},
    bottleneckLabel: null,
  };

  const laneVisuals = new Map<string, LaneVisualState>();
  let currentAllocationStart = 0;
  let currentAllocationCounts = cloneTaskCounts(state.tasks);

  function setLaneVisual(
    laneId: string,
    stateName: LaneVisualState["state"],
    label: string,
    startAt = state.timeSec,
  ) {
    const current = laneVisuals.get(laneId);
    if (!current) {
      laneVisuals.set(laneId, {
        state: stateName,
        label,
        startSec: startAt,
      });
      return;
    }

    if (current.state === stateName && current.label === label) {
      return;
    }

    laneSegments.push({
      laneId,
      label: current.label,
      startSec: current.startSec,
      endSec: state.timeSec,
      state: current.state,
    });

    laneVisuals.set(laneId, {
      state: stateName,
      label,
      startSec: state.timeSec,
    });
  }

  function syncVillagerLaneVisuals() {
    for (const villager of state.villagerRoster) {
      const visual = villagerVisual(villager);
      setLaneVisual(villagerLaneId(villager.id), visual.state, visual.label);
    }
  }

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

  function finalizeVisuals(totalTime: number) {
    for (const [laneId, visual] of laneVisuals.entries()) {
      laneSegments.push({
        laneId,
        label: visual.label,
        startSec: visual.startSec,
        endSec: totalTime,
        state: visual.state,
      });
    }

    allocationSegments.push({
      startSec: currentAllocationStart,
      endSec: totalTime,
      counts: cloneTaskCounts(currentAllocationCounts),
    });
  }

  syncVillagerLaneVisuals();
  fireTriggeredEvents(scenario, state, ruleset, milestones);

  let keepLooping = true;
  while (keepLooping) {
    const progressedPending = processPendingActions(state, ruleset, scenario, milestones);
    const progressedPolicies = processPolicies(scenario, state, ruleset, milestones);
    keepLooping = progressedPending || progressedPolicies;
  }

  syncVillagerLaneVisuals();
  recordKeyframe(keyframes, state, scenario, ruleset);

  for (let second = 0; second < DEFAULT_HORIZON_SEC; second += 1) {
    gatherResourcesForSecond(state, ruleset);
    state.timeSec += 1;

    updateWalkingVillagers(state);

    const finishedTraining = state.trainingJobs.filter((job) => job.endSec <= state.timeSec);
    state.trainingJobs = state.trainingJobs.filter((job) => job.endSec > state.timeSec);

    for (const job of finishedTraining) {
      const producer = state.producers.get(job.producerKey);
      if (producer) {
        producer.busyUntil = state.timeSec;
        producer.state = "idle";
        producer.label = "Idle";
      }

      if (job.unitId === "villager") {
        const nextTask = taskForNewVillager(state);
        const villager: VillagerState = {
          id: state.nextVillagerId,
          task: "idle",
          pendingTask: null,
          walkUntil: null,
        };
        state.nextVillagerId += 1;
        state.villagerRoster.push(villager);
        assignVillagerTask(villager, nextTask, state, scenario.assumptions, true);
        state.population += 1;
        syncTaskCounts(state);
      } else {
        state.units[job.unitId] = (state.units[job.unitId] ?? 0) + 1;
        state.population += ruleset.units[job.unitId]?.populationCost ?? 0;
      }

      state.completedEntityRefs.add(job.unitId);
    }

    const finishedResearch = state.researchJobs.filter((job) => job.endSec <= state.timeSec);
    state.researchJobs = state.researchJobs.filter((job) => job.endSec > state.timeSec);

    for (const job of finishedResearch) {
      const producer = state.producers.get(job.producerKey);
      if (producer) {
        producer.busyUntil = state.timeSec;
        producer.state = "idle";
        producer.label = "Idle";
      }

      state.completedEntityRefs.add(job.techId);

      if (job.ageTarget) {
        state.age = job.ageTarget;
        milestones.ageReachedAt[job.ageTarget] = state.timeSec;
        recordMilestoneUnits(milestones, state, "age_reach", job.ageTarget);
      }
    }

    const finishedBuilds = state.buildJobs.filter((job) => job.endSec <= state.timeSec);
    state.buildJobs = state.buildJobs.filter((job) => job.endSec > state.timeSec);

    for (const job of finishedBuilds) {
      state.buildings[job.buildingId] = (state.buildings[job.buildingId] ?? 0) + 1;
      if (job.buildingId === "house") {
        state.popCap += ruleset.buildings.house.populationProvided;
      }
      releaseBuilders(state, job.builders, scenario.assumptions);
      state.completedEntityRefs.add(job.buildingId);
      addProducerIfNeeded(state, job.buildingId);
    }

    fireTriggeredEvents(scenario, state, ruleset, milestones);
    markAffordableMilestones(milestones, state, ruleset);

    let progressed = true;
    while (progressed) {
      const progressedPending = processPendingActions(state, ruleset, scenario, milestones);
      const progressedPolicies = processPolicies(scenario, state, ruleset, milestones);
      progressed = progressedPending || progressedPolicies;
    }

    syncVillagerLaneVisuals();

    for (const producer of state.producers.values()) {
      if (!producer.built) {
        continue;
      }

      if (producer.busyUntil > state.timeSec) {
        const producerState = producer.state === "researching" ? "researching" : producer.state === "training" ? "training" : "idle";
        setLaneVisual(producer.key, producerState, producer.label);
        continue;
      }

      if (producer.buildingId === "town_center") {
        const reason = queueBlockedReason(state, ruleset, "town_center", scenario);
        setLaneVisual(producer.key, reason === "Idle" ? "idle" : "blocked", reason);
      } else if (producer.buildingId === "archery_range") {
        const reason = queueBlockedReason(state, ruleset, "archery_range", scenario);
        setLaneVisual(producer.key, reason === "Idle" ? "idle" : "blocked", reason);
      } else {
        setLaneVisual(producer.key, "idle", "Idle");
      }
    }

    const activeConstruction = state.buildJobs
      .filter((job) => job.laneId === "construction_main")
      .sort((left, right) => left.endSec - right.endSec)[0];

    if (activeConstruction) {
      setLaneVisual(
        "construction_main",
        "building",
        activeConstruction.label,
        activeConstruction.endSec - ruleset.buildings[activeConstruction.buildingId].buildTimeSec,
      );
    } else if (laneVisuals.has("construction_main")) {
      setLaneVisual("construction_main", "idle", "Idle");
    }

    const activeAutoConstruction = state.buildJobs
      .filter((job) => job.laneId === "construction_auto")
      .sort((left, right) => left.endSec - right.endSec)[0];

    if (activeAutoConstruction) {
      setLaneVisual(
        "construction_auto",
        "building",
        activeAutoConstruction.label,
        activeAutoConstruction.endSec - ruleset.buildings[activeAutoConstruction.buildingId].buildTimeSec,
      );
    } else if (laneVisuals.has("construction_auto")) {
      setLaneVisual("construction_auto", "idle", "Idle");
    }

    flushAllocationIfChanged();

    if (state.timeSec % 5 === 0 || finishedResearch.length > 0 || finishedBuilds.length > 0 || finishedTraining.length > 0) {
      recordKeyframe(keyframes, state, scenario, ruleset);
    }

    if (state.age === "castle" && state.timeSec > (milestones.ageReachedAt.castle ?? 0) + 90) {
      break;
    }
  }

  const totalTime = keyframes[keyframes.length - 1]?.timeSec ?? state.timeSec;
  finalizeVisuals(totalTime);

  const baseRun: SimulationRun = SimulationRunSchema.parse({
    scenarioId: scenario.id,
    startedAt: new Date().toISOString(),
    answers: [],
    warnings: [],
    keyframes,
    laneSegments: laneSegments.filter((segment) => segment.endSec > segment.startSec),
    allocationSegments: allocationSegments.filter((segment) => segment.endSec > segment.startSec),
  });

  milestones.bottleneckLabel = summarizeBottleneck(baseRun);

  const answers = buildAnswers(baseRun, scenario, ruleset, milestones);
  const warnings = buildWarnings(baseRun, scenario, ruleset, milestones);

  const run = SimulationRunSchema.parse({
    ...baseRun,
    answers,
    warnings,
  });

  return { run, milestones };
}
