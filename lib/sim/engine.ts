import { buildAnswers, type SimulationMilestones } from "./answers";
import { buildWarnings } from "./warnings";
import {
  type Action,
  type Age,
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

interface BuildJob {
  laneId: string;
  buildingId: string;
  endSec: number;
  returnTasks: Task[];
  label: string;
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
  nextVillagerAssignments: Task[];
  pendingActions: PendingAction[];
  completedEntityRefs: Set<string>;
  firedEvents: Set<string>;
  producers: Map<string, Producer>;
  trainingJobs: TrainingJob[];
  researchJobs: ResearchJob[];
  buildJobs: BuildJob[];
}

interface ProducerVisualState {
  state: LaneSegment["state"];
  label: string;
  startSec: number;
}

function createState(ruleset: Ruleset): EngineState {
  return {
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
    tasks: (() => {
      const tasks = createEmptyTaskCounts();
      tasks.sheep = ruleset.startingVillagers;
      return tasks;
    })(),
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

  state.pendingActions.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    return a.createdAt - b.createdAt;
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

function allocateBuilders(state: EngineState, count: number, buildingId: string) {
  const taken: Task[] = [];
  const sources = preferredBuilderSources(buildingId);

  for (const task of sources) {
    while ((state.tasks[task] ?? 0) > 0 && taken.length < count) {
      state.tasks[task] -= 1;
      state.tasks.build += 1;
      taken.push(task);
    }

    if (taken.length === count) {
      break;
    }
  }

  if (taken.length < count) {
    for (const task of taken) {
      state.tasks.build -= 1;
      state.tasks[task] += 1;
    }

    return null;
  }

  return taken;
}

function releaseBuilders(state: EngineState, returnTasks: Task[]) {
  for (const task of returnTasks) {
    state.tasks.build = Math.max(0, state.tasks.build - 1);
    state.tasks[task] += 1;
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

    if (!canAfford(state.resources, ruleset.units.villager.cost)) {
      return "Missing food";
    }

    return "Idle";
  }

  if ((state.population + 1) > state.popCap) {
    return "Need house";
  }

  const agePolicy = scenario.policies.find(
    (policy: ResolvedScenario["policies"][number]) => policy.kind === "click_age_asap" && policy.targetAge === "castle" && policy.enabled,
  );

  const closeToCastle =
    agePolicy &&
    state.age === "feudal" &&
    hasCastlePrereqs(state) &&
    (state.resources.food >= 650 || state.resources.gold >= 150);

  if (agePolicy && agePolicy.kind === "click_age_asap" && closeToCastle && agePolicy.canPause.includes("military")) {
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
  milestones: SimulationMilestones,
): boolean {
  switch (action.type) {
    case "assign_existing_villagers": {
      let remaining = action.count;
      const sourceTasks: Task[] = action.from
        ? [action.from]
        : ["idle", "sheep", "boar", "berries", "farms", "wood", "gold", "stone"];

      for (const task of sourceTasks) {
        while (remaining > 0 && (state.tasks[task] ?? 0) > 0) {
          state.tasks[task] -= 1;
          state.tasks[action.to] += 1;
          remaining -= 1;
        }

        if (remaining === 0) {
          break;
        }
      }

      return remaining === 0;
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

      if (!canAfford(state.resources, definition.cost)) {
        return false;
      }

      if (action.buildingId === "archery_range" && (state.buildings.barracks ?? 0) < 1) {
        return false;
      }

      const returnTasks = allocateBuilders(state, action.builders, action.buildingId);
      if (!returnTasks) {
        return false;
      }

      spend(state.resources, definition.cost);
      state.buildJobs.push({
        laneId: action.buildingId === "house" ? "construction_auto" : "construction_main",
        buildingId: action.buildingId,
        endSec: state.timeSec + definition.buildTimeSec,
        returnTasks,
        label: definition.name,
      });
      return true;
    }

    case "train_once": {
      const definition = ruleset.units[action.unitId];
      if (!definition) {
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
      const success = tryApplyAction(action, state, ruleset, milestones);
      if (!success) {
        addPendingAction(state, action, event.id, state.timeSec);
      }
    }
  }
}

function processPendingActions(
  state: EngineState,
  ruleset: Ruleset,
  milestones: SimulationMilestones,
) {
  if (state.pendingActions.length === 0) {
    return false;
  }

  for (let index = 0; index < state.pendingActions.length; index += 1) {
    const pending = state.pendingActions[index];
    const success = tryApplyAction(pending.action, state, ruleset, milestones);
    if (success) {
      state.pendingActions.splice(index, 1);
      return true;
    }
  }

  return false;
}

function buildHousePolicyAction(scenario: ResolvedScenario, state: EngineState): Action | null {
  const policy = scenario.policies.find((item: ResolvedScenario["policies"][number]) => item.kind === "auto_house" && item.enabled);
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
): Action | null {
  const policy = scenario.policies.find(
    (item: ResolvedScenario["policies"][number]) => item.kind === "click_age_asap" && item.targetAge === "castle" && item.enabled,
  );

  if (!policy || policy.kind !== "click_age_asap") {
    return null;
  }

  if (state.age !== "feudal") {
    return null;
  }

  return {
    type: "advance_age",
    age: "castle",
    priority: policy.priority,
  };
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
        actions.push({
          type: "train_once",
          unitId: policy.productId,
          atBuildingId: "archery_range",
          priority: policy.priority,
        });
      }
    }
  }

  return actions.sort((a, b) => {
    const left = "priority" in a ? priorityScore(a.priority) : 9;
    const right = "priority" in b ? priorityScore(b.priority) : 9;
    return left - right;
  });
}

function processPolicies(
  scenario: ResolvedScenario,
  state: EngineState,
  ruleset: Ruleset,
  milestones: SimulationMilestones,
) {
  const houseAction = buildHousePolicyAction(scenario, state);
  if (houseAction && tryApplyAction(houseAction, state, ruleset, milestones)) {
    return true;
  }

  const castleAction = buildCastleAgePolicyAction(scenario, state);
  if (castleAction && tryApplyAction(castleAction, state, ruleset, milestones)) {
    return true;
  }

  const queueActions = buildKeepQueueActions(scenario, state);
  for (const action of queueActions) {
    if (tryApplyAction(action, state, ruleset, milestones)) {
      return true;
    }
  }

  return false;
}

function recordKeyframe(
  keyframes: Keyframe[],
  state: EngineState,
) {
  keyframes.push({
    timeSec: state.timeSec,
    stockpile: cloneStock(state.resources),
    reserved: {},
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

  const [top] = [...labelDurations.entries()].sort((a, b) => b[1] - a[1]);
  return top?.[0] ?? null;
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

  const producerVisuals = new Map<string, ProducerVisualState>();
  let currentAllocationStart = 0;
  let currentAllocationCounts = cloneTaskCounts(state.tasks);

  function setProducerVisual(
    laneId: string,
    stateName: ProducerVisualState["state"],
    label: string,
    startAt = state.timeSec,
  ) {
    const current = producerVisuals.get(laneId);
    if (!current) {
      producerVisuals.set(laneId, {
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

    producerVisuals.set(laneId, {
      state: stateName,
      label,
      startSec: state.timeSec,
    });
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
    for (const [laneId, visual] of producerVisuals.entries()) {
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

  fireTriggeredEvents(scenario, state, ruleset, milestones);

  let keepLooping = true;
  while (keepLooping) {
    const progressedPending = processPendingActions(state, ruleset, milestones);
    const progressedPolicies = processPolicies(scenario, state, ruleset, milestones);
    keepLooping = progressedPending || progressedPolicies;
  }

  recordKeyframe(keyframes, state);

  const horizonSec = 26 * 60;

  for (let second = 0; second < horizonSec; second += 1) {
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

    state.timeSec += 1;

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
        state.villagers += 1;
        state.units.villager = (state.units.villager ?? 0) + 1;
        state.population += 1;
        const nextTask = taskForNewVillager(state);
        state.tasks[nextTask] += 1;
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
      releaseBuilders(state, job.returnTasks);
      state.completedEntityRefs.add(job.buildingId);
      addProducerIfNeeded(state, job.buildingId);
    }

    fireTriggeredEvents(scenario, state, ruleset, milestones);
    markAffordableMilestones(milestones, state, ruleset);

    let progressed = true;
    while (progressed) {
      const progressedPending = processPendingActions(state, ruleset, milestones);
      const progressedPolicies = processPolicies(scenario, state, ruleset, milestones);
      progressed = progressedPending || progressedPolicies;
    }

    for (const producer of state.producers.values()) {
      if (!producer.built) {
        continue;
      }

      if (producer.busyUntil > state.timeSec) {
        const producerState =
          producer.state === "researching" ? "researching" : producer.state === "training" ? "training" : "idle";
        setProducerVisual(producer.key, producerState, producer.label);
        continue;
      }

      if (producer.buildingId === "town_center") {
        const reason = queueBlockedReason(state, ruleset, "town_center", scenario);
        setProducerVisual(producer.key, reason === "Idle" ? "idle" : "blocked", reason);
      } else if (producer.buildingId === "archery_range") {
        const reason = queueBlockedReason(state, ruleset, "archery_range", scenario);
        setProducerVisual(producer.key, reason === "Idle" ? "idle" : "blocked", reason);
      } else {
        setProducerVisual(producer.key, "idle", "Idle");
      }
    }

    const activeConstruction = state.buildJobs
      .filter((job) => job.laneId === "construction_main")
      .sort((a, b) => a.endSec - b.endSec)[0];

    if (activeConstruction) {
      setProducerVisual("construction_main", "building", activeConstruction.label, activeConstruction.endSec - ruleset.buildings[activeConstruction.buildingId].buildTimeSec);
    } else if (producerVisuals.has("construction_main")) {
      setProducerVisual("construction_main", "idle", "Idle");
    }

    const activeAutoConstruction = state.buildJobs
      .filter((job) => job.laneId === "construction_auto")
      .sort((a, b) => a.endSec - b.endSec)[0];

    if (activeAutoConstruction) {
      setProducerVisual("construction_auto", "building", activeAutoConstruction.label, activeAutoConstruction.endSec - ruleset.buildings[activeAutoConstruction.buildingId].buildTimeSec);
    } else if (producerVisuals.has("construction_auto")) {
      setProducerVisual("construction_auto", "idle", "Idle");
    }

    flushAllocationIfChanged();

    if (state.timeSec % 5 === 0 || finishedResearch.length > 0 || finishedBuilds.length > 0 || finishedTraining.length > 0) {
      recordKeyframe(keyframes, state);
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
    laneSegments: laneSegments.filter((segment: LaneSegment) => segment.endSec > segment.startSec),
    allocationSegments: allocationSegments.filter((segment: SimulationRun["allocationSegments"][number]) => segment.endSec > segment.startSec),
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
