'use client';

import type {
  Age,
  BuildOrder,
  BuildOrderPlanStep,
  BuildOrderQueueItem,
  BuildOrderQueueItemCategory,
  BuildQueueTrigger,
  Ruleset,
  ScenarioDraft,
} from '@/lib/sim/schema';
import {
  createDefaultBuildOrder,
  createDefaultQueueVillagerRow,
  defaultVillagerPlanSteps,
} from '@/lib/sim/schema';

type StepSlot = 0 | 1 | 2 | 3 | 4;

const ageRows: Age[] = ['dark', 'feudal', 'castle', 'imperial'];
const priorityColumns = [
  { key: 'town_center', label: 'TC' },
  { key: 'archery_range', label: 'Range' },
  { key: 'stable', label: 'Stable' },
  { key: 'barracks', label: 'Barracks' },
  { key: 'save', label: 'Save' },
] as const;

const queueCategoryOptions: Array<{ value: BuildOrderQueueItemCategory; label: string }> = [
  { value: 'villager', label: 'Villager' },
  { value: 'military', label: 'Military' },
  { value: 'eco_technology', label: 'Eco technology' },
  { value: 'military_technology', label: 'Military technology' },
  { value: 'age_up', label: 'Age up' },
];

const planStepOptions = [
  { value: 'task:sheep', label: 'Sheep' },
  { value: 'task:hunt', label: 'Hunt' },
  { value: 'task:berries', label: 'Berries' },
  { value: 'task:deer', label: 'Deer' },
  { value: 'task:farms', label: 'Farm' },
  { value: 'task:wood', label: 'Wood' },
  { value: 'task:gold', label: 'Gold' },
  { value: 'task:stone', label: 'Stone' },
  { value: 'walking', label: 'Walking' },
  { value: 'task:idle', label: 'Idle' },
] as const;

const buildingTriggerOptions: Array<{ value: BuildQueueTrigger; label: string }> = [
  { value: 'on_start', label: 'On start' },
  { value: 'prior_buildings_complete', label: 'Prior buildings complete' },
  { value: 'feudal_clicked', label: 'Feudal age clicked' },
  { value: 'feudal_reached', label: 'Feudal age reached' },
  { value: 'castle_clicked', label: 'Castle age clicked' },
  { value: 'castle_reached', label: 'Castle age reached' },
];

const ecoTechIds = new Set([
  'loom',
  'double_bit_axe',
  'horse_collar',
  'wheelbarrow',
  'hand_cart',
  'gold_mining',
  'gold_shaft_mining',
  'stone_mining',
  'stone_shaft_mining',
  'bow_saw',
  'two_man_saw',
  'heavy_plow',
  'crop_rotation',
]);

function ageLabel(age: Age) {
  return `${age[0]?.toUpperCase() ?? ''}${age.slice(1)}`;
}

function cyclePriority(value: number) {
  return value >= 5 ? 1 : value + 1;
}

function rowId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function ensureBuildOrder(draft: ScenarioDraft, ruleset: Ruleset) {
  return draft.buildOrder ?? createDefaultBuildOrder(ruleset.startingVillagers);
}

function sectionHeader(title: string, subtitle: string) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}

function countVillagerRows(queue: BuildOrder['queue']) {
  return queue.filter((row) => row.category === 'villager').length;
}

function villagerNumberAtRow(queue: BuildOrder['queue'], rowIndex: number) {
  let villagerNumber = 0;
  for (let index = 0; index <= rowIndex; index += 1) {
    if (queue[index]?.category === 'villager') {
      villagerNumber += 1;
    }
  }
  return Math.max(1, villagerNumber);
}

function stepAt(orderSteps: BuildOrderPlanStep[], index: StepSlot) {
  return orderSteps[index];
}

function planStepValue(step: BuildOrderPlanStep | undefined) {
  if (!step) {
    return '';
  }
  return step.kind === 'walking' ? 'walking' : `task:${step.task}`;
}

function updatePlanStepAtIndex(orderSteps: BuildOrderPlanStep[], index: StepSlot, nextValue: string) {
  const slots = [...orderSteps];
  if (!nextValue) {
    slots[index] = undefined as unknown as BuildOrderPlanStep;
    return slots.filter(Boolean) as BuildOrderPlanStep[];
  }

  if (nextValue === 'walking') {
    slots[index] = {
      kind: 'walking',
      tiles: stepAt(orderSteps, index)?.kind === 'walking' ? stepAt(orderSteps, index)?.tiles ?? 0 : 4,
    };
    return slots.filter(Boolean) as BuildOrderPlanStep[];
  }

  const task = nextValue.replace(/^task:/, '') as NonNullable<BuildOrderPlanStep['task']>;
  slots[index] = {
    kind: 'task',
    task,
    tiles: 0,
  };
  return slots.filter(Boolean) as BuildOrderPlanStep[];
}

function updateWalkingTiles(orderSteps: BuildOrderPlanStep[], index: StepSlot, tiles: number) {
  const slots = [...orderSteps];
  const current = stepAt(orderSteps, index);
  if (current?.kind !== 'walking') {
    return orderSteps;
  }
  slots[index] = { ...current, tiles: Math.max(0, tiles || 0) };
  return slots.filter(Boolean) as BuildOrderPlanStep[];
}

function defaultItemIdForCategory(category: BuildOrderQueueItemCategory, ruleset: Ruleset) {
  if (category === 'villager') {
    return 'villager';
  }

  if (category === 'military') {
    return (
      Object.values(ruleset.units).find((unit) => unit.id !== 'villager')?.id ??
      'archer'
    );
  }

  if (category === 'eco_technology') {
    return (
      Object.values(ruleset.techs).find((tech) => tech.id !== 'feudal_age' && tech.id !== 'castle_age' && tech.id !== 'imperial_age' && ecoTechIds.has(tech.id))?.id ??
      'loom'
    );
  }

  if (category === 'military_technology') {
    return (
      Object.values(ruleset.techs).find((tech) => tech.id !== 'feudal_age' && tech.id !== 'castle_age' && tech.id !== 'imperial_age' && !ecoTechIds.has(tech.id))?.id ??
      'fletching'
    );
  }

  return 'feudal_age';
}

function itemOptionsForCategory(category: BuildOrderQueueItemCategory, ruleset: Ruleset) {
  if (category === 'villager') {
    return [{ value: 'villager', label: 'Villager' }];
  }

  if (category === 'military') {
    return Object.values(ruleset.units)
      .filter((unit) => unit.id !== 'villager')
      .map((unit) => ({ value: unit.id, label: unit.name }));
  }

  if (category === 'eco_technology') {
    return Object.values(ruleset.techs)
      .filter((tech) => tech.id !== 'feudal_age' && tech.id !== 'castle_age' && tech.id !== 'imperial_age' && ecoTechIds.has(tech.id))
      .map((tech) => ({ value: tech.id, label: tech.name }));
  }

  if (category === 'military_technology') {
    return Object.values(ruleset.techs)
      .filter((tech) => tech.id !== 'feudal_age' && tech.id !== 'castle_age' && tech.id !== 'imperial_age' && !ecoTechIds.has(tech.id))
      .map((tech) => ({ value: tech.id, label: tech.name }));
  }

  return [
    { value: 'feudal_age', label: 'Feudal Age' },
    { value: 'castle_age', label: 'Castle Age' },
    { value: 'imperial_age', label: 'Imperial Age' },
  ];
}

function withQueueRowUpdated(
  buildOrder: BuildOrder,
  rowIndex: number,
  nextRow: BuildOrderQueueItem,
) {
  return {
    ...buildOrder,
    queue: buildOrder.queue.map((row, index) => (index === rowIndex ? nextRow : row)),
  };
}

function copyQueueRow(row: BuildOrderQueueItem): BuildOrderQueueItem {
  return {
    ...row,
    id: rowId(`queue_copy_${row.category}`),
    orderSteps: row.orderSteps.map((step) => ({ ...step })),
  };
}

export function BuildOrderPanel({
  draft,
  ruleset,
  onDraftChange,
}: {
  draft: ScenarioDraft;
  ruleset: Ruleset;
  onDraftChange: (draft: ScenarioDraft) => void;
}) {
  const buildOrder = ensureBuildOrder(draft, ruleset);

  const editableBuildings = Object.values(ruleset.buildings)
    .filter((building) => building.id !== 'town_center')
    .map((building) => ({ value: building.id, label: building.name }));

  const withBuildOrder = (nextBuildOrder: BuildOrder) => {
    onDraftChange({
      ...draft,
      buildOrder: nextBuildOrder,
    });
  };

  const villagerSelectorMax = Math.max(40, countVillagerRows(buildOrder.queue) + 10);

  return (
    <section className="panel p-4">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Build order editor</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-50">Single click-order queue</h2>
        <p className="mt-2 text-sm text-slate-300">
          Set the order you would click villagers, military, techs, and age-ups in a real game. Buildings stay in their own table because they also need builders and trigger rules.
        </p>
      </div>

      <div className="space-y-5">
        <section className="border border-slate-700/70 bg-slate-950/45 p-3">
          {sectionHeader('Scenario + assumptions', 'Core setup plus age-by-age spend priorities.')}
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Scenario name</span>
              <input
                className="w-full border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                value={draft.name}
                onChange={(event) => onDraftChange({ ...draft, name: event.target.value, buildOrder })}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Civilization</span>
                <select
                  className="w-full border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm"
                  value={draft.civId}
                  onChange={(event) => onDraftChange({ ...draft, civId: event.target.value, buildOrder })}
                >
                  <option value="generic">Generic</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Map preset</span>
                <input
                  className="w-full border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm"
                  value={draft.assumptions.mapPreset}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      buildOrder,
                      assumptions: { ...draft.assumptions, mapPreset: event.target.value },
                    })
                  }
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Execution</span>
                <select
                  className="w-full border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm"
                  value={draft.assumptions.executionProfile}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      buildOrder,
                      assumptions: {
                        ...draft.assumptions,
                        executionProfile: event.target.value as ScenarioDraft['assumptions']['executionProfile'],
                      },
                    })
                  }
                >
                  <option value="perfect">Perfect</option>
                  <option value="clean">Clean</option>
                  <option value="ladder">Ladder</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Deer pushed</span>
                <select
                  className="w-full border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm"
                  value={draft.assumptions.deerPushed}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      buildOrder,
                      assumptions: {
                        ...draft.assumptions,
                        deerPushed: Number(event.target.value) as 0 | 1 | 2 | 3,
                      },
                    })
                  }
                >
                  {[0, 1, 2, 3].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="overflow-x-auto border border-slate-800/70 bg-slate-950/45">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="text-slate-400">
                    <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Age</th>
                    {priorityColumns.map((column) => (
                      <th key={column.key} className="border border-slate-800/70 px-2 py-2 font-medium">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ageRows.map((age) => (
                    <tr key={age}>
                      <td className="border border-slate-800/70 px-2 py-2 font-medium text-slate-200">{ageLabel(age)}</td>
                      {priorityColumns.map((column) => {
                        const value = draft.assumptions.agePriorityGrid[age][column.key];
                        return (
                          <td key={`${age}-${column.key}`} className="border border-slate-800/70 p-1">
                            <button
                              type="button"
                              className="w-full border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm font-medium text-slate-100"
                              onClick={() =>
                                onDraftChange({
                                  ...draft,
                                  buildOrder,
                                  assumptions: {
                                    ...draft.assumptions,
                                    agePriorityGrid: {
                                      ...draft.assumptions.agePriorityGrid,
                                      [age]: {
                                        ...draft.assumptions.agePriorityGrid[age],
                                        [column.key]: cyclePriority(value),
                                      },
                                    },
                                  },
                                })
                              }
                            >
                              {value}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border border-slate-700/70 bg-slate-950/45 p-3">
          {sectionHeader(
            'Main queue',
            'One ordered list for villagers, military, eco tech, military tech, and age-ups. Each row can fire once the prior row has been clicked.',
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="text-slate-400">
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">#</th>
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Type</th>
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Specific</th>
                  {(['First', 'Then', 'Then', 'Then', 'Then'] as const).map((label, index) => (
                    <th key={`${label}-${index}`} className="border border-slate-800/70 px-2 py-2 text-left font-medium">
                      {label}
                    </th>
                  ))}
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {buildOrder.queue.map((row, rowIndex) => {
                  const villagerNumber = villagerNumberAtRow(buildOrder.queue, rowIndex);
                  const specificOptions = itemOptionsForCategory(row.category, ruleset);
                  return (
                    <tr key={row.id}>
                      <td className="border border-slate-800/70 px-2 py-2 font-medium text-slate-200">{rowIndex + 1}</td>
                      <td className="border border-slate-800/70 p-1">
                        <select
                          className="w-full min-w-32 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                          value={row.category}
                          onChange={(event) => {
                            const nextCategory = event.target.value as BuildOrderQueueItemCategory;
                            const nextQueue = buildOrder.queue.map((item, index) =>
                              index === rowIndex
                                ? {
                                    ...item,
                                    category: nextCategory,
                                    itemId: defaultItemIdForCategory(nextCategory, ruleset),
                                    orderSteps:
                                      nextCategory === 'villager'
                                        ? defaultVillagerPlanSteps(villagerNumberAtRow(
                                            buildOrder.queue.map((candidate, candidateIndex) =>
                                              candidateIndex === rowIndex ? { ...candidate, category: nextCategory } : candidate,
                                            ),
                                            rowIndex,
                                          ))
                                        : [],
                                  }
                                : item,
                            );
                            withBuildOrder({ ...buildOrder, queue: nextQueue });
                          }}
                        >
                          {queueCategoryOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-slate-800/70 p-1">
                        {row.category === 'villager' ? (
                          <div className="min-w-28 border border-slate-800/70 bg-slate-950/40 px-2 py-2 text-sm text-slate-200">
                            Villager {villagerNumber}
                          </div>
                        ) : (
                          <select
                            className="w-full min-w-36 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                            value={row.itemId}
                            onChange={(event) =>
                              withBuildOrder(
                                withQueueRowUpdated(buildOrder, rowIndex, {
                                  ...row,
                                  itemId: event.target.value,
                                }),
                              )
                            }
                          >
                            {specificOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      {[0, 1, 2, 3, 4].map((slot) => (
                        <td key={`${row.id}-${slot}`} className="border border-slate-800/70 p-1 align-top">
                          {row.category === 'villager' ? (
                            <div className="min-w-[7rem] space-y-1">
                              <select
                                className="w-full border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                                value={planStepValue(stepAt(row.orderSteps, slot as StepSlot))}
                                onChange={(event) =>
                                  withBuildOrder(
                                    withQueueRowUpdated(buildOrder, rowIndex, {
                                      ...row,
                                      orderSteps: updatePlanStepAtIndex(row.orderSteps, slot as StepSlot, event.target.value),
                                    }),
                                  )
                                }
                              >
                                <option value="">—</option>
                                {planStepOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              {stepAt(row.orderSteps, slot as StepSlot)?.kind === 'walking' ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Tiles</span>
                                  <input
                                    type="number"
                                    min={0}
                                    className="w-20 border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-sm"
                                    value={stepAt(row.orderSteps, slot as StepSlot)?.tiles ?? 0}
                                    onChange={(event) =>
                                      withBuildOrder(
                                        withQueueRowUpdated(buildOrder, rowIndex, {
                                          ...row,
                                          orderSteps: updateWalkingTiles(
                                            row.orderSteps,
                                            slot as StepSlot,
                                            Number(event.target.value) || 0,
                                          ),
                                        }),
                                      )
                                    }
                                  />
                                </div>
                              ) : (
                                <div className="h-7" />
                              )}
                            </div>
                          ) : (
                            <div className="h-[4.2rem] border border-slate-900/40 bg-slate-950/25" />
                          )}
                        </td>
                      ))}
                      <td className="border border-slate-800/70 p-1">
                        <div className="flex min-w-32 gap-2">
                          <button
                            type="button"
                            className="border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-xs text-slate-200"
                            onClick={() =>
                              withBuildOrder({
                                ...buildOrder,
                                queue: [...buildOrder.queue, copyQueueRow(row)],
                              })
                            }
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            className="border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-xs text-slate-200"
                            onClick={() =>
                              withBuildOrder({
                                ...buildOrder,
                                queue: buildOrder.queue.filter((item) => item.id !== row.id),
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
              onClick={() =>
                withBuildOrder({
                  ...buildOrder,
                  queue: [...buildOrder.queue, createDefaultQueueVillagerRow(countVillagerRows(buildOrder.queue) + 1)],
                })
              }
            >
              Add queue order
            </button>
          </div>
        </section>

        <section className="border border-slate-700/70 bg-slate-950/45 p-3">
          {sectionHeader(
            'Buildings',
            'Separate building triggers, one or two builders, and explicit walking tiles to and from the build.',
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="text-slate-400">
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Building</th>
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Trigger</th>
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Villager 1</th>
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Villager 2</th>
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Tiles to build</th>
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Tiles after build</th>
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {buildOrder.buildingQueue.map((row, rowIndex) => (
                  <tr key={row.id}>
                    <td className="border border-slate-800/70 p-1">
                      <select
                        className="w-full min-w-32 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                        value={row.buildingId}
                        onChange={(event) =>
                          withBuildOrder({
                            ...buildOrder,
                            buildingQueue: buildOrder.buildingQueue.map((item, index) =>
                              index === rowIndex ? { ...item, buildingId: event.target.value } : item,
                            ),
                          })
                        }
                      >
                        {editableBuildings.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-slate-800/70 p-1">
                      <select
                        className="w-full min-w-44 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                        value={row.trigger}
                        onChange={(event) =>
                          withBuildOrder({
                            ...buildOrder,
                            buildingQueue: buildOrder.buildingQueue.map((item, index) =>
                              index === rowIndex ? { ...item, trigger: event.target.value as BuildQueueTrigger } : item,
                            ),
                          })
                        }
                      >
                        {buildingTriggerOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-slate-800/70 p-1">
                      <input
                        type="number"
                        min={1}
                        max={villagerSelectorMax}
                        className="w-24 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                        value={row.builderVillagerId ?? ''}
                        onChange={(event) =>
                          withBuildOrder({
                            ...buildOrder,
                            buildingQueue: buildOrder.buildingQueue.map((item, index) =>
                              index === rowIndex
                                ? {
                                    ...item,
                                    builderVillagerId: event.target.value ? Math.max(1, Number(event.target.value)) : undefined,
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                    </td>
                    <td className="border border-slate-800/70 p-1">
                      <input
                        type="number"
                        min={1}
                        max={villagerSelectorMax}
                        className="w-24 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                        value={row.secondaryBuilderVillagerId ?? ''}
                        onChange={(event) =>
                          withBuildOrder({
                            ...buildOrder,
                            buildingQueue: buildOrder.buildingQueue.map((item, index) =>
                              index === rowIndex
                                ? {
                                    ...item,
                                    secondaryBuilderVillagerId: event.target.value ? Math.max(1, Number(event.target.value)) : undefined,
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                    </td>
                    <td className="border border-slate-800/70 p-1">
                      <input
                        type="number"
                        min={0}
                        className="w-24 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                        value={row.walkToStartTiles}
                        onChange={(event) =>
                          withBuildOrder({
                            ...buildOrder,
                            buildingQueue: buildOrder.buildingQueue.map((item, index) =>
                              index === rowIndex
                                ? {
                                    ...item,
                                    walkToStartTiles: Math.max(0, Number(event.target.value) || 0),
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                    </td>
                    <td className="border border-slate-800/70 p-1">
                      <input
                        type="number"
                        min={0}
                        className="w-24 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                        value={row.walkAfterCompleteTiles}
                        onChange={(event) =>
                          withBuildOrder({
                            ...buildOrder,
                            buildingQueue: buildOrder.buildingQueue.map((item, index) =>
                              index === rowIndex
                                ? {
                                    ...item,
                                    walkAfterCompleteTiles: Math.max(0, Number(event.target.value) || 0),
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                    </td>
                    <td className="border border-slate-800/70 p-1">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-xs text-slate-200"
                          onClick={() =>
                            withBuildOrder({
                              ...buildOrder,
                              buildingQueue: [
                                ...buildOrder.buildingQueue,
                                {
                                  ...row,
                                  id: rowId('building_copy'),
                                },
                              ],
                            })
                          }
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          className="border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-xs text-slate-200"
                          onClick={() =>
                            withBuildOrder({
                              ...buildOrder,
                              buildingQueue: buildOrder.buildingQueue.filter((item) => item.id !== row.id),
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
              onClick={() =>
                withBuildOrder({
                  ...buildOrder,
                  buildingQueue: [
                    ...buildOrder.buildingQueue,
                    {
                      id: rowId('building'),
                      buildingId: editableBuildings[0]?.value ?? 'house',
                      trigger: 'prior_buildings_complete',
                      builderVillagerId: 1,
                      secondaryBuilderVillagerId: undefined,
                      walkToStartTiles: 0,
                      walkAfterCompleteTiles: 0,
                    },
                  ],
                })
              }
            >
              Add building
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
