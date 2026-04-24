'use client';

import { useMemo, useState } from 'react';
import type {
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
type QueueUiType =
  | 'villager'
  | 'military'
  | 'eco_technology'
  | 'military_technology'
  | 'feudal_age'
  | 'castle_age'
  | 'imperial_age';

const queueTypeOptions: Array<{ value: QueueUiType; label: string }> = [
  { value: 'villager', label: 'Villager' },
  { value: 'military', label: 'Military' },
  { value: 'eco_technology', label: 'Eco technology' },
  { value: 'military_technology', label: 'Military technology' },
  { value: 'feudal_age', label: 'Feudal Age' },
  { value: 'castle_age', label: 'Castle Age' },
  { value: 'imperial_age', label: 'Imperial Age' },
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
  { value: 'on_start', label: 'On start/asap' },
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

function rowId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function ensureBuildOrder(draft: ScenarioDraft, ruleset: Ruleset) {
  const fallback = createDefaultBuildOrder(ruleset.startingVillagers);
  if (!draft.buildOrder) {
    return fallback;
  }

  return {
    queue: draft.buildOrder.queue.length > 0 ? draft.buildOrder.queue : fallback.queue,
    buildingQueue:
      draft.buildOrder.buildingQueue.length > 0 ? draft.buildOrder.buildingQueue : fallback.buildingQueue,
  };
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
    return Object.values(ruleset.units).find((unit) => unit.id !== 'villager')?.id ?? 'archer';
  }

  if (category === 'eco_technology') {
    return (
      Object.values(ruleset.techs).find(
        (tech) =>
          tech.id !== 'feudal_age' &&
          tech.id !== 'castle_age' &&
          tech.id !== 'imperial_age' &&
          ecoTechIds.has(tech.id),
      )?.id ?? 'loom'
    );
  }

  if (category === 'military_technology') {
    return (
      Object.values(ruleset.techs).find(
        (tech) =>
          tech.id !== 'feudal_age' &&
          tech.id !== 'castle_age' &&
          tech.id !== 'imperial_age' &&
          !ecoTechIds.has(tech.id),
      )?.id ?? 'fletching'
    );
  }

  return 'feudal_age';
}

function itemOptionsForCategory(category: BuildOrderQueueItemCategory, ruleset: Ruleset) {
  if (category === 'military') {
    return Object.values(ruleset.units)
      .filter((unit) => unit.id !== 'villager')
      .map((unit) => ({ value: unit.id, label: unit.name }));
  }

  if (category === 'eco_technology') {
    return Object.values(ruleset.techs)
      .filter(
        (tech) =>
          tech.id !== 'feudal_age' &&
          tech.id !== 'castle_age' &&
          tech.id !== 'imperial_age' &&
          ecoTechIds.has(tech.id),
      )
      .map((tech) => ({ value: tech.id, label: tech.name }));
  }

  if (category === 'military_technology') {
    return Object.values(ruleset.techs)
      .filter(
        (tech) =>
          tech.id !== 'feudal_age' &&
          tech.id !== 'castle_age' &&
          tech.id !== 'imperial_age' &&
          !ecoTechIds.has(tech.id),
      )
      .map((tech) => ({ value: tech.id, label: tech.name }));
  }

  return [];
}

function withQueueRowUpdated(buildOrder: BuildOrder, rowIndex: number, nextRow: BuildOrderQueueItem) {
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

function uiTypeForRow(row: BuildOrderQueueItem): QueueUiType {
  if (row.category === 'age_up') {
    return row.itemId as QueueUiType;
  }
  return row.category as QueueUiType;
}

function buildRowFromUiType(
  uiType: QueueUiType,
  ruleset: Ruleset,
  villagerNumber: number,
  existing?: BuildOrderQueueItem,
): BuildOrderQueueItem {
  if (uiType === 'villager') {
    return {
      id: existing?.id ?? rowId('queue_villager'),
      category: 'villager',
      itemId: 'villager',
      orderSteps: defaultVillagerPlanSteps(villagerNumber),
    };
  }

  if (uiType === 'feudal_age' || uiType === 'castle_age' || uiType === 'imperial_age') {
    return {
      id: existing?.id ?? rowId('queue_age_up'),
      category: 'age_up',
      itemId: uiType,
      orderSteps: [],
    };
  }

  return {
    id: existing?.id ?? rowId(`queue_${uiType}`),
    category: uiType as BuildOrderQueueItemCategory,
    itemId: defaultItemIdForCategory(uiType as BuildOrderQueueItemCategory, ruleset),
    orderSteps: [],
  };
}

function selectedSpecificLabel(row: BuildOrderQueueItem, ruleset: Ruleset) {
  if (row.category === 'villager') {
    return 'Villager';
  }
  if (row.category === 'age_up') {
    if (row.itemId === 'feudal_age') return 'Feudal Age';
    if (row.itemId === 'castle_age') return 'Castle Age';
    if (row.itemId === 'imperial_age') return 'Imperial Age';
  }

  return (
    itemOptionsForCategory(row.category, ruleset).find((option) => option.value === row.itemId)?.label ?? row.itemId
  );
}

function compactQueueLabel(row: BuildOrderQueueItem, rowIndex: number, queue: BuildOrder['queue'], ruleset: Ruleset) {
  if (row.category === 'villager') {
    return `Villager ${villagerNumberAtRow(queue, rowIndex)}`;
  }
  if (row.category === 'age_up') {
    return selectedSpecificLabel(row, ruleset);
  }
  const base = queueTypeOptions.find((option) => option.value === uiTypeForRow(row))?.label ?? row.category;
  return `${base}: ${selectedSpecificLabel(row, ruleset)}`;
}

function moveItem<T>(items: T[], fromIndex: number, direction: -1 | 1) {
  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function BuildOrderPanel({
  draft,
  ruleset,
  onDraftChange,
  collapsed = false,
  onToggleCollapse,
}: {
  draft: ScenarioDraft;
  ruleset: Ruleset;
  onDraftChange: (draft: ScenarioDraft) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const buildOrder = ensureBuildOrder(draft, ruleset);
  const [specificMenuRowId, setSpecificMenuRowId] = useState<string | null>(null);

  const editableBuildings = useMemo(
    () =>
      Object.values(ruleset.buildings)
        .filter((building) => building.id !== 'town_center')
        .map((building) => ({ value: building.id, label: building.name })),
    [ruleset],
  );

  const withBuildOrder = (nextBuildOrder: BuildOrder) => {
    onDraftChange({
      ...draft,
      buildOrder: nextBuildOrder,
    });
  };

  const insertQueueRowAt = (rowIndex: number, nextRow: BuildOrderQueueItem) => {
    const nextQueue = [...buildOrder.queue];
    nextQueue.splice(rowIndex, 0, nextRow);
    withBuildOrder({ ...buildOrder, queue: nextQueue });
  };

  const villagerSelectorMax = Math.max(40, countVillagerRows(buildOrder.queue) + 10);
  const visibleQueueRows = Math.max(30, buildOrder.queue.length);

  if (collapsed) {
    return (
      <section className="panel p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Build order editor</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">Collapsed queue view</h2>
          </div>
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
            >
              Expand
            </button>
          ) : null}
        </div>

        <div>
          <table className="w-full border-collapse text-sm table-fixed">
            <thead>
              <tr className="text-slate-400">
                <th className="w-12 border border-slate-800/70 px-2 py-2 text-left font-medium">#</th>
                <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {buildOrder.queue.map((row, rowIndex) => (
                <tr key={row.id}>
                  <td className="border border-slate-800/70 px-2 py-2 font-medium text-slate-200">{rowIndex + 1}</td>
                  <td className="border border-slate-800/70 px-2 py-2 text-slate-200 truncate">
                    {compactQueueLabel(row, rowIndex, buildOrder.queue, ruleset)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section className="panel p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Build order editor</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-50">Single click-order queue</h2>
          <p className="mt-2 text-sm text-slate-300">
            Set the order you would click villagers, military, techs, and age-ups in a real game. Buildings stay in their own table because they also need builders and trigger rules.
          </p>
        </div>
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
          >
            Collapse
          </button>
        ) : null}
      </div>

      <div className="space-y-5">
        <section className="border border-slate-700/70 bg-slate-950/45 p-3">
          {sectionHeader('Scenario + assumptions', 'Just the essentials for now.')}
          <div className="grid gap-3 md:grid-cols-4">
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Scenario name</span>
              <input
                className="w-full border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                value={draft.name}
                onChange={(event) => onDraftChange({ ...draft, name: event.target.value, buildOrder })}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Civilization</span>
              <select
                className="w-full border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm"
                value={draft.civId}
                onChange={(event) => onDraftChange({ ...draft, civId: event.target.value, buildOrder })}
              >
                {Object.values(ruleset.civilizations).map((civilization) => (
                  <option key={civilization.id} value={civilization.id}>
                    {civilization.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Worker efficiency (%)</span>
              <input
                type="number"
                min={1}
                max={200}
                className="w-full border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm"
                value={draft.assumptions.workerEfficiency}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    buildOrder,
                    assumptions: {
                      ...draft.assumptions,
                      workerEfficiency: Math.min(200, Math.max(1, Number(event.target.value) || 100)),
                    },
                  })
                }
              />
            </label>

            <label className="block md:col-span-1">
              <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Simulation length (min)</span>
              <input
                type="number"
                min={1}
                max={240}
                className="w-full border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-sm"
                value={draft.assumptions.simulationDurationMin}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    buildOrder,
                    assumptions: {
                      ...draft.assumptions,
                      simulationDurationMin: Math.min(240, Math.max(1, Number(event.target.value) || 28)),
                    },
                  })
                }
              />
            </label>
          </div>
        </section>

        <section className="border border-slate-700/70 bg-slate-950/45 p-3">
          {sectionHeader(
            'Main queue',
            'Each row becomes available once the prior queue row has been clicked. Empty rows let you extend the build quickly.',
          )}
          <div>
            <table className="w-full border-collapse text-sm table-fixed">
              <thead>
                <tr className="text-slate-400">
                  <th className="w-10 border border-slate-800/70 px-2 py-2 text-left font-medium">#</th>
                  <th className="w-40 border border-slate-800/70 px-2 py-2 text-left font-medium">Type</th>
                  {(['First', 'Then', 'Then', 'Then', 'Then'] as const).map((label, index) => (
                    <th key={`${label}-${index}`} className="w-16 border border-slate-800/70 px-1 py-2 text-left font-medium">
                      {label}
                    </th>
                  ))}
                  <th className="w-20 border border-slate-800/70 px-2 py-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: visibleQueueRows }, (_, rowIndex) => {
                  const row = buildOrder.queue[rowIndex];
                  const isEmpty = !row;
                  const villagerNumber = villagerNumberAtRow(buildOrder.queue, rowIndex);
                  const uiType = row ? uiTypeForRow(row) : '';
                  const needsSpecific = !!row && row.category !== 'villager' && row.category !== 'age_up';
                  const specificOptions = row ? itemOptionsForCategory(row.category, ruleset) : [];

                  return (
                    <tr key={row?.id ?? `empty-row-${rowIndex}`}>
                      <td className="border border-slate-800/70 px-2 py-1 text-slate-200">{rowIndex + 1}</td>
                      <td className="border border-slate-800/70 p-1 align-top">
                        <div
                          className="relative"
                          onMouseEnter={() => {
                            if (needsSpecific && row) {
                              setSpecificMenuRowId(row.id);
                            }
                          }}
                          onMouseLeave={() => {
                            if (row && specificMenuRowId === row.id) {
                              setSpecificMenuRowId(null);
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <select
                              className="min-w-0 flex-1 border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-xs"
                              value={uiType}
                              onChange={(event) => {
                                const nextUiType = event.target.value as QueueUiType;
                                if (!nextUiType) return;
                                const nextVillagerNumber =
                                  countVillagerRows(buildOrder.queue.slice(0, rowIndex + 1)) +
                                  (row?.category === 'villager' ? 0 : 1);
                                const nextRow = buildRowFromUiType(nextUiType, ruleset, nextVillagerNumber, row);

                                if (isEmpty) {
                                  insertQueueRowAt(rowIndex, nextRow);
                                  return;
                                }

                                withBuildOrder(withQueueRowUpdated(buildOrder, rowIndex, nextRow));
                              }}
                            >
                              <option value="">—</option>
                              {queueTypeOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>

                            {row?.category === 'villager' ? (
                              <span className="shrink-0 text-[10px] text-slate-500">V{villagerNumber}</span>
                            ) : null}

                            {needsSpecific && row ? (
                              <button
                                type="button"
                                className="w-20 shrink-0 truncate border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200"
                                onClick={() => setSpecificMenuRowId((current) => (current === row.id ? null : row.id))}
                              >
                                {selectedSpecificLabel(row, ruleset)}
                              </button>
                            ) : null}
                          </div>

                          {needsSpecific && row && specificMenuRowId === row.id ? (
                            <div className="absolute left-full top-0 z-30 ml-1 w-40 border border-slate-700/80 bg-slate-950/95 shadow-2xl">
                              {specificOptions.map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  className={`block w-full border-b border-slate-800/80 px-2 py-1 text-left text-xs ${
                                    row.itemId === option.value ? 'bg-violet-500/20 text-violet-100' : 'text-slate-200 hover:bg-slate-800/70'
                                  }`}
                                  onClick={() => {
                                    withBuildOrder(
                                      withQueueRowUpdated(buildOrder, rowIndex, {
                                        ...row,
                                        itemId: option.value,
                                      }),
                                    );
                                    setSpecificMenuRowId(null);
                                  }}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      {[0, 1, 2, 3, 4].map((slot) => (
                        <td key={`${row?.id ?? `empty-${rowIndex}`}-${slot}`} className="border border-slate-800/70 p-1 align-top">
                          {row?.category === 'villager' ? (
                            <div className="space-y-1">
                              <select
                                className="w-full border border-slate-700/70 bg-slate-900/60 px-1 py-1 text-xs"
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
                                <input
                                  type="number"
                                  min={0}
                                  className="w-full border border-slate-700/70 bg-slate-900/60 px-1 py-1 text-xs"
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
                              ) : (
                                <div className="h-6" />
                              )}
                            </div>
                          ) : (
                            <div className="h-12 bg-slate-950/10" />
                          )}
                        </td>
                      ))}
                      <td className="border border-slate-800/70 p-1 align-top">
                        {row ? (
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              className="border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200"
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
                              className="border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200"
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
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border border-slate-700/70 bg-slate-950/45 p-3">
          {sectionHeader(
            'Buildings',
            'Separate building triggers, one or two builders, explicit walking tiles, and manual ordering.',
          )}
          <div>
            <table className="w-full border-collapse text-sm">
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
                        className="w-full min-w-28 border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-sm"
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
                        className="w-full min-w-40 border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-sm"
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
                        className="w-20 border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-sm"
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
                        className="w-20 border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-sm"
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
                        className="w-20 border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-sm"
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
                        className="w-20 border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-sm"
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
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          className="border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200"
                          onClick={() =>
                            withBuildOrder({
                              ...buildOrder,
                              buildingQueue: moveItem(buildOrder.buildingQueue, rowIndex, -1),
                            })
                          }
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200"
                          onClick={() =>
                            withBuildOrder({
                              ...buildOrder,
                              buildingQueue: moveItem(buildOrder.buildingQueue, rowIndex, 1),
                            })
                          }
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200"
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
                          className="border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200"
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
