import { z } from 'zod';

// -----------------------------------------------------------------------------
// Primitive enums
// -----------------------------------------------------------------------------

export const AgeSchema = z.enum(['dark', 'feudal', 'castle', 'imperial']);
export type Age = z.infer<typeof AgeSchema>;

export const ResourceSchema = z.enum(['food', 'wood', 'gold', 'stone']);
export type Resource = z.infer<typeof ResourceSchema>;

export const TaskSchema = z.enum([
  'sheep',
  'boar',
  'berries',
  'deer',
  'farms',
  'wood',
  'gold',
  'stone',
  'build',
  'walk',
  'idle',
]);
export type Task = z.infer<typeof TaskSchema>;

export const PrioritySchema = z.enum(['must', 'high', 'normal', 'low']);
export type Priority = z.infer<typeof PrioritySchema>;

export const LaneSchema = z.enum([
  'age',
  'eco',
  'buildings',
  'production',
  'research',
  'notes',
]);
export type Lane = z.infer<typeof LaneSchema>;

export const SeveritySchema = z.enum(['info', 'warning', 'error']);
export type Severity = z.infer<typeof SeveritySchema>;

export const ProducerTypeSchema = z.enum([
  'town_center',
  'archery_range',
  'barracks',
  'stable',
  'market',
  'blacksmith',
]);
export type ProducerType = z.infer<typeof ProducerTypeSchema>;

export const ProducerStateSchema = z.enum([
  'training',
  'researching',
  'building',
  'gathering',
  'walking',
  'idle',
  'blocked',
]);
export type ProducerState = z.infer<typeof ProducerStateSchema>;

export const LoomTimingSchema = z.enum([
  'skip',
  'dark_start',
  'dark_end',
  'feudal_start',
  'feudal_end',
  'castle_start',
  // legacy values kept for localStorage compatibility
  'auto',
  'early',
  'late',
]);
export type LoomTiming = z.infer<typeof LoomTimingSchema>;

// -----------------------------------------------------------------------------
// Utility shapes
// -----------------------------------------------------------------------------

export const ResourceStockSchema = z.object({
  food: z.number().nonnegative().default(0),
  wood: z.number().nonnegative().default(0),
  gold: z.number().nonnegative().default(0),
  stone: z.number().nonnegative().default(0),
});
export type ResourceStock = z.infer<typeof ResourceStockSchema>;

export const PartialResourceStockSchema = ResourceStockSchema.partial();
export type PartialResourceStock = z.infer<typeof PartialResourceStockSchema>;

export const CountMapSchema = z.record(z.string(), z.number().nonnegative());
export type CountMap = z.infer<typeof CountMapSchema>;

export const TaskCountMapSchema = z.object({
  sheep: z.number().int().nonnegative().optional(),
  boar: z.number().int().nonnegative().optional(),
  berries: z.number().int().nonnegative().optional(),
  deer: z.number().int().nonnegative().optional(),
  farms: z.number().int().nonnegative().optional(),
  wood: z.number().int().nonnegative().optional(),
  gold: z.number().int().nonnegative().optional(),
  stone: z.number().int().nonnegative().optional(),
  build: z.number().int().nonnegative().optional(),
  walk: z.number().int().nonnegative().optional(),
  idle: z.number().int().nonnegative().optional(),
});
export type TaskCountMap = z.infer<typeof TaskCountMapSchema>;

export const ResourcePoolStateSchema = z.object({
  sheep: z.number().nonnegative().default(0),
  boar: z.number().nonnegative().default(0),
  berries: z.number().nonnegative().default(0),
  deer: z.number().nonnegative().default(0),
  farms: z.number().nonnegative().default(0),
});
export type ResourcePoolState = z.infer<typeof ResourcePoolStateSchema>;

const AgePriorityRowSchema = z.object({
  town_center: z.number().int().min(1).max(5).default(1),
  archery_range: z.number().int().min(1).max(5).default(3),
  stable: z.number().int().min(1).max(5).default(4),
  barracks: z.number().int().min(1).max(5).default(4),
  save: z.number().int().min(1).max(5).default(2),
});
export type AgePriorityRow = z.infer<typeof AgePriorityRowSchema>;

export const AgePriorityGridSchema = z.object({
  dark: AgePriorityRowSchema.default({
    town_center: 1,
    archery_range: 4,
    stable: 5,
    barracks: 5,
    save: 2,
  }),
  feudal: AgePriorityRowSchema.default({
    town_center: 1,
    archery_range: 2,
    stable: 4,
    barracks: 4,
    save: 3,
  }),
  castle: AgePriorityRowSchema.default({
    town_center: 1,
    archery_range: 3,
    stable: 3,
    barracks: 4,
    save: 2,
  }),
  imperial: AgePriorityRowSchema.default({
    town_center: 2,
    archery_range: 2,
    stable: 2,
    barracks: 2,
    save: 3,
  }),
});
export type AgePriorityGrid = z.infer<typeof AgePriorityGridSchema>;

// -----------------------------------------------------------------------------
// Assumptions
// -----------------------------------------------------------------------------

export const WalkProfileSchema = z.object({
  food: z.enum(['short', 'medium', 'long']).default('medium'),
  wood: z.enum(['short', 'medium', 'long']).default('medium'),
  gold: z.enum(['short', 'medium', 'long']).default('medium'),
  stone: z.enum(['short', 'medium', 'long']).default('medium'),
});
export type WalkProfile = z.infer<typeof WalkProfileSchema>;

export const AutoDefaultsSchema = z.object({
  inferHardPrereqs: z.boolean().default(true),
  suggestMissingSteps: z.boolean().default(true),
  autoHouseBuffer: z.number().int().min(1).max(20).default(5),
});
export type AutoDefaults = z.infer<typeof AutoDefaultsSchema>;

export const AssumptionsSchema = z.object({
  mapPreset: z.string().min(1).default('arabia'),
  startPreset: z.string().min(1).default('standard'),
  executionProfile: z.enum(['perfect', 'clean', 'ladder']).default('clean'),
  deerPushed: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(0),
  boarLure: z.enum(['clean', 'late', 'failed']).default('clean'),
  loomTiming: LoomTimingSchema.default('dark_end'),
  agePriorityGrid: AgePriorityGridSchema.default({
    dark: { town_center: 1, archery_range: 4, stable: 5, barracks: 5, save: 2 },
    feudal: { town_center: 1, archery_range: 2, stable: 4, barracks: 4, save: 3 },
    castle: { town_center: 1, archery_range: 3, stable: 3, barracks: 4, save: 2 },
    imperial: { town_center: 2, archery_range: 2, stable: 2, barracks: 2, save: 3 },
  }),
  walkProfile: WalkProfileSchema.default({
    food: 'medium',
    wood: 'medium',
    gold: 'medium',
    stone: 'medium',
  }),
  autoDefaults: AutoDefaultsSchema.default({
    inferHardPrereqs: true,
    suggestMissingSteps: true,
    autoHouseBuffer: 5,
  }),
});
export type Assumptions = z.infer<typeof AssumptionsSchema>;

// -----------------------------------------------------------------------------
// Conditions, triggers, actions
// -----------------------------------------------------------------------------

export const ConditionSchema: z.ZodTypeAny = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal('resource_gte'),
      resource: ResourceSchema,
      value: z.number().nonnegative(),
    }),
    z.object({
      type: z.literal('building_count_gte'),
      buildingId: z.string().min(1),
      value: z.number().int().nonnegative(),
    }),
    z.object({
      type: z.literal('unit_count_gte'),
      unitId: z.string().min(1),
      value: z.number().int().nonnegative(),
    }),
    z.object({
      type: z.literal('queue_idle'),
      producerRef: z.string().min(1),
    }),
    z.object({
      type: z.literal('age_is'),
      age: AgeSchema,
    }),
    z.object({
      type: z.literal('and'),
      items: z.array(ConditionSchema).min(1),
    }),
    z.object({
      type: z.literal('or'),
      items: z.array(ConditionSchema).min(1),
    }),
    z.object({
      type: z.literal('not'),
      item: ConditionSchema,
    }),
  ])
);
export type Condition = z.infer<typeof ConditionSchema>;

export const TriggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('on_start') }),
  z.object({ type: z.literal('at_time'), timeSec: z.number().nonnegative() }),
  z.object({ type: z.literal('at_population'), population: z.number().int().positive() }),
  z.object({ type: z.literal('at_villager_count'), villagers: z.number().int().nonnegative() }),
  z.object({ type: z.literal('on_age_reached'), age: AgeSchema }),
  z.object({ type: z.literal('on_entity_complete'), entityRef: z.string().min(1) }),
  z.object({ type: z.literal('when_affordable'), cost: PartialResourceStockSchema }),
  z.object({ type: z.literal('when_condition'), condition: ConditionSchema }),
]);
export type Trigger = z.infer<typeof TriggerSchema>;

export const ActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('assign_existing_villagers'),
    count: z.number().int().positive(),
    to: TaskSchema,
    from: TaskSchema.optional(),
  }),
  z.object({
    type: z.literal('assign_next_villagers'),
    count: z.number().int().positive(),
    to: TaskSchema,
  }),
  z.object({
    type: z.literal('build'),
    buildingId: z.string().min(1),
    builders: z.number().int().positive(),
    priority: PrioritySchema.default('high'),
  }),
  z.object({
    type: z.literal('research'),
    techId: z.string().min(1),
    atBuildingId: z.string().min(1),
    priority: PrioritySchema.default('high'),
  }),
  z.object({
    type: z.literal('train_once'),
    unitId: z.string().min(1),
    atBuildingId: z.string().min(1),
    priority: PrioritySchema.default('normal'),
  }),
  z.object({
    type: z.literal('advance_age'),
    age: AgeSchema,
    priority: PrioritySchema.default('high'),
  }),
  z.object({
    type: z.literal('reserve_resources'),
    purpose: z.string().min(1),
    amount: PartialResourceStockSchema,
  }),
  z.object({ type: z.literal('note'), text: z.string().min(1) }),
]);
export type Action = z.infer<typeof ActionSchema>;

// -----------------------------------------------------------------------------
// Authoring model
// -----------------------------------------------------------------------------

export const ScriptEventSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  lane: LaneSchema,
  enabled: z.boolean().default(true),
  trigger: TriggerSchema,
  actions: z.array(ActionSchema).min(1),
  notes: z.string().optional(),
});
export type ScriptEvent = z.infer<typeof ScriptEventSchema>;

const KeepQueueBusyPolicySchema = z.object({
  id: z.string().min(1),
  kind: z.literal('keep_queue_busy'),
  enabled: z.boolean().default(true),
  priority: PrioritySchema.default('normal'),
  producerType: ProducerTypeSchema,
  productId: z.string().min(1),
  maxBuildings: z.number().int().positive().optional(),
});

const AutoHousePolicySchema = z.object({
  id: z.string().min(1),
  kind: z.literal('auto_house'),
  enabled: z.boolean().default(true),
  priority: PrioritySchema.default('high'),
  popBuffer: z.number().int().min(1).max(20),
  builders: z.number().int().positive().default(1),
});

const ClickAgeAsapPolicySchema = z.object({
  id: z.string().min(1),
  kind: z.literal('click_age_asap'),
  enabled: z.boolean().default(true),
  priority: PrioritySchema.default('high'),
  targetAge: AgeSchema,
  reserveMode: z.enum(['observe', 'dynamic', 'hard']).default('dynamic'),
  canPause: z.array(z.enum(['military', 'economy', 'town_center'])).default([]),
});

const MaintainAllocationPolicySchema = z.object({
  id: z.string().min(1),
  kind: z.literal('maintain_allocations'),
  enabled: z.boolean().default(true),
  priority: PrioritySchema.default('normal'),
  targets: TaskCountMapSchema,
  applyTo: z.enum(['new_villagers', 'all_villagers']).default('new_villagers'),
});

export const PolicySchema = z.discriminatedUnion('kind', [
  KeepQueueBusyPolicySchema,
  AutoHousePolicySchema,
  ClickAgeAsapPolicySchema,
  MaintainAllocationPolicySchema,
]);
export type Policy = z.infer<typeof PolicySchema>;

export const QuestionSchema = z.discriminatedUnion('kind', [
  z.object({ id: z.string().min(1), kind: z.literal('age_affordable_at'), age: AgeSchema }),
  z.object({ id: z.string().min(1), kind: z.literal('age_clicked_at'), age: AgeSchema }),
  z.object({ id: z.string().min(1), kind: z.literal('age_reached_at'), age: AgeSchema }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('unit_count_at_milestone'),
    unitId: z.string().min(1),
    milestone: z.enum(['age_click', 'age_reach']),
    age: AgeSchema,
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('resource_at_time'),
    resource: ResourceSchema,
    timeSec: z.number().nonnegative(),
  }),
  z.object({ id: z.string().min(1), kind: z.literal('bottleneck_summary') }),
]);
export type Question = z.infer<typeof QuestionSchema>;

export const ScenarioDraftSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  prompt: z.string().optional(),
  civId: z.string().min(1).default('generic'),
  rulesetVersion: z.string().min(1).default('current'),
  baseOpeningId: z.string().min(1).optional(),
  assumptions: AssumptionsSchema,
  userEvents: z.array(ScriptEventSchema).default([]),
  policies: z.array(PolicySchema).default([]),
  questions: z.array(QuestionSchema).default([]),
});
export type ScenarioDraft = z.infer<typeof ScenarioDraftSchema>;

// -----------------------------------------------------------------------------
// Resolved scenario
// -----------------------------------------------------------------------------

export const ResolutionIssueSchema = z.object({
  id: z.string().min(1),
  severity: SeveritySchema,
  message: z.string().min(1),
  suggestedPatch: z.string().optional(),
});
export type ResolutionIssue = z.infer<typeof ResolutionIssueSchema>;

export const ResolvedEventSchema = ScriptEventSchema.extend({
  source: z.enum(['user', 'template', 'inferred']),
});
export type ResolvedEvent = z.infer<typeof ResolvedEventSchema>;

export const ResolvedScenarioSchema = ScenarioDraftSchema.extend({
  resolvedEvents: z.array(ResolvedEventSchema),
  issues: z.array(ResolutionIssueSchema).default([]),
});
export type ResolvedScenario = z.infer<typeof ResolvedScenarioSchema>;

// -----------------------------------------------------------------------------
// Ruleset data
// -----------------------------------------------------------------------------

export const RequirementSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('age'), age: AgeSchema }),
  z.object({ kind: z.literal('building'), buildingId: z.string().min(1), count: z.number().int().positive().default(1) }),
  z.object({ kind: z.literal('tech'), techId: z.string().min(1) }),
]);
export type Requirement = z.infer<typeof RequirementSchema>;

export const UnitDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  age: AgeSchema,
  cost: PartialResourceStockSchema,
  trainedAt: z.array(z.string().min(1)).min(1),
  buildTimeSec: z.number().positive(),
  populationCost: z.number().nonnegative().default(1),
  tags: z.array(z.string()).default([]),
  requirements: z.array(RequirementSchema).default([]),
});
export type UnitDefinition = z.infer<typeof UnitDefinitionSchema>;

export const BuildingDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  age: AgeSchema,
  cost: PartialResourceStockSchema,
  buildTimeSec: z.number().nonnegative(),
  supportsTraining: z.array(z.string().min(1)).default([]),
  supportsResearch: z.array(z.string().min(1)).default([]),
  populationProvided: z.number().int().nonnegative().default(0),
  requirements: z.array(RequirementSchema).default([]),
});
export type BuildingDefinition = z.infer<typeof BuildingDefinitionSchema>;

export const TechEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('gather_rate_multiplier'), task: TaskSchema, value: z.number().positive() }),
  z.object({
    kind: z.literal('cost_multiplier'),
    targetType: z.enum(['unit', 'building', 'tech']),
    targetId: z.string().min(1).optional(),
    resource: ResourceSchema,
    value: z.number().positive(),
  }),
  z.object({
    kind: z.literal('build_time_multiplier'),
    targetType: z.enum(['unit', 'building', 'tech']),
    targetId: z.string().min(1).optional(),
    value: z.number().positive(),
  }),
  z.object({ kind: z.literal('free_tech'), techId: z.string().min(1) }),
]);
export type TechEffect = z.infer<typeof TechEffectSchema>;

export const TechDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  age: AgeSchema,
  researchedAt: z.string().min(1),
  cost: PartialResourceStockSchema,
  researchTimeSec: z.number().positive(),
  requirements: z.array(RequirementSchema).default([]),
  effects: z.array(TechEffectSchema).default([]),
});
export type TechDefinition = z.infer<typeof TechDefinitionSchema>;

export const GatherRatesSchema = z.object({
  sheep: z.number().nonnegative(),
  boar: z.number().nonnegative(),
  berries: z.number().nonnegative(),
  deer: z.number().nonnegative(),
  farms: z.number().nonnegative(),
  wood: z.number().nonnegative(),
  gold: z.number().nonnegative(),
  stone: z.number().nonnegative(),
  build: z.number().nonnegative().default(0),
  walk: z.number().nonnegative().default(0),
  idle: z.number().nonnegative().default(0),
});
export type GatherRates = z.infer<typeof GatherRatesSchema>;

export const StartingFoodSourcesSchema = z.object({
  sheep: z.number().nonnegative(),
  boar: z.number().nonnegative(),
  berries: z.number().nonnegative(),
  deerPerPushed: z.number().nonnegative(),
  farmFood: z.number().positive(),
  farmWoodCost: z.number().positive(),
  farmBuildTimeSec: z.number().positive(),
});
export type StartingFoodSources = z.infer<typeof StartingFoodSourcesSchema>;

export const CivModifierSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('gather_rate_multiplier'), task: TaskSchema, value: z.number().positive() }),
  z.object({
    kind: z.literal('cost_multiplier'),
    targetType: z.enum(['unit', 'building', 'tech']),
    targetId: z.string().min(1).optional(),
    resource: ResourceSchema,
    value: z.number().positive(),
  }),
  z.object({ kind: z.literal('free_tech'), techId: z.string().min(1) }),
]);
export type CivModifier = z.infer<typeof CivModifierSchema>;

export const CivilizationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  modifiers: z.array(CivModifierSchema).default([]),
  disabledUnits: z.array(z.string().min(1)).default([]),
  disabledBuildings: z.array(z.string().min(1)).default([]),
  disabledTechs: z.array(z.string().min(1)).default([]),
});
export type Civilization = z.infer<typeof CivilizationSchema>;

export const OpeningTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  assumptionsPatch: AssumptionsSchema.partial().default({}),
  events: z.array(ScriptEventSchema).default([]),
  policies: z.array(PolicySchema).default([]),
});
export type OpeningTemplate = z.infer<typeof OpeningTemplateSchema>;

export const RulesetSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  name: z.string().min(1),
  startingResources: ResourceStockSchema,
  startingVillagers: z.number().int().positive(),
  startingPopulation: z.number().int().positive(),
  startingPopCap: z.number().int().positive(),
  startingFoodSources: StartingFoodSourcesSchema,
  gatherRates: GatherRatesSchema,
  units: z.record(z.string(), UnitDefinitionSchema),
  buildings: z.record(z.string(), BuildingDefinitionSchema),
  techs: z.record(z.string(), TechDefinitionSchema),
  civilizations: z.record(z.string(), CivilizationSchema),
  openings: z.record(z.string(), OpeningTemplateSchema).default({}),
});
export type Ruleset = z.infer<typeof RulesetSchema>;

// -----------------------------------------------------------------------------
// Simulation output
// -----------------------------------------------------------------------------

export const AnswerSchema = z.object({
  questionId: z.string().min(1),
  value: z.union([z.number(), z.string(), z.null()]),
  displayText: z.string().min(1),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const WarningSchema = z.object({
  code: z.string().min(1),
  severity: SeveritySchema,
  message: z.string().min(1),
  startSec: z.number().nonnegative().optional(),
  endSec: z.number().nonnegative().optional(),
});
export type Warning = z.infer<typeof WarningSchema>;

export const LaneSegmentSchema = z.object({
  laneId: z.string().min(1),
  label: z.string().min(1),
  startSec: z.number().nonnegative(),
  endSec: z.number().nonnegative(),
  state: ProducerStateSchema,
  count: z.number().int().positive().optional(),
  sourceEventId: z.string().optional(),
});
export type LaneSegment = z.infer<typeof LaneSegmentSchema>;

export const AllocationSegmentSchema = z.object({
  startSec: z.number().nonnegative(),
  endSec: z.number().nonnegative(),
  counts: TaskCountMapSchema,
});
export type AllocationSegment = z.infer<typeof AllocationSegmentSchema>;

export const KeyframeSchema = z.object({
  timeSec: z.number().nonnegative(),
  stockpile: ResourceStockSchema,
  reserved: PartialResourceStockSchema.default({}),
  committed: PartialResourceStockSchema.default({}),
  resourcePools: ResourcePoolStateSchema.default({}),
  age: AgeSchema,
  population: z.number().int().nonnegative(),
  popCap: z.number().int().positive(),
  units: CountMapSchema.default({}),
  buildings: CountMapSchema.default({}),
  tasks: TaskCountMapSchema.default({}),
});
export type Keyframe = z.infer<typeof KeyframeSchema>;

export const SimulationRunSchema = z.object({
  scenarioId: z.string().min(1),
  startedAt: z.string().min(1),
  answers: z.array(AnswerSchema).default([]),
  warnings: z.array(WarningSchema).default([]),
  keyframes: z.array(KeyframeSchema).default([]),
  laneSegments: z.array(LaneSegmentSchema).default([]),
  allocationSegments: z.array(AllocationSegmentSchema).default([]),
});
export type SimulationRun = z.infer<typeof SimulationRunSchema>;

// -----------------------------------------------------------------------------
// Useful starter defaults
// -----------------------------------------------------------------------------

export const DEFAULT_QUESTIONS: Question[] = [
  { id: 'q_castle_affordable', kind: 'age_affordable_at', age: 'castle' },
  { id: 'q_castle_clicked', kind: 'age_clicked_at', age: 'castle' },
  { id: 'q_castle_reached', kind: 'age_reached_at', age: 'castle' },
  { id: 'q_archers_click', kind: 'unit_count_at_milestone', unitId: 'archer', milestone: 'age_click', age: 'castle' },
  { id: 'q_archers_reach', kind: 'unit_count_at_milestone', unitId: 'archer', milestone: 'age_reach', age: 'castle' },
  { id: 'q_bottleneck', kind: 'bottleneck_summary' },
];

export function createDefaultScenarioDraft(overrides: Partial<ScenarioDraft> = {}): ScenarioDraft {
  return ScenarioDraftSchema.parse({
    id: 'scn_default',
    name: 'New Scenario',
    civId: 'generic',
    rulesetVersion: 'current',
    assumptions: AssumptionsSchema.parse({}),
    userEvents: [],
    policies: [],
    questions: DEFAULT_QUESTIONS,
    ...overrides,
  });
}
