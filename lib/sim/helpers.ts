import type {
  Age,
  PartialResourceStock,
  Priority,
  Resource,
  ResourceStock,
  Task,
} from "./schema";

export const TASKS: Task[] = [
  "sheep",
  "boar",
  "berries",
  "farms",
  "wood",
  "gold",
  "stone",
  "build",
  "walk",
  "idle",
];

export const RESOURCES: Resource[] = ["food", "wood", "gold", "stone"];

export const AGES: Age[] = ["dark", "feudal", "castle", "imperial"];

export function createEmptyStock(): ResourceStock {
  return {
    food: 0,
    wood: 0,
    gold: 0,
    stone: 0,
  };
}

export function createEmptyTaskCounts(): Record<Task, number> {
  return {
    sheep: 0,
    boar: 0,
    berries: 0,
    farms: 0,
    wood: 0,
    gold: 0,
    stone: 0,
    build: 0,
    walk: 0,
    idle: 0,
  };
}

export function cloneStock(stock: PartialResourceStock | ResourceStock): ResourceStock {
  return {
    food: stock.food ?? 0,
    wood: stock.wood ?? 0,
    gold: stock.gold ?? 0,
    stone: stock.stone ?? 0,
  };
}

export function cloneTaskCounts(
  counts: Partial<Record<Task, number>> | Record<Task, number>,
): Record<Task, number> {
  return {
    sheep: counts.sheep ?? 0,
    boar: counts.boar ?? 0,
    berries: counts.berries ?? 0,
    farms: counts.farms ?? 0,
    wood: counts.wood ?? 0,
    gold: counts.gold ?? 0,
    stone: counts.stone ?? 0,
    build: counts.build ?? 0,
    walk: counts.walk ?? 0,
    idle: counts.idle ?? 0,
  };
}

export function addStock(target: ResourceStock, delta: PartialResourceStock) {
  for (const resource of RESOURCES) {
    target[resource] += delta[resource] ?? 0;
  }
}

export function canAfford(stock: ResourceStock, cost: PartialResourceStock) {
  return RESOURCES.every((resource) => stock[resource] >= (cost[resource] ?? 0));
}

export function spend(stock: ResourceStock, cost: PartialResourceStock) {
  for (const resource of RESOURCES) {
    targetFloor(stock, resource, stock[resource] - (cost[resource] ?? 0));
  }
}

export function targetFloor(stock: ResourceStock, resource: Resource, value: number) {
  stock[resource] = Math.max(0, value);
}

export function sumFoodWorkers(counts: Record<Task, number>) {
  return counts.sheep + counts.boar + counts.berries + counts.farms;
}

export function totalVillagerTasks(counts: Record<Task, number>) {
  return TASKS.reduce((sum, task) => sum + counts[task], 0);
}

export function sameTaskCounts(a: Record<Task, number>, b: Record<Task, number>) {
  return TASKS.every((task) => a[task] === b[task]);
}

export function priorityScore(priority: Priority) {
  switch (priority) {
    case "must":
      return 0;
    case "high":
      return 1;
    case "normal":
      return 2;
    case "low":
      return 3;
    default:
      return 9;
  }
}

export function ageTechId(age: Age) {
  switch (age) {
    case "feudal":
      return "feudal_age";
    case "castle":
      return "castle_age";
    case "imperial":
      return "imperial_age";
    default:
      return "dark_age";
  }
}

export function ageLabel(age: Age) {
  switch (age) {
    case "dark":
      return "Dark Age";
    case "feudal":
      return "Feudal Age";
    case "castle":
      return "Castle Age";
    case "imperial":
      return "Imperial Age";
    default:
      return age;
  }
}

export function aggregateFoodLikeCounts(counts: Record<Task, number>) {
  return counts.sheep + counts.boar + counts.berries + counts.farms;
}

export function segmentDuration(startSec: number, endSec: number) {
  return Math.max(0, endSec - startSec);
}
