'use client';

import type {
  Age,
  BuildOrder,
  BuildOrderTaskStep,
  BuildQueueTrigger,
  Ruleset,
  ScenarioDraft,
} from '@/lib/sim/schema';
import { createDefaultBuildOrder } from '@/lib/sim/schema';

type StepSlot = 0 | 1 | 2 | 3 | 4;

const ageRows: Age[] = ['dark', 'feudal', 'castle', 'imperial'];
const priorityColumns = [
  { key: 'town_center', label: 'TC' },
  { key: 'archery_range', label: 'Range' },
  { key: 'stable', label: 'Stable' },
  { key: 'barracks', label: 'Barracks' },
  { key: 'save', label: 'Save' },
] as const;

const stepOptions: Array<{ value: BuildOrderTaskStep; label: string }> = [
  { value: 'sheep', label: 'Sheep' },
  { value: 'hunt', label: 'Hunt' },
  { value: 'berries', label: 'Berries' },
  { value: 'deer', label: 'Deer' },
  { value: 'farms', label: 'Farm' },
  { value: 'wood', label: 'Wood' },
  { value: 'gold', label: 'Gold' },
  { value: 'stone', label: 'Stone' },
  { value: 'idle', label: 'Idle' },
];

const tcItemOptions = [
  { value: 'villager', label: 'Villager' },
  { value: 'loom', label: 'Loom' },
  { value: 'feudal_age', label: 'Feudal Age' },
  { value: 'castle_age', label: 'Castle Age' },
  { value: 'imperial_age', label: 'Imperial Age' },
] as const;

const militaryProducerOptions = [
  { value: 'archery_range', label: 'Archery Range' },
  { value: 'barracks', label: 'Barracks' },
  { value: 'stable', label: 'Stable' },
] as const;

const buildingTriggerOptions: Array<{ value: BuildQueueTrigger; label: string }> = [
  { value: 'on_start', label: 'On start' },
  { value: 'prior_complete', label: 'Prior complete' },
  { value: 'feudal_clicked', label: 'Feudal clicked' },
  { value: 'feudal_reached', label: 'Feudal reached' },
  { value: 'castle_clicked', label: 'Castle clicked' },
  { value: 'castle_reached', label: 'Castle reached' },
];

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

function ensureBuildOrder(draft: ScenarioDraft) {
  return draft.buildOrder ?? createDefaultBuildOrder();
}

function normalizeSteps(steps: Array<BuildOrderTaskStep | ''>) {
  return steps.filter((step): step is BuildOrderTaskStep => Boolean(step));
}

function stepValue(steps: BuildOrderTaskStep[], index: StepSlot) {
  return steps[index] ?? '';
}

function sectionHeader(title: string, subtitle: string) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
    </div>
  );
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
  const buildOrder = ensureBuildOrder(draft);

  const editableBuildings = Object.values(ruleset.buildings)
    .filter((building) => building.id !== 'town_center')
    .map((building) => ({ value: building.id, label: building.name }));

  const editableUnits = Object.values(ruleset.units)
    .filter((unit) => unit.id !== 'villager')
    .map((unit) => ({ value: unit.id, label: unit.name }));

  const editableTechs = Object.values(ruleset.techs)
    .filter((tech) => tech.id !== 'feudal_age' && tech.id !== 'castle_age' && tech.id !== 'imperial_age' && tech.id !== 'loom')
    .map((tech) => ({ value: tech.id, label: tech.name, buildingId: tech.researchedAt }));

  const withBuildOrder = (nextBuildOrder: BuildOrder) => {
    onDraftChange({
      ...draft,
      buildOrder: nextBuildOrder,
    });
  };

  return (
    <section className="panel p-4">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Build order editor</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-50">Author your own queue</h2>
        <p className="mt-2 text-sm text-slate-300">
          Queue starting villagers, Town Center items, military units, techs, and buildings. The dashboard stays empty until you click Run simulation.
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

            <div className="overflow-auto border border-slate-800/70 bg-slate-950/45">
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
          {sectionHeader('Starting villagers', 'These are the villagers that exist at game start. Give each one an order chain.')}
          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="text-slate-400">
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Villager</th>
                  {[0, 1, 2, 3, 4].map((index) => (
                    <th key={index} className="border border-slate-800/70 px-2 py-2 font-medium">
                      {index === 0 ? 'First' : `Then ${index}`}
                    </th>
                  ))}
                  <th className="border border-slate-800/70 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {buildOrder.startingVillagers.map((row, rowIndex) => (
                  <tr key={row.id}>
                    <td className="border border-slate-800/70 p-1">
                      <input
                        type="number"
                        min={1}
                        className="w-20 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                        value={row.villagerId}
                        onChange={(event) =>
                          withBuildOrder({
                            ...buildOrder,
                            startingVillagers: buildOrder.startingVillagers.map((item, index) =>
                              index === rowIndex ? { ...item, villagerId: Number(event.target.value) || row.villagerId } : item,
                            ),
                          })
                        }
                      />
                    </td>
                    {[0, 1, 2, 3, 4].map((slot) => (
                      <td key={`${row.id}-${slot}`} className="border border-slate-800/70 p-1">
                        <select
                          className="w-full min-w-28 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                          value={stepValue(row.steps, slot as StepSlot)}
                          onChange={(event) => {
                            const nextSteps = [...row.steps] as Array<BuildOrderTaskStep | ''>;
                            nextSteps[slot] = event.target.value as BuildOrderTaskStep | '';
                            withBuildOrder({
                              ...buildOrder,
                              startingVillagers: buildOrder.startingVillagers.map((item, index) =>
                                index === rowIndex ? { ...item, steps: normalizeSteps(nextSteps) } : item,
                              ),
                            });
                          }}
                        >
                          <option value="">—</option>
                          {stepOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                    <td className="border border-slate-800/70 p-1 text-right">
                      <button
                        type="button"
                        className="border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-xs text-slate-200"
                        onClick={() =>
                          withBuildOrder({
                            ...buildOrder,
                            startingVillagers: buildOrder.startingVillagers.filter((item) => item.id !== row.id),
                          })
                        }
                      >
                        Remove
                      </button>
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
                  startingVillagers: [
                    ...buildOrder.startingVillagers,
                    { id: rowId('start_villager'), villagerId: buildOrder.startingVillagers.length + 1, steps: [] },
                  ],
                })
              }
            >
              Add villager row
            </button>
          </div>
        </section>

        <section className="border border-slate-700/70 bg-slate-950/45 p-3">
          {sectionHeader('Town Center queue', 'Queue villagers, Loom, and age-ups in exact order. Villager rows can include post-spawn orders.')}
          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="text-slate-400">
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Item</th>
                  <th className="border border-slate-800/70 px-2 py-2 font-medium">Qty</th>
                  {[0, 1, 2, 3, 4].map((index) => (
                    <th key={index} className="border border-slate-800/70 px-2 py-2 font-medium">
                      {index === 0 ? 'Orders' : `Then ${index}`}
                    </th>
                  ))}
                  <th className="border border-slate-800/70 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {buildOrder.townCenterQueue.map((row, rowIndex) => (
                  <tr key={row.id}>
                    <td className="border border-slate-800/70 p-1">
                      <select
                        className="w-full min-w-36 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                        value={row.itemType}
                        onChange={(event) =>
                          withBuildOrder({
                            ...buildOrder,
                            townCenterQueue: buildOrder.townCenterQueue.map((item, index) =>
                              index === rowIndex
                                ? {
                                    ...item,
                                    itemType: event.target.value as typeof row.itemType,
                                    quantity: event.target.value === 'villager' ? item.quantity : 1,
                                    villagerSteps: event.target.value === 'villager' ? item.villagerSteps : [],
                                  }
                                : item,
                            ),
                          })
                        }
                      >
                        {tcItemOptions.map((option) => (
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
                        className="w-20 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm disabled:opacity-50"
                        value={row.itemType === 'villager' ? row.quantity : 1}
                        disabled={row.itemType !== 'villager'}
                        onChange={(event) =>
                          withBuildOrder({
                            ...buildOrder,
                            townCenterQueue: buildOrder.townCenterQueue.map((item, index) =>
                              index === rowIndex
                                ? {
                                    ...item,
                                    quantity: row.itemType === 'villager' ? Math.max(1, Number(event.target.value) || 1) : 1,
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                    </td>
                    {[0, 1, 2, 3, 4].map((slot) => (
                      <td key={`${row.id}-${slot}`} className="border border-slate-800/70 p-1">
                        {row.itemType === 'villager' ? (
                          <select
                            className="w-full min-w-28 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                            value={stepValue(row.villagerSteps, slot as StepSlot)}
                            onChange={(event) => {
                              const nextSteps = [...row.villagerSteps] as Array<BuildOrderTaskStep | ''>;
                              nextSteps[slot] = event.target.value as BuildOrderTaskStep | '';
                              withBuildOrder({
                                ...buildOrder,
                                townCenterQueue: buildOrder.townCenterQueue.map((item, index) =>
                                  index === rowIndex ? { ...item, villagerSteps: normalizeSteps(nextSteps) } : item,
                                ),
                              });
                            }}
                          >
                            <option value="">—</option>
                            {stepOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="h-10 border border-slate-800/70 bg-slate-950/35" />
                        )}
                      </td>
                    ))}
                    <td className="border border-slate-800/70 p-1 text-right">
                      <button
                        type="button"
                        className="border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-xs text-slate-200"
                        onClick={() =>
                          withBuildOrder({
                            ...buildOrder,
                            townCenterQueue: buildOrder.townCenterQueue.filter((item) => item.id !== row.id),
                          })
                        }
                      >
                        Remove
                      </button>
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
                  townCenterQueue: [
                    ...buildOrder.townCenterQueue,
                    { id: rowId('tc'), itemType: 'villager', quantity: 1, villagerSteps: [] },
                  ],
                })
              }
            >
              Add TC item
            </button>
          </div>
        </section>

        <section className="border border-slate-700/70 bg-slate-950/45 p-3">
          {sectionHeader('Military queue', 'Queue units by producer. Each producer runs its own ordered queue.')}
          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="text-slate-400">
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Producer</th>
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Unit</th>
                  <th className="border border-slate-800/70 px-2 py-2 font-medium">Qty</th>
                  <th className="border border-slate-800/70 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {buildOrder.militaryQueue.map((row, rowIndex) => (
                  <tr key={row.id}>
                    <td className="border border-slate-800/70 p-1">
                      <select
                        className="w-full min-w-32 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                        value={row.producerType}
                        onChange={(event) =>
                          withBuildOrder({
                            ...buildOrder,
                            militaryQueue: buildOrder.militaryQueue.map((item, index) =>
                              index === rowIndex ? { ...item, producerType: event.target.value as typeof row.producerType } : item,
                            ),
                          })
                        }
                      >
                        {militaryProducerOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-slate-800/70 p-1">
                      <select
                        className="w-full min-w-32 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                        value={row.unitId}
                        onChange={(event) =>
                          withBuildOrder({
                            ...buildOrder,
                            militaryQueue: buildOrder.militaryQueue.map((item, index) =>
                              index === rowIndex ? { ...item, unitId: event.target.value } : item,
                            ),
                          })
                        }
                      >
                        {editableUnits.map((option) => (
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
                        className="w-20 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                        value={row.quantity}
                        onChange={(event) =>
                          withBuildOrder({
                            ...buildOrder,
                            militaryQueue: buildOrder.militaryQueue.map((item, index) =>
                              index === rowIndex ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) } : item,
                            ),
                          })
                        }
                      />
                    </td>
                    <td className="border border-slate-800/70 p-1 text-right">
                      <button
                        type="button"
                        className="border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-xs text-slate-200"
                        onClick={() =>
                          withBuildOrder({
                            ...buildOrder,
                            militaryQueue: buildOrder.militaryQueue.filter((item) => item.id !== row.id),
                          })
                        }
                      >
                        Remove
                      </button>
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
                  militaryQueue: [
                    ...buildOrder.militaryQueue,
                    {
                      id: rowId('military'),
                      producerType: 'archery_range',
                      unitId: editableUnits[0]?.value ?? 'archer',
                      quantity: 1,
                    },
                  ],
                })
              }
            >
              Add military row
            </button>
          </div>
        </section>

        <section className="border border-slate-700/70 bg-slate-950/45 p-3">
          {sectionHeader('Tech queue', 'Queue technologies by researching building. Use the Town Center queue for Loom and age-ups.')}
          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="text-slate-400">
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Building</th>
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Technology</th>
                  <th className="border border-slate-800/70 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {buildOrder.techQueue.map((row, rowIndex) => (
                  <tr key={row.id}>
                    <td className="border border-slate-800/70 p-1">
                      <select
                        className="w-full min-w-32 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                        value={row.buildingId}
                        onChange={(event) =>
                          withBuildOrder({
                            ...buildOrder,
                            techQueue: buildOrder.techQueue.map((item, index) =>
                              index === rowIndex ? { ...item, buildingId: event.target.value } : item,
                            ),
                          })
                        }
                      >
                        {[...new Map(editableTechs.map((item) => [item.buildingId, item.buildingId])).keys()].map((buildingId) => (
                          <option key={buildingId} value={buildingId}>
                            {buildingId.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-slate-800/70 p-1">
                      <select
                        className="w-full min-w-40 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                        value={row.techId}
                        onChange={(event) =>
                          withBuildOrder({
                            ...buildOrder,
                            techQueue: buildOrder.techQueue.map((item, index) =>
                              index === rowIndex ? { ...item, techId: event.target.value } : item,
                            ),
                          })
                        }
                      >
                        {editableTechs
                          .filter((tech) => tech.buildingId === row.buildingId)
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="border border-slate-800/70 p-1 text-right">
                      <button
                        type="button"
                        className="border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-xs text-slate-200"
                        onClick={() =>
                          withBuildOrder({
                            ...buildOrder,
                            techQueue: buildOrder.techQueue.filter((item) => item.id !== row.id),
                          })
                        }
                      >
                        Remove
                      </button>
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
              onClick={() => {
                const firstTech = editableTechs[0];
                if (!firstTech) return;
                withBuildOrder({
                  ...buildOrder,
                  techQueue: [
                    ...buildOrder.techQueue,
                    { id: rowId('tech'), buildingId: firstTech.buildingId, techId: firstTech.value },
                  ],
                });
              }}
            >
              Add tech row
            </button>
          </div>
        </section>

        <section className="border border-slate-700/70 bg-slate-950/45 p-3">
          {sectionHeader('Buildings', 'Choose what to build, what condition starts it, and which villager builds it.')}
          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="text-slate-400">
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Building</th>
                  <th className="border border-slate-800/70 px-2 py-2 font-medium">Qty</th>
                  <th className="border border-slate-800/70 px-2 py-2 text-left font-medium">Trigger</th>
                  <th className="border border-slate-800/70 px-2 py-2 font-medium">Builder vil</th>
                  <th className="border border-slate-800/70 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {buildOrder.buildingQueue.map((row, rowIndex) => (
                  <tr key={row.id}>
                    <td className="border border-slate-800/70 p-1">
                      <select
                        className="w-full min-w-40 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
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
                      <input
                        type="number"
                        min={1}
                        className="w-20 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                        value={row.quantity}
                        onChange={(event) =>
                          withBuildOrder({
                            ...buildOrder,
                            buildingQueue: buildOrder.buildingQueue.map((item, index) =>
                              index === rowIndex ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) } : item,
                            ),
                          })
                        }
                      />
                    </td>
                    <td className="border border-slate-800/70 p-1">
                      <select
                        className="w-full min-w-36 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
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
                        className="w-24 border border-slate-700/70 bg-slate-900/60 px-2 py-2 text-sm"
                        value={row.builderVillagerId ?? ''}
                        onChange={(event) =>
                          withBuildOrder({
                            ...buildOrder,
                            buildingQueue: buildOrder.buildingQueue.map((item, index) =>
                              index === rowIndex
                                ? {
                                    ...item,
                                    builderVillagerId: event.target.value === '' ? undefined : Math.max(1, Number(event.target.value) || 1),
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                    </td>
                    <td className="border border-slate-800/70 p-1 text-right">
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
                      quantity: 1,
                      trigger: 'prior_complete',
                    },
                  ],
                })
              }
            >
              Add building row
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
